import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * CRUD básico para Empresas, Lojas, Vínculos de Usuários,
 * Configs de Integração e leitura de Logs.
 *
 * Regras:
 * - Apenas owner/admin (global ou da empresa) podem alterar.
 * - Tokens/segredos nunca retornam pro frontend; apenas flags de "configurada".
 */

// ────────────────────────────────────────────────────────────────────────────
// Empresas
// ────────────────────────────────────────────────────────────────────────────

export const listEmpresasAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("empresas")
      .select("id,nome_fantasia,razao_social,cnpj,ativo,created_at")
      .order("nome_fantasia");
    if (error) throw error;
    return data ?? [];
  });

const EmpresaInput = z.object({
  nome_fantasia: z.string().min(2),
  razao_social: z.string().optional().nullable(),
  cnpj: z.string().optional().nullable(),
  ativo: z.boolean().optional(),
});

export const createEmpresa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => EmpresaInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: prof } = await context.supabase
      .from("profiles").select("role").eq("user_id", context.userId).maybeSingle();
    if (!prof || !["owner", "admin"].includes(prof.role)) {
      throw new Error("Apenas owner/admin globais podem criar empresas.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("empresas").insert(data).select().single();
    if (error) throw error;
    return row;
  });

// ────────────────────────────────────────────────────────────────────────────
// Lojas
// ────────────────────────────────────────────────────────────────────────────

export const listLojasAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ empresa_id: z.string().uuid().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("lojas")
      .select("id,empresa_id,nome,emp_id_maxdata,terminal_maxdata,ativo,created_at")
      .order("nome");
    if (data.empresa_id) q = q.eq("empresa_id", data.empresa_id);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

const LojaInput = z.object({
  empresa_id: z.string().uuid(),
  nome: z.string().min(2),
  emp_id_maxdata: z.string().min(1),
  terminal_maxdata: z.string().min(1),
  ativo: z.boolean().optional(),
});

export const createLoja = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => LojaInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: ok } = await context.supabase.rpc("user_can_manage_empresa", {
      _user_id: context.userId, _empresa_id: data.empresa_id,
    });
    if (!ok) throw new Error("Sem permissão para criar lojas nesta empresa.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin.from("lojas").insert(data).select().single();
    if (error) throw error;
    return row;
  });

// ────────────────────────────────────────────────────────────────────────────
// Vínculos de usuários
// ────────────────────────────────────────────────────────────────────────────

export const listUserEmpresas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ empresa_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: ok } = await context.supabase.rpc("user_can_manage_empresa", {
      _user_id: context.userId, _empresa_id: data.empresa_id,
    });
    if (!ok) throw new Error("Sem permissão para listar usuários desta empresa.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: vinculos } = await supabaseAdmin
      .from("user_empresas")
      .select("id,user_id,role_na_empresa,created_at")
      .eq("empresa_id", data.empresa_id);
    if (!vinculos?.length) return [];
    const userIds = vinculos.map((v) => v.user_id);
    const { data: profs } = await supabaseAdmin
      .from("profiles").select("user_id,nome,email").in("user_id", userIds);
    const map = new Map((profs ?? []).map((p) => [p.user_id, p]));
    return vinculos.map((v) => ({
      ...v,
      nome: map.get(v.user_id)?.nome ?? "—",
      email: map.get(v.user_id)?.email ?? "—",
    }));
  });

// ────────────────────────────────────────────────────────────────────────────
// Integration configs (write) — somente owner/admin da loja.
// Nunca retorna tokens.
// ────────────────────────────────────────────────────────────────────────────

const IntegrationUpsertInput = z.object({
  loja_id: z.string().uuid(),
  bridge_url: z.string().url().optional().nullable(),
  maxapi_url: z.string().url().optional().nullable(),
  maxapi_client_id: z.string().optional().nullable(),
  /** Quando vier vazio/null, NÃO sobrescreve o secret armazenado. */
  maxapi_secret_key: z.string().optional().nullable(),
});

export const upsertIntegrationConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IntegrationUpsertInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: ok } = await context.supabase.rpc("user_can_manage_loja", {
      _user_id: context.userId, _loja_id: data.loja_id,
    });
    if (!ok) throw new Error("Apenas owner/admin pode editar a integração.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const includeSecret = !!(data.maxapi_secret_key && data.maxapi_secret_key.trim().length > 0);
    const payload = {
      loja_id: data.loja_id,
      bridge_url: data.bridge_url ?? null,
      maxapi_url: data.maxapi_url ?? null,
      maxapi_client_id: data.maxapi_client_id ?? null,
      ...(includeSecret ? { maxapi_secret_key: data.maxapi_secret_key! } : {}),
    };

    const { error } = await supabaseAdmin
      .from("integration_configs")
      .upsert(payload, { onConflict: "loja_id" });
    if (error) throw error;
    return { ok: true };
  });

// ────────────────────────────────────────────────────────────────────────────
// Audit logs (leitura)
// ────────────────────────────────────────────────────────────────────────────

export const listAuditLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    empresa_id: z.string().uuid().optional(),
    loja_id: z.string().uuid().optional(),
    limit: z.number().int().min(1).max(500).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("audit_logs")
      .select("id,created_at,user_id,empresa_id,loja_id,acao,entidade,entidade_id,detalhes_json")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 100);
    if (data.empresa_id) q = q.eq("empresa_id", data.empresa_id);
    if (data.loja_id) q = q.eq("loja_id", data.loja_id);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });