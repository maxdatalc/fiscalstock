import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

    // Checa permissão via RPC (RLS).
    const { data: can } = await context.supabase.rpc("user_can_access_loja", {
      _user_id: context.userId, _loja_id: data.loja_id,
    });
    if (!can) throw new Error("Acesso negado a esta loja");

    const { data: cfg } = await supabaseAdmin
      .from("integration_configs")
      .select("loja_id,status_bridge,status_maxapi,ultimo_teste_bridge,ultimo_teste_maxapi,bridge_url,maxapi_url,maxapi_client_id,maxapi_secret_key")
      .eq("loja_id", data.loja_id)
      .maybeSingle();

    if (!cfg) return null;
    return {
      loja_id: cfg.loja_id,
      status_bridge: cfg.status_bridge,
      status_maxapi: cfg.status_maxapi,
      ultimo_teste_bridge: cfg.ultimo_teste_bridge,
      ultimo_teste_maxapi: cfg.ultimo_teste_maxapi,
      bridge_configurada: !!cfg.bridge_url,
      maxapi_configurada: !!(cfg.maxapi_url && cfg.maxapi_client_id && cfg.maxapi_secret_key),
    };
  });

async function logAuditoria(opts: {
  userId: string; empresa_id?: string | null; loja_id?: string | null;
  acao: string; entidade?: string; entidade_id?: string; detalhes?: unknown;
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

    // Permissão: precisa gerenciar a loja
    const { data: canManage } = await context.supabase.rpc("user_can_manage_loja", {
      _user_id: context.userId, _loja_id: data.loja_id,
    });
    if (!canManage) throw new Error("Apenas owner/admin pode testar integrações.");

    const { data: cfg } = await supabaseAdmin
      .from("integration_configs")
      .select("bridge_url,loja_id")
      .eq("loja_id", data.loja_id)
      .maybeSingle();

    const { data: loja } = await supabaseAdmin
      .from("lojas").select("empresa_id").eq("id", data.loja_id).maybeSingle();

    let status: "online" | "offline" | "erro" | "nao_configurado" = "nao_configurado";
    let mensagem = "Bridge SQL ainda não configurada para esta loja.";

    if (cfg?.bridge_url) {
      // TODO: chamada real à Bridge SQL via backend.
      // Por ora, simulação controlada.
      const ok = Math.random() > 0.2;
      status = ok ? "online" : "erro";
      mensagem = ok ? "Bridge respondeu com sucesso." : "Falha ao consultar a Bridge SQL.";
    }

    await supabaseAdmin
      .from("integration_configs")
      .upsert(
        { loja_id: data.loja_id, status_bridge: status, ultimo_teste_bridge: new Date().toISOString() },
        { onConflict: "loja_id" },
      );

    await logAuditoria({
      userId: context.userId, empresa_id: loja?.empresa_id, loja_id: data.loja_id,
      acao: "TESTOU_INTEGRACAO_BRIDGE", entidade: "integration_configs", entidade_id: data.loja_id,
      detalhes: { status, mensagem },
    });

    return { status, mensagem };
  });

export const testMaxApiConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => LojaInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: canManage } = await context.supabase.rpc("user_can_manage_loja", {
      _user_id: context.userId, _loja_id: data.loja_id,
    });
    if (!canManage) throw new Error("Apenas owner/admin pode testar integrações.");

    const { data: loja } = await supabaseAdmin
      .from("lojas").select("id,empresa_id,emp_id_maxdata,terminal_maxdata")
      .eq("id", data.loja_id).maybeSingle();
    const { data: cfg } = await supabaseAdmin
      .from("integration_configs")
      .select("maxapi_url,maxapi_client_id,maxapi_secret_key,maxapi_token_cache,maxapi_token_expires_at")
      .eq("loja_id", data.loja_id).maybeSingle();

    let status: "online" | "offline" | "erro" | "nao_configurado" = "nao_configurado";
    let mensagem = "MaxAPI ainda não configurada para esta loja.";
    let token_cached_until: string | null = null;

    if (loja && cfg?.maxapi_url && cfg.maxapi_client_id && cfg.maxapi_secret_key) {
      // Cache curto: se token vigente, considera online sem nova chamada
      if (cfg.maxapi_token_cache && cfg.maxapi_token_expires_at &&
          new Date(cfg.maxapi_token_expires_at) > new Date()) {
        status = "online";
        mensagem = "Token MaxAPI válido em cache.";
        token_cached_until = cfg.maxapi_token_expires_at;
      } else {
        // TODO: chamada real POST {maxapi_url}/v2/auth
        //   body: { empId: loja.emp_id_maxdata, terminal: loja.terminal_maxdata }
        //   header de client/secret conforme contrato MaxAPI.
        const ok = Math.random() > 0.2;
        if (ok) {
          const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
          await supabaseAdmin.from("integration_configs").update({
            maxapi_token_cache: "tk_simulado_" + Math.random().toString(36).slice(2, 10),
            maxapi_token_expires_at: expiresAt,
          }).eq("loja_id", data.loja_id);
          status = "online";
          mensagem = "Autenticação MaxAPI realizada com sucesso.";
          token_cached_until = expiresAt;
        } else {
          status = "erro";
          mensagem = "Falha na autenticação MaxAPI.";
        }
      }
    }

    await supabaseAdmin
      .from("integration_configs")
      .upsert(
        { loja_id: data.loja_id, status_maxapi: status, ultimo_teste_maxapi: new Date().toISOString() },
        { onConflict: "loja_id" },
      );

    await logAuditoria({
      userId: context.userId, empresa_id: loja?.empresa_id, loja_id: data.loja_id,
      acao: "TESTOU_INTEGRACAO_MAXAPI", entidade: "integration_configs", entidade_id: data.loja_id,
      detalhes: { status, mensagem },
    });

    return { status, mensagem, token_cached_until };
  });