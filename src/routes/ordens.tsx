import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ServiceOrderList } from "@/components/ServiceOrderList";
import { RequireLoja } from "@/components/RequireLoja";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { serviceOrderService } from "@/lib/services/service-order-adapter";
import { useAuth } from "@/lib/auth-context";
import type { OrdemServico } from "@/lib/types";

export const Route = createFileRoute("/ordens")({
  head: () => ({ meta: [{ title: "Ordens de Serviço — FiscalStock" }] }),
  component: OrdensLayout,
});

function OrdensLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname !== "/ordens") return <Outlet />;
  return <OrdensIndex />;
}

function OrdensIndex() {
  const { lojaAtiva } = useAuth();
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [loading, setLoading] = useState(true);
  const [cliente, setCliente] = useState("");
  const [placa, setPlaca] = useState("");
  const [status, setStatus] = useState<string>("todas");

  useEffect(() => {
    if (!lojaAtiva) return;
    setLoading(true);
    serviceOrderService
      .list(lojaAtiva.id)
      .then(setOrdens)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [lojaAtiva?.id]);

  const filtradas = ordens.filter(
    (o) =>
      (cliente ? o.cliente.toLowerCase().includes(cliente.toLowerCase()) : true) &&
      (placa ? o.placa.toLowerCase().includes(placa.toLowerCase()) : true) &&
      (status !== "todas" ? o.status === status : true),
  );

  return (
    <AppShell>
      <RequireLoja>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Ordens de Serviço</h1>
              <p className="text-sm text-muted-foreground">
                Gerencie O.S e adicione itens com checagem fiscal.
              </p>
            </div>
            <Button>
              <Plus className="mr-1 h-4 w-4" /> Nova O.S
            </Button>
          </div>

          <div className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-4">
            <Input
              placeholder="Cliente"
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
            />
            <Input
              placeholder="Placa"
              value={placa}
              onChange={(e) => setPlaca(e.target.value)}
            />
            <div />
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todos os status</SelectItem>
                <SelectItem value="aberta">Aberta</SelectItem>
                <SelectItem value="faturada">Faturada</SelectItem>
                <SelectItem value="cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-md bg-muted" />
              ))}
            </div>
          ) : (
            <>
              {ordens.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {filtradas.length === ordens.length
                    ? `${ordens.length} ordens`
                    : `${filtradas.length} de ${ordens.length} ordens`}
                </p>
              )}
              <ServiceOrderList ordens={filtradas} />
            </>
          )}
        </div>
      </RequireLoja>
    </AppShell>
  );
}