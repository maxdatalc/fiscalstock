import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { getCurrentUserContext, type UserContext, type EmpresaContext, type LojaContext } from "@/lib/api/user-context.functions";

type Ctx = {
  loading: boolean;
  user: UserContext["user"] | null;
  empresas: EmpresaContext[];
  empresaAtiva: EmpresaContext | null;
  lojaAtiva: LojaContext | null;
  isGlobalAdmin: boolean;
  refresh: () => Promise<void>;
  setEmpresaAtiva: (id: string | null) => void;
  setLojaAtiva: (id: string | null) => void;
  signOut: () => Promise<void>;
  canManageActiveCompany: boolean;
};

const AuthCtx = createContext<Ctx | null>(null);

const EMP_KEY = "fsmd:empresa_id";
const LOJA_KEY = "fsmd:loja_id";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserContext["user"] | null>(null);
  const [empresas, setEmpresas] = useState<EmpresaContext[]>([]);
  const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);
  const [empresaId, setEmpId] = useState<string | null>(null);
  const [lojaId, setLId] = useState<string | null>(null);
  const fetchCtx = useServerFn(getCurrentUserContext);

  const empresaAtiva = empresas.find((e) => e.id === empresaId) ?? null;
  const lojaAtiva = empresaAtiva?.lojas.find((l) => l.id === lojaId) ?? null;
  const canManageActiveCompany =
    isGlobalAdmin || ["owner", "admin"].includes(empresaAtiva?.role_na_empresa ?? "");

  async function refresh() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) { setUser(null); setEmpresas([]); setLoading(false); return; }
    try {
      const ctx = await fetchCtx();
      setUser(ctx.user);
      setEmpresas(ctx.empresas);
      setIsGlobalAdmin(ctx.is_global_admin);
      const savedEmp = typeof window !== "undefined" ? localStorage.getItem(EMP_KEY) : null;
      const savedLoja = typeof window !== "undefined" ? localStorage.getItem(LOJA_KEY) : null;
      const chosenEmp = ctx.empresas.find((e) => e.id === savedEmp) ?? ctx.empresas[0] ?? null;
      setEmpId(chosenEmp?.id ?? null);
      const chosenLoja = chosenEmp?.lojas.find((l) => l.id === savedLoja) ?? chosenEmp?.lojas[0] ?? null;
      setLId(chosenLoja?.id ?? null);
    } catch (e) {
      console.error(e);
      setUser(null); setEmpresas([]);
    } finally { setLoading(false); }
  }

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(() => { void refresh(); });
    void refresh();
    return () => { sub.subscription.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setEmpresaAtiva(id: string | null) {
    setEmpId(id);
    if (typeof window !== "undefined") {
      if (id) localStorage.setItem(EMP_KEY, id); else localStorage.removeItem(EMP_KEY);
    }
    const emp = empresas.find((e) => e.id === id);
    const firstLoja = emp?.lojas[0]?.id ?? null;
    setLojaAtiva(firstLoja);
  }
  function setLojaAtiva(id: string | null) {
    setLId(id);
    if (typeof window !== "undefined") {
      if (id) localStorage.setItem(LOJA_KEY, id); else localStorage.removeItem(LOJA_KEY);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    if (typeof window !== "undefined") {
      localStorage.removeItem(EMP_KEY); localStorage.removeItem(LOJA_KEY);
    }
    setUser(null); setEmpresas([]); setEmpId(null); setLId(null);
  }

  return (
    <AuthCtx.Provider value={{
      loading, user, empresas, empresaAtiva, lojaAtiva, isGlobalAdmin,
      refresh, setEmpresaAtiva, setLojaAtiva, signOut, canManageActiveCompany,
    }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>");
  return ctx;
}