import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type LojaUpdate = Database["public"]["Tables"]["lojas"]["Update"];
type IntegrationConfigInsert = Database["public"]["Tables"]["integration_configs"]["Insert"];

/**
 * CRUD básico para Empresas (tenants), Lojas, Vínculos de Usuários,
 * Configs de Integração e leitura de Logs.
 *
 * Regras:
 * - Apenas owner/admin (global ou do tenant) podem alterar.
 * - Tokens/segredos nunca retornam pro frontend; apenas flags de "configurada".
 */

// ────────────────────────────────────────────────────────────────────────────
// Empresas (tenants)
// ────────────────────────────────────────────────────────────────────────────

export const listEmpresasAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("fs_is_admin", {
      _user_id: context.userId,
    });
    if (!isAdmin) throw new Error("Apenas administradores globais podem listar todos os tenants.");

    const { data, error } = await context.supabase
      .from("tenants")
      .select("id,name,slug,plan,is_active,created_at")
      .order("name");
    if (error) throw error;
    return (data ?? []).map((t) => ({
      id: t.id,
      nome_fantasia: t.name,
      slug: t.slug,
      plan: t.plan,
      ativo: t.is_active,
      created_at: t.created_at,
    }));
  });

const EmpresaInput = z.object({
  nome_fantasia: z.string().min(2),
  cnpj: z.string().optional().nullable(),
});

export const createEmpresa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => EmpresaInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("fs_is_admin", {
      _user_id: context.userId,
    });
    if (!isAdmin) throw new Error("Apenas administradores globais podem criar empresas.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("tenants")
      .insert({ name: data.nome_fantasia })
      .select()
      .single();
    if (error) throw error;
    return { ...row, nome_fantasia: row.name, ativo: row.is_active };
  });

// ────────────────────────────────────────────────────────────────────────────
// Lojas
// ────────────────────────────────────────────────────────────────────────────

export const listLojasAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ tenant_id: z.string().uuid().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("lojas")
      .select("id,tenant_id,name,emp_id,terminal_maxdata,is_active,created_at")
      .order("name");
    if (data.tenant_id) q = q.eq("tenant_id", data.tenant_id);
    const { data: rows, error } = await q;
    if (error) throw error;
    return (rows ?? []).map((l) => ({
      id: l.id,
      empresa_id: l.tenant_id,
      tenant_id: l.tenant_id,
      nome: l.name,
      emp_id_maxdata: String(l.emp_id),
      terminal_maxdata: l.terminal_maxdata ?? "",
      ativo: l.is_active,
      created_at: l.created_at,
    }));
  });

const LojaInput = z.object({
  empresa_id: z.string().uuid(),
  nome: z.string().min(2),
  emp_id_maxdata: z.string().min(1),
  terminal_maxdata: z.string().min(1),
});

export const createLoja = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => LojaInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: canManage } = await context.supabase.rpc("fs_is_admin", {
      _user_id: context.userId,
    });
    if (!canManage) throw new Error("Apenas administradores globais podem criar lojas.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("lojas")
      .insert({
        tenant_id: data.empresa_id,
        name: data.nome,
        emp_id: parseInt(data.emp_id_maxdata, 10),
        terminal_maxdata: data.terminal_maxdata,
      })
      .select()
      .single();
    if (error) throw error;
    return {
      ...row,
      empresa_id: row.tenant_id,
      nome: row.name,
      emp_id_maxdata: String(row.emp_id),
      ativo: row.is_active,
    };
  });

// ────────────────────────────────────────────────────────────────────────────
// Vínculos de usuários (tenant_users)
// ────────────────────────────────────────────────────────────────────────────

