import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Boxes, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Entrar — FiscalStock MaxData" }] }),
  component: LoginPage,
});

function LoginPage() {
  const router = useRouter();
  const { user, empresas, isGlobalAdmin, setEmpresaAtiva, refresh } = useAuth();
  const [email, setEmail] = useState("admin@maxdata.com.br");
  const [senha, setSenha] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user && empresas.length === 1) {
      setEmpresaAtiva(empresas[0].id);
      router.navigate({ to: "/dashboard" });
    }
  }, [user, empresas, router, setEmpresaAtiva]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email, password: senha,
          options: { emailRedirectTo: `${window.location.origin}/dashboard` },
        });
        if (error) throw error;
        toast.success("Conta criada. Verifique seu e-mail se necessário.");
      }
      await refresh();
    } catch (err: unknown) {
      toast.error((err as Error).message ?? "Erro ao autenticar");
    } finally { setLoading(false); }
  }

  function escolherEmpresa(id: string) {
    setEmpresaAtiva(id);
    router.navigate({ to: "/dashboard" });
  }

  const step: "login" | "empresa" = user ? "empresa" : "login";

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="hidden flex-col justify-between bg-primary p-12 text-primary-foreground md:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-white/15">
            <Boxes className="h-6 w-6" />
          </div>
          <div>
            <p className="text-lg font-semibold leading-tight">FiscalStock</p>
            <p className="text-xs uppercase tracking-wider opacity-80">MaxData</p>
          </div>
        </div>
        <div className="space-y-4">
          <h1 className="text-4xl font-bold leading-tight">
            Compare estoque <span className="opacity-80">físico</span> e <span className="opacity-80">fiscal</span> antes de emitir.
          </h1>
          <p className="max-w-md text-base opacity-90">
            Visão clara e segura para o usuário do ERP MaxData saber exatamente o que pode emitir, sem surpresas fiscais.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm opacity-80">
          <ShieldCheck className="h-4 w-4" />
          Integração via Bridge SQL e MaxAPI — credenciais nunca expostas.
        </div>
      </div>

      <div className="flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2 md:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Boxes className="h-5 w-5" />
            </div>
            <p className="text-base font-semibold">FiscalStock MaxData</p>
          </div>

          {step === "login" ? (
            <form onSubmit={login} className="space-y-5">
              <div>
                <h2 className="text-2xl font-semibold">{mode === "signin" ? "Entrar" : "Criar conta"}</h2>
                <p className="mt-1 text-sm text-muted-foreground">Acesse com suas credenciais MaxData.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="senha">Senha</Label>
                <Input id="senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
              </div>
              <Button type="submit" className="h-11 w-full" disabled={loading}>
                {loading ? "Processando..." : mode === "signin" ? "Entrar" : "Criar conta"}
              </Button>
              <button type="button" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
                className="w-full text-center text-xs text-muted-foreground hover:text-foreground">
                {mode === "signin" ? "Não tem conta? Criar uma" : "Já tem conta? Entrar"}
              </button>
            </form>
          ) : (
            <div className="space-y-5">
              <div>
                <h2 className="text-2xl font-semibold">Escolha a loja</h2>
                <p className="mt-1 text-sm text-muted-foreground">Selecione a empresa/loja em que vai operar.</p>
              </div>
              <div className="space-y-2">
                {empresas.map((e) => (
                  <button key={e.id} onClick={() => escolherEmpresa(e.id)}
                    className="flex w-full items-center justify-between rounded-md border p-4 text-left transition-colors hover:border-primary hover:bg-primary/5">
                    <div>
                      <p className="font-medium">{e.nome_fantasia}</p>
                      <p className="text-xs text-muted-foreground">{e.lojas.length} loja(s) • papel: {e.role_na_empresa}</p>
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">{e.ativo ? "ativa" : "inativa"}</span>
                  </button>
                ))}
                {empresas.length === 0 && (
                  <div className="space-y-3 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                    <p>
                      Você ainda não está vinculado a nenhuma empresa.
                      {isGlobalAdmin
                        ? " Como administrador, você pode criar a primeira empresa agora."
                        : " Peça a um administrador para vincular seu usuário."}
                    </p>
                    {isGlobalAdmin && (
                      <Button className="w-full" onClick={() => router.navigate({ to: "/configuracoes" })}>
                        Ir para Configurações
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}