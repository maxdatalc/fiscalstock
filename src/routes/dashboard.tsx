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
import { Package, ClipboardList, Info } from "lucide-react";
import { stockService } from "@/lib/services/stock-adapter";
import { serviceOrderService } from "@/lib/services/service-order-adapter";
import type { Produto } from "@/lib/types";
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
  const [loadingProdutos, setLoadingProdutos] = useState(false);
  const [osAbertas, setOsAbertas] = useState(0);

  // TODO CLAUDE:
  // substituir este adapter pelo ServerStockService real assim que a Bridge SQL
  // estiver disponível com queryName + params seguros. Respeitar lojaAtiva.emp_id_maxdata.
  useEffect(() => {
    if (!lojaAtiva) return;
    setLoadingProdutos(true);
    stockService.search(lojaAtiva.id, busca)
      .then(setProdutos)
      .catch(console.error)
      .finally(() => setLoadingProdutos(false));
    serviceOrderService
      .list(lojaAtiva.id)
      .then((o) => setOsAbertas(o.filter((x) => x.status === "aberta" || x.status === "em_andamento").length))
      .catch(console.error);
  }, [busca, lojaAtiva?.id]);

  const stats = useMemo(() => ({
    total: produtos.length,
  }), [produtos]);

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
        <StockComparisonCard label="Produtos na busca" value={stats.total} icon={<Package className="h-4 w-4" />} />
        <StockComparisonCard label="O.S abertas" value={osAbertas} tone="primary" icon={<ClipboardList className="h-4 w-4" />} />
      </div>

      <div className="rounded-lg border bg-card p-5">
          <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-base font-semibold">Busca de produtos</h2>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <Info className="h-3 w-3" />
                Estoque físico vem do ERP em tempo real. Estoque fiscal é calculado ao abrir o produto.
              </p>
            </div>
            <div className="md:w-96">
              <ProductSearch value={busca} onChange={setBusca} />
            </div>
          </div>
          {loadingProdutos ? (
            <div className="space-y-2 pt-1">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-9 w-24 animate-pulse rounded bg-muted" />
                  <div className="h-9 flex-1 animate-pulse rounded bg-muted" />
                  <div className="h-9 w-10 animate-pulse rounded bg-muted" />
                  <div className="h-9 w-20 animate-pulse rounded bg-muted" />
                  <div className="h-9 w-32 animate-pulse rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Código</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="w-16">Un</TableHead>
                  <TableHead className="w-32 text-right">Estoque físico</TableHead>
                  <TableHead className="w-32 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {produtos.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-sm">{p.codigo}</TableCell>
                    <TableCell className="font-medium">{p.nome}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.unidade}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{p.estoqueFisico}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link to="/produto/$id" params={{ id: p.id }}>Ver estoque fiscal</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {produtos.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                      {busca ? "Nenhum produto encontrado." : "Digite o nome ou código do produto para buscar."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          )}
      </div>
    </div>
  );
}