export const listUserEmpresas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ tenant_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: tuRow } = await supabaseAdmin
      .from("tenant_users")
      .select("role")
      .eq("tenant_id", data.tenant_id)
      .eq("user_id", context.userId)
      .maybeSingle();

    const { data: isAdmin } = await context.supabase.rpc("fs_is_admin", {
      _user_id: context.userId,
    });

    const isManagerOrAdmin =
      isAdmin || (tuRow && ["owner", "admin"].includes(tuRow.role));
    if (!isManagerOrAdmin)
      throw new Error("Sem permissão para listar usuários deste tenant.");

    const { data: vinculos } = await supabaseAdmin
      .from("tenant_users")
      .select("id,user_id,role,created_at")
      .eq("tenant_id", data.tenant_id);

    if (!vinculos?.length) return [];
    const userIds = vinculos.map((v) => v.user_id);

    const { data: profs } = await supabaseAdmin
      .from("fs_profiles")
      .select("user_id,nome,email")
      .in("user_id", userIds);

    const map = new Map((profs ?? []).map((p) => [p.user_id, p]));
    return vinculos.map((v) => ({
      ...v,
      role_na_empresa: v.role,
      nome: map.get(v.user_id)?.nome ?? "—",
      email: map.get(v.user_id)?.email ?? "—",
    }));
  });

// ────────────────────────────────────────────────────────────────────────────
// Integration configs (write) — delegado para integrations.functions.ts
// Esta versão mantém compatibilidade com telas de admin legadas.
// Bridge URL/token → lojas.sql_bridge_url/token
// MaxAPI → integration_configs
// ────────────────────────────────────────────────────────────────────────────

const IntegrationUpsertInput = z.object({
  loja_id: z.string().uuid(),
  bridge_url: z.string().url().optional().nullable(),
  bridge_token: z.string().optional().nullable(),
  maxapi_url: z.string().url().optional().nullable(),
  maxapi_client_id: z.string().optional().nullable(),
  maxapi_secret_key: z.string().optional().nullable(),
  terminal_maxdata: z.string().optional().nullable(),
});

export const upsertIntegrationConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IntegrationUpsertInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: canManage } = await context.supabase.rpc("fs_user_can_manage_loja", {
      _user_id: context.userId,
      _loja_id: data.loja_id,
    });
    if (!canManage) throw new Error("Apenas owner/admin pode editar a integração.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Bridge URL/token e terminal vão para lojas
    const lojaUpdate: LojaUpdate = {};
    if (data.bridge_url !== undefined) lojaUpdate.sql_bridge_url = data.bridge_url ?? null;
    if (data.bridge_token && data.bridge_token.trim().length > 0)
      lojaUpdate.sql_bridge_token = data.bridge_token;
    if (data.terminal_maxdata !== undefined)
      lojaUpdate.terminal_maxdata = data.terminal_maxdata ?? null;

    if (Object.keys(lojaUpdate).length > 0) {
      const { error } = await supabaseAdmin
        .from("lojas")
        .update(lojaUpdate)
        .eq("id", data.loja_id);
      if (error) throw error;
    }

    // MaxAPI vai para integration_configs
    const cfgPayload: IntegrationConfigInsert = { loja_id: data.loja_id };
    if (data.maxapi_url !== undefined) cfgPayload.maxapi_url = data.maxapi_url ?? null;
    if (data.maxapi_client_id !== undefined) cfgPayload.maxapi_client_id = data.maxapi_client_id ?? null;
    const includeSecret = !!(data.maxapi_secret_key?.trim());
    if (includeSecret) cfgPayload.maxapi_secret_key = data.maxapi_secret_key!;
    if (data.maxapi_url !== undefined || data.terminal_maxdata !== undefined) {
      cfgPayload.maxapi_token_cache = null;
      cfgPayload.maxapi_token_expires_at = null;
    }

    const { error: cfgErr } = await supabaseAdmin
      .from("integration_configs")
      .upsert(cfgPayload, { onConflict: "loja_id" });
    if (cfgErr) throw cfgErr;

    return { ok: true };
  });

// ────────────────────────────────────────────────────────────────────────────
// Audit logs (leitura)
// ────────────────────────────────────────────────────────────────────────────

export const listAuditLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      tenant_id: z.string().uuid().optional(),
      loja_id: z.string().uuid().optional(),
      limit: z.number().int().min(1).max(500).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let q = supabaseAdmin
      .from("fs_audit_logs")
      .select("id,created_at,user_id,tenant_id,loja_id,acao,entidade,entidade_id,detalhes_json")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 100);

    if (data.tenant_id) q = q.eq("tenant_id", data.tenant_id);
    if (data.loja_id) q = q.eq("loja_id", data.loja_id);

    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });