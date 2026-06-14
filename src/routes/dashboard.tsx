import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ProductSearch } from "@/components/ProductSearch";
import { StockComparisonCard } from "@/components/StockComparisonCard";
import { FiscalPhysicalBadge } from "@/components/FiscalPhysicalBadge";
import { RequireLoja } from "@/components/RequireLoja";
import { IntegrationStatusBanner } from "@/components/IntegrationStatusBanner";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Package, AlertTriangle, Ban, ClipboardList } from "lucide-react";
import { stockService } from "@/lib/services/stock-adapter";
import { serviceOrderService } from "@/lib/services/service-order-adapter";
import { calcularStatusFiscal, type Produto } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — FiscalStock MaxData" }] }),
  component: Dashboard,
});

function Dashboard() {
  return (
    <AppShell>
      <RequireLoja>
        <DashboardContent />
      </RequireLoja>
    </AppShell>
  );
}

function DashboardContent() {
  const { lojaAtiva, empresaAtiva } = useAuth();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [busca, setBusca] = useState("");
  const [osAbertas, setOsAbertas] = useState(0);

  // TODO CLAUDE:
  // substituir este adapter pelo ServerStockService real assim que a Bridge SQL
  // estiver disponível com queryName + params seguros. Respeitar lojaAtiva.emp_id_maxdata.
  useEffect(() => {
    if (!lojaAtiva) return;
    stockService.search(lojaAtiva.id, busca).then(setProdutos).catch(console.error);
    serviceOrderService
      .list(lojaAtiva.id)
      .then((o) => setOsAbertas(o.filter((x) => x.status === "aberta" || x.status === "em_andamento").length))
      .catch(console.error);
  }, [busca, lojaAtiva?.id]);

  const stats = useMemo(() => {
    const fiscalMenor = produtos.filter((p) => p.estoqueFiscal < p.estoqueFisico).length;
    const semFiscal = produtos.filter((p) => p.estoqueFiscal <= 0).length;
    return { total: produtos.length, fiscalMenor, semFiscal };
  }, [produtos]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Visão consolidada do estoque físico vs. fiscal — {empresaAtiva?.nome_fantasia} / {lojaAtiva?.nome}
        </p>
      </div>

      <IntegrationStatusBanner />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StockComparisonCard label="Produtos consultados" value={stats.total} icon={<Package className="h-4 w-4" />} />
          <StockComparisonCard label="Fiscal menor que físico" value={stats.fiscalMenor} tone="warning" icon={<AlertTriangle className="h-4 w-4" />} />
          <StockComparisonCard label="Sem saldo fiscal" value={stats.semFiscal} tone="danger" icon={<Ban className="h-4 w-4" />} />
          <StockComparisonCard label="O.S abertas" value={osAbertas} tone="primary" icon={<ClipboardList className="h-4 w-4" />} />
      </div>

      <div className="rounded-lg border bg-card p-5">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h2 className="text-base font-semibold">Produtos</h2>
            <div className="md:w-96">
              <ProductSearch value={busca} onChange={setBusca} />
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Físico</TableHead>
                  <TableHead className="text-right">Fiscal</TableHead>
                  <TableHead className="text-right">Diferença</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {produtos.map((p) => {
                  const dif = p.estoqueFisico - p.estoqueFiscal;
                  const status = calcularStatusFiscal(p);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-sm">{p.codigo}</TableCell>
                      <TableCell>
                        <p className="font-medium">{p.nome}</p>
                        <p className="text-xs text-muted-foreground">EAN {p.codigoBarras}</p>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{p.estoqueFisico}</TableCell>
                      <TableCell className="text-right tabular-nums">{p.estoqueFiscal}</TableCell>
                      <TableCell className={`text-right tabular-nums ${dif > 0 ? "text-destructive font-medium" : ""}`}>
                        {dif > 0 ? `+${dif}` : dif}
                      </TableCell>
                      <TableCell><FiscalPhysicalBadge status={status} /></TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="outline">
                          <Link to="/produto/$id" params={{ id: p.id }}>Detalhes</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {produtos.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">Nenhum produto encontrado.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
      </div>
    </div>
  );
}