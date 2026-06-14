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
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("nome,email,role")
      .eq("user_id", userId)
      .maybeSingle();

    const isAdmin = profile?.role === "owner" || profile?.role === "admin";

    // Empresas visíveis ao usuário (via RLS)
    const { data: empresasRows } = await supabase
      .from("empresas")
      .select("id,nome_fantasia,razao_social,cnpj,ativo")
      .order("nome_fantasia");

    const empresaIds = (empresasRows ?? []).map((e) => e.id);

    const { data: vinculos } = empresaIds.length
      ? await supabase
          .from("user_empresas")
          .select("empresa_id,role_na_empresa")
          .eq("user_id", userId)
          .in("empresa_id", empresaIds)
      : { data: [] as Array<{ empresa_id: string; role_na_empresa: string }> };

    const { data: lojas } = empresaIds.length
      ? await supabase
          .from("lojas")
          .select("id,empresa_id,nome,emp_id_maxdata,terminal_maxdata,ativo")
          .in("empresa_id", empresaIds)
          .order("nome")
      : { data: [] as LojaContext[] };

    const roleMap = new Map((vinculos ?? []).map((v) => [v.empresa_id, v.role_na_empresa]));

    const empresas: EmpresaContext[] = (empresasRows ?? []).map((e) => ({
      ...e,
      role_na_empresa: roleMap.get(e.id) ?? (isAdmin ? (profile?.role ?? "admin") : "viewer"),
      lojas: (lojas ?? []).filter((l) => l.empresa_id === e.id),
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