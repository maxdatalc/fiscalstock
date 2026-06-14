import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Boxes, LayoutDashboard, ClipboardList, Settings, LogOut, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { clearSession, getEmpresa, getUser, setEmpresa } from "@/lib/session";
import { listarEmpresas } from "@/lib/services/integration.service";
import type { Empresa } from "@/lib/types";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/ordens", label: "Ordens de Serviço", icon: ClipboardList },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresa, setEmp] = useState<Empresa | null>(null);
  const [user, setU] = useState<{ nome: string; email: string } | null>(null);

  useEffect(() => {
    const u = getUser();
    setU(u);
    setEmp(getEmpresa());
    listarEmpresas().then(setEmpresas);
    if (!u) router.navigate({ to: "/login" });
  }, [router]);

  function trocarEmpresa(e: Empresa) { setEmpresa(e); setEmp(e); }
  function logout() { clearSession(); router.navigate({ to: "/login" }); }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-60 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Boxes className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">FiscalStock</p>
            <p className="text-[10px] uppercase tracking-wider text-sidebar-foreground/60">MaxData</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-2">
          {nav.map((n) => {
            const active = pathname.startsWith(n.to);
            const Icon = n.icon;
            return (
              <Link key={n.to} to={n.to}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  active ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-3 text-xs text-sidebar-foreground/60">
          v1.0 • Bridge SQL + MaxAPI
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b bg-card px-6 py-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <span className="h-2 w-2 rounded-full bg-primary" />
                <span className="max-w-[220px] truncate">{empresa?.nome ?? "Selecionar empresa"}</span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72">
              <DropdownMenuLabel>Empresas / Lojas</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {empresas.map((e) => (
                <DropdownMenuItem key={e.id} onClick={() => trocarEmpresa(e)}>
                  <div>
                    <p className="text-sm font-medium">{e.nome}</p>
                    <p className="text-xs text-muted-foreground">empId {e.empId} • {e.statusConexao}</p>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {(user?.nome ?? "U")[0]?.toUpperCase()}
                </div>
                <div className="hidden text-left sm:block">
                  <p className="text-sm font-medium leading-tight">{user?.nome ?? "Usuário"}</p>
                  <p className="text-xs text-muted-foreground leading-tight">{user?.email ?? ""}</p>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={logout}>
                <LogOut className="mr-2 h-4 w-4" /> Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}