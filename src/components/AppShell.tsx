import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Boxes, LayoutDashboard, ClipboardList, Settings, LogOut, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth-context";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/ordens", label: "Ordens de Serviço", icon: ClipboardList },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, empresas, empresaAtiva, lojaAtiva, setEmpresaAtiva, setLojaAtiva, signOut, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) router.navigate({ to: "/login" });
  }, [user, loading, router]);

  async function logout() { await signOut(); router.navigate({ to: "/login" }); }

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
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  <span className="max-w-[220px] truncate">{empresaAtiva?.nome_fantasia ?? "Empresa"}</span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-72">
                <DropdownMenuLabel>Empresas</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {empresas.length === 0 && (
                  <p className="px-2 py-2 text-xs text-muted-foreground">Nenhuma empresa vinculada</p>
                )}
                {empresas.map((e) => (
                  <DropdownMenuItem key={e.id} onClick={() => setEmpresaAtiva(e.id)}>
                    <div>
                      <p className="text-sm font-medium">{e.nome_fantasia}</p>
                      <p className="text-xs text-muted-foreground">{e.lojas.length} loja(s) • {e.role_na_empresa}</p>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {empresaAtiva && empresaAtiva.lojas.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <span className="max-w-[200px] truncate">{lojaAtiva?.nome ?? "Loja"}</span>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                  <DropdownMenuLabel>Lojas</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {empresaAtiva.lojas.map((l) => (
                    <DropdownMenuItem key={l.id} onClick={() => setLojaAtiva(l.id)}>
                      <div>
                        <p className="text-sm font-medium">{l.nome}</p>
                        <p className="text-xs text-muted-foreground">empId {l.emp_id_maxdata} • term {l.terminal_maxdata}</p>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {(user?.nome ?? "U")[0]?.toUpperCase()}
                </div>
                <div className="hidden text-left sm:block">
                  <p className="text-sm font-medium leading-tight">{user?.nome ?? "Usuário"}</p>
                  <p className="text-xs text-muted-foreground leading-tight">{user?.email ?? ""} • {user?.role ?? ""}</p>
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