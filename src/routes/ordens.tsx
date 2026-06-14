import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ServiceOrderList } from "@/components/ServiceOrderList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { listarOrdens } from "@/lib/services/service-order.service";
import { getEmpresa } from "@/lib/session";
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
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [cliente, setCliente] = useState("");
  const [placa, setPlaca] = useState("");
  const [status, setStatus] = useState<string>("todas");
  const empresa = typeof window !== "undefined" ? getEmpresa() : null;

  useEffect(() => { listarOrdens(empresa?.id).then(setOrdens); }, [empresa?.id]);

  const filtradas = ordens.filter((o) =>
    (cliente ? o.cliente.toLowerCase().includes(cliente.toLowerCase()) : true) &&
    (placa ? o.placa.toLowerCase().includes(placa.toLowerCase()) : true) &&
    (status !== "todas" ? o.status === status : true)
  );

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Ordens de Serviço</h1>
            <p className="text-sm text-muted-foreground">Gerencie O.S e adicione itens com checagem fiscal.</p>
          </div>
          <Button><Plus className="mr-1 h-4 w-4" /> Nova O.S</Button>
        </div>

        <div className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-4">
          <Input placeholder="Cliente" value={cliente} onChange={(e) => setCliente(e.target.value)} />
          <Input placeholder="Placa" value={placa} onChange={(e) => setPlaca(e.target.value)} />
          <Input type="date" />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todos os status</SelectItem>
              <SelectItem value="aberta">Aberta</SelectItem>
              <SelectItem value="em_andamento">Em andamento</SelectItem>
              <SelectItem value="faturada">Faturada</SelectItem>
              <SelectItem value="cancelada">Cancelada</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <ServiceOrderList ordens={filtradas} />
      </div>
    </AppShell>
  );
}