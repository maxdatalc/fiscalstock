import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type LojaContext = {
  id: string;
  empresa_id: string;
  nome: string;
  emp_id_maxdata: string;
  terminal_maxdata: string;
  ativo: boolean;
};

export type EmpresaContext = {
  id: string;
  nome_fantasia: string;
  razao_social: string | null;
  cnpj: string | null;
  ativo: boolean;
  role_na_empresa: string;
  lojas: LojaContext[];
};

export type UserContext = {
  user: { id: string; email: string; nome: string; role: string };
  empresas: EmpresaContext[];
  is_global_admin: boolean;
};

export const getCurrentUserContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UserContext> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = context;

    // fs_profiles: perfil FiscalStock do usuário
    const { data: profile } = await supabaseAdmin
      .from("fs_profiles")
      .select("nome,email,role,ativo")
      .eq("user_id", userId)
      .maybeSingle();

    const isAdmin = profile?.role === "owner" || profile?.role === "admin";

    // tenant_users: de quais tenants (= empresas) o usuário faz parte
    const { data: vinculos } = await supabaseAdmin
      .from("tenant_users")
      .select("tenant_id,role")
      .eq("user_id", userId);

    const tenantIds = (vinculos ?? []).map((v) => v.tenant_id);

    // tenants: dados das empresas (name, is_active)
    const { data: tenantsRows } = tenantIds.length
      ? await supabaseAdmin
          .from("tenants")
          .select("id,name,is_active")
          .in("id", tenantIds)
          .eq("is_active", true)
          .order("name")
      : { data: [] as Array<{ id: string; name: string; is_active: boolean }> };

    // lojas: usando colunas do dashboard (name, emp_id, tenant_id, is_active)
    // terminal_maxdata foi adicionado via ALTER TABLE (migração)
    const { data: lojas } = tenantIds.length
      ? await supabaseAdmin
          .from("lojas")
          .select("id,tenant_id,name,emp_id,terminal_maxdata,is_active")
          .in("tenant_id", tenantIds)
          .eq("is_active", true)
          .order("name")
      : { data: [] as Array<{ id: string; tenant_id: string; name: string; emp_id: number; terminal_maxdata: string | null; is_active: boolean }> };

    const roleMap = new Map((vinculos ?? []).map((v) => [v.tenant_id, v.role]));

    const empresas: EmpresaContext[] = (tenantsRows ?? []).map((t) => ({
      id: t.id,
      nome_fantasia: t.name,
      razao_social: null,
      cnpj: null,
      ativo: t.is_active,
      role_na_empresa: roleMap.get(t.id) ?? (isAdmin ? (profile?.role ?? "admin") : "viewer"),
      lojas: (lojas ?? [])
        .filter((l) => l.tenant_id === t.id)
        .map((l): LojaContext => ({
          id: l.id,
          empresa_id: l.tenant_id,
          nome: l.name,
          emp_id_maxdata: String(l.emp_id),
          terminal_maxdata: l.terminal_maxdata ?? "1",
          ativo: l.is_active,
        })),
    }));

    return {
      user: {
        id: userId,
        email: profile?.email ?? "",
        nome: profile?.nome ?? "",
        role: profile?.role ?? "viewer",
      },
      empresas,
      is_global_admin: isAdmin,
    };
  });