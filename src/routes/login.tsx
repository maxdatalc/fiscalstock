import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Boxes, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listarEmpresas } from "@/lib/services/integration.service";
import { setEmpresa, setUser, getUser } from "@/lib/session";
import type { Empresa } from "@/lib/types";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Entrar — FiscalStock MaxData" }] }),
  component: LoginPage,
});

function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@maxdata.com.br");
  const [senha, setSenha] = useState("admin");
  const [step, setStep] = useState<"login" | "empresa">("login");
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (getUser()) {
      listarEmpresas().then((es) => {
        setEmpresas(es);
        setStep("empresa");
      });
    }
  }, []);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await new Promise((r) => setTimeout(r, 400));
    setUser({ nome: email.split("@")[0], email });
    const es = await listarEmpresas();
    setEmpresas(es);
    if (es.length === 1) {
      setEmpresa(es[0]);
      router.navigate({ to: "/dashboard" });
    } else {
      setStep("empresa");
    }
    setLoading(false);
  }

  function escolherEmpresa(e: Empresa) {
    setEmpresa(e);
    router.navigate({ to: "/dashboard" });
  }

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
                <h2 className="text-2xl font-semibold">Entrar</h2>
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
                {loading ? "Entrando..." : "Entrar"}
              </Button>
            </form>
          ) : (
            <div className="space-y-5">
              <div>
                <h2 className="text-2xl font-semibold">Escolha a loja</h2>
                <p className="mt-1 text-sm text-muted-foreground">Selecione a empresa/loja em que vai operar.</p>
              </div>
              <div className="space-y-2">
                {empresas.map((e) => (
                  <button key={e.id} onClick={() => escolherEmpresa(e)}
                    className="flex w-full items-center justify-between rounded-md border p-4 text-left transition-colors hover:border-primary hover:bg-primary/5">
                    <div>
                      <p className="font-medium">{e.nome}</p>
                      <p className="text-xs text-muted-foreground">empId {e.empId} • Terminal {e.terminal}</p>
                    </div>
                    <span className={`text-xs font-medium ${
                      e.statusConexao === "online" ? "text-[color:var(--success)]" :
                      e.statusConexao === "instavel" ? "text-[color:oklch(0.55_0.17_70)]" : "text-destructive"
                    }`}>{e.statusConexao}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}