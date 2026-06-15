import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pingBridge } from "@/lib/bridge/bridge-client";
import { getOrRefreshToken, buildMaxApiConfig } from "@/lib/maxapi/maxapi-client";

type IntegrationConfigInsert = Database["public"]["Tables"]["integration_configs"]["Insert"];
type LojaUpdate = Database["public"]["Tables"]["lojas"]["Update"];

const LojaInput = z.object({ loja_id: z.string().uuid() });

export type IntegrationStatusInfo = {
  loja_id: string;
  status_bridge: string;
  status_maxapi: string;
  ultimo_teste_bridge: string | null;
  ultimo_teste_maxapi: string | null;
  bridge_configurada: boolean;
  maxapi_configurada: boolean;
};

/** Resumo seguro do status de integração (sem expor URLs/segredos). */
export const getIntegrationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => LojaInput.parse(d))
  .handler(async ({ data, context }): Promise<IntegrationStatusInfo | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: can } = await context.supabase.rpc("user_can_access_loja", {
      _user_id: context.userId,
      _loja_id: data.loja_id,
    });
    if (!can) throw new Error("Acesso negado a esta loja");

    const [{ data: cfg }, { data: loja }] = await Promise.all([
      supabaseAdmin
        .from("integration_configs")
        .select(
          "loja_id,status_bridge,status_maxapi,ultimo_teste_bridge,ultimo_teste_maxapi,bridge_url,bridge_token,maxapi_url",
        )
        .eq("loja_id", data.loja_id)
        .maybeSingle(),
      supabaseAdmin
        .from("lojas")
        .select("emp_id_maxdata, terminal_maxdata")
        .eq("id", data.loja_id)
        .maybeSingle(),
    ]);

    if (!cfg) return null;

    // MaxAPI is configured when URL + loja empId + terminal are all present
    const maxapiConfigurada = !!(cfg.maxapi_url && loja?.emp_id_maxdata && loja?.terminal_maxdata);

    return {
      loja_id: cfg.loja_id,
      status_bridge: cfg.status_bridge,
      status_maxapi: cfg.status_maxapi,
      ultimo_teste_bridge: cfg.ultimo_teste_bridge,
      ultimo_teste_maxapi: cfg.ultimo_teste_maxapi,
      bridge_configurada: !!(cfg.bridge_url && cfg.bridge_token),
      maxapi_configurada: maxapiConfigurada,
    };
  });

async function logAuditoria(opts: {
  userId: string;
  empresa_id?: string | null;
  loja_id?: string | null;
  acao: string;
  entidade?: string;
  entidade_id?: string;
  detalhes?: unknown;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("audit_logs").insert({
    user_id: opts.userId,
    empresa_id: opts.empresa_id ?? null,
    loja_id: opts.loja_id ?? null,
    acao: opts.acao,
    entidade: opts.entidade ?? null,
    entidade_id: opts.entidade_id ?? null,
    detalhes_json: (opts.detalhes ?? null) as never,
  });
}

export const testBridgeConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => LojaInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: canManage } = await context.supabase.rpc("user_can_manage_loja", {
      _user_id: context.userId,
      _loja_id: data.loja_id,
    });
    if (!canManage) throw new Error("Apenas owner/admin pode testar integrações.");

    const [{ data: cfg }, { data: loja }] = await Promise.all([
      supabaseAdmin
        .from("integration_configs")
        .select("bridge_url, bridge_token, loja_id")
        .eq("loja_id", data.loja_id)
        .maybeSingle(),
      supabaseAdmin.from("lojas").select("empresa_id").eq("id", data.loja_id).maybeSingle(),
    ]);

    let status: "online" | "offline" | "erro" | "nao_configurado" = "nao_configurado";
    let mensagem = "Bridge SQL ainda não configurada para esta loja.";
    let latencia_ms: number | null = null;

    if (cfg?.bridge_url && cfg?.bridge_token) {
      const result = await pingBridge({ url: cfg.bridge_url, token: cfg.bridge_token });
      if (result.ok) {
        status = "online";
        mensagem = `Bridge respondeu em ${result.ms}ms — banco: ${result.db || "BATAUTO"}`;
        latencia_ms = result.ms;
      } else {
        status = "erro";
        mensagem = `Bridge SQL erro: ${result.error ?? "sem resposta"}`;
      }
    } else if (cfg?.bridge_url && !cfg?.bridge_token) {
      status = "nao_configurado";
      mensagem = "Bridge URL configurada mas token ausente.";
    }

    await supabaseAdmin.from("integration_configs").upsert(
      {
        loja_id: data.loja_id,
        status_bridge: status,
        ultimo_teste_bridge: new Date().toISOString(),
      },
      { onConflict: "loja_id" },
    );

    await logAuditoria({
      userId: context.userId,
      empresa_id: loja?.empresa_id,
      loja_id: data.loja_id,
      acao: "TESTOU_INTEGRACAO_BRIDGE",
      entidade: "integration_configs",
      entidade_id: data.loja_id,
      detalhes: { status, mensagem, latencia_ms },
    });

    return { status, mensagem, latencia_ms };
  });

export const testMaxApiConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => LojaInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: canManage } = await context.supabase.rpc("user_can_manage_loja", {
      _user_id: context.userId,
      _loja_id: data.loja_id,
    });
    if (!canManage) throw new Error("Apenas owner/admin pode testar integrações.");

    const [{ data: loja }, { data: cfg }] = await Promise.all([
      supabaseAdmin
        .from("lojas")
        .select("id, empresa_id, emp_id_maxdata, terminal_maxdata")
        .eq("id", data.loja_id)
        .maybeSingle(),
      supabaseAdmin
        .from("integration_configs")
        .select("maxapi_url, maxapi_token_cache, maxapi_token_expires_at")
        .eq("loja_id", data.loja_id)
        .maybeSingle(),
    ]);

    let status: "online" | "offline" | "erro" | "nao_configurado" = "nao_configurado";
    let mensagem = "MaxAPI ainda não configurada para esta loja.";
    let token_cached_until: string | null = null;

    const isConfigured = !!(cfg?.maxapi_url && loja?.emp_id_maxdata && loja?.terminal_maxdata);

    if (isConfigured) {
      try {
        const maxApiConfig = buildMaxApiConfig(loja!, cfg!);
        const token = await getOrRefreshToken(maxApiConfig, supabaseAdmin, data.loja_id);

        const { data: refreshed } = await supabaseAdmin
          .from("integration_configs")
          .select("maxapi_token_expires_at")
          .eq("loja_id", data.loja_id)
          .maybeSingle();

        token_cached_until = refreshed?.maxapi_token_expires_at ?? null;
        status = token ? "online" : "erro";
        mensagem = token
          ? `Autenticação MaxAPI realizada com sucesso. Cache válido até ${token_cached_until ?? "desconhecido"}.`
          : "Token retornado vazio — verifique configuração.";
      } catch (err) {
        status = "erro";
        mensagem = `Falha na autenticação MaxAPI: ${(err as Error).message}`;
      }
    } else if (cfg?.maxapi_url) {
      status = "nao_configurado";
      mensagem = "MaxAPI URL configurada mas emp_id_maxdata ou terminal_maxdata ausentes na loja.";
    }

    await supabaseAdmin.from("integration_configs").upsert(
      {
        loja_id: data.loja_id,
        status_maxapi: status,
        ultimo_teste_maxapi: new Date().toISOString(),
      },
      { onConflict: "loja_id" },
    );

    await logAuditoria({
      userId: context.userId,
      empresa_id: loja?.empresa_id,
      loja_id: data.loja_id,
      acao: "TESTOU_INTEGRACAO_MAXAPI",
      entidade: "integration_configs",
      entidade_id: data.loja_id,
      detalhes: { status, mensagem },
    });

    return { status, mensagem, token_cached_until };
  });

// ---------------------------------------------------------------------------
// getIntegrationConfig — lê config atual para pré-popular formulário
// Não expõe bridge_token (retorna apenas se está preenchido)
// ---------------------------------------------------------------------------

export type IntegrationConfig = {
  bridge_url: string | null;
  bridge_token_configurado: boolean;
  maxapi_url: string | null;
  emp_id_maxdata: string | null;
  terminal_maxdata: string | null;
};

export const getIntegrationConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => LojaInput.parse(d))
  .handler(async ({ data, context }): Promise<IntegrationConfig | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: canManage } = await context.supabase.rpc("user_can_manage_loja", {
      _user_id: context.userId,
      _loja_id: data.loja_id,
    });
    if (!canManage) throw new Error("Apenas owner/admin pode ver configurações de integração.");

    const [{ data: cfg }, { data: loja }] = await Promise.all([
      supabaseAdmin
        .from("integration_configs")
        .select("bridge_url, bridge_token, maxapi_url")
        .eq("loja_id", data.loja_id)
        .maybeSingle(),
      supabaseAdmin
        .from("lojas")
        .select("emp_id_maxdata, terminal_maxdata")
        .eq("id", data.loja_id)
        .maybeSingle(),
    ]);

    if (!cfg && !loja) return null;

    return {
      bridge_url: cfg?.bridge_url ?? null,
      bridge_token_configurado: !!cfg?.bridge_token,
      maxapi_url: cfg?.maxapi_url ?? null,
      emp_id_maxdata: loja?.emp_id_maxdata ?? null,
      terminal_maxdata: loja?.terminal_maxdata ?? null,
    };
  });

// ---------------------------------------------------------------------------
// saveIntegrationConfig — salva todas as credenciais MaxData de uma loja
// Requer role owner/admin. Invalida cache do token MaxAPI ao salvar.
// ---------------------------------------------------------------------------

const SaveConfigInput = z.object({
  loja_id: z.string().uuid(),
  bridge_url: z.string().url("URL da Bridge inválida").optional().or(z.literal("")),
  bridge_token: z.string().optional(),
  maxapi_url: z.string().url("URL da MaxAPI inválida").optional().or(z.literal("")),
  emp_id_maxdata: z.string().optional(),
  terminal_maxdata: z.string().optional(),
});

export const saveIntegrationConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SaveConfigInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: canManage } = await context.supabase.rpc("user_can_manage_loja", {
      _user_id: context.userId,
      _loja_id: data.loja_id,
    });
    if (!canManage) throw new Error("Apenas owner/admin pode alterar configurações de integração.");

    const { data: loja } = await supabaseAdmin
      .from("lojas")
      .select("empresa_id")
      .eq("id", data.loja_id)
      .maybeSingle();

    const invalidaTokenMaxApi =
      data.maxapi_url !== undefined ||
      data.emp_id_maxdata !== undefined ||
      data.terminal_maxdata !== undefined;

    const cfgUpsert: IntegrationConfigInsert = { loja_id: data.loja_id };
    if (data.bridge_url !== undefined) cfgUpsert.bridge_url = data.bridge_url || null;
    if (data.bridge_token !== undefined && data.bridge_token !== "")
      cfgUpsert.bridge_token = data.bridge_token;
    if (data.maxapi_url !== undefined) cfgUpsert.maxapi_url = data.maxapi_url || null;
    if (invalidaTokenMaxApi) {
      cfgUpsert.maxapi_token_cache = null;
      cfgUpsert.maxapi_token_expires_at = null;
    }

    await supabaseAdmin.from("integration_configs").upsert(cfgUpsert, { onConflict: "loja_id" });

    if (data.emp_id_maxdata !== undefined || data.terminal_maxdata !== undefined) {
      const lojaUpdate: LojaUpdate = {};
      if (data.emp_id_maxdata !== undefined) lojaUpdate.emp_id_maxdata = data.emp_id_maxdata;
      if (data.terminal_maxdata !== undefined) lojaUpdate.terminal_maxdata = data.terminal_maxdata;
      await supabaseAdmin.from("lojas").update(lojaUpdate).eq("id", data.loja_id);
    }

    const camposAlterados = [
      data.bridge_url !== undefined && "bridge_url",
      data.bridge_token !== undefined && data.bridge_token !== "" && "bridge_token",
      data.maxapi_url !== undefined && "maxapi_url",
      data.emp_id_maxdata !== undefined && "emp_id_maxdata",
      data.terminal_maxdata !== undefined && "terminal_maxdata",
    ].filter(Boolean);

    await logAuditoria({
      userId: context.userId,
      empresa_id: loja?.empresa_id,
      loja_id: data.loja_id,
      acao: "SALVOU_CONFIG_INTEGRACAO",
      entidade: "integration_configs",
      entidade_id: data.loja_id,
      detalhes: { campos_alterados: camposAlterados },
    });

    return { ok: true };
  });
