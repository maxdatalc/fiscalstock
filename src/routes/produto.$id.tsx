import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { StockComparisonCard } from "@/components/StockComparisonCard";
import { FiscalPhysicalBadge } from "@/components/FiscalPhysicalBadge";
import { RequireLoja } from "@/components/RequireLoja";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ChevronLeft, Plus } from "lucide-react";
import { stockService } from "@/lib/services/stock-adapter";
import type { ProductStockDetail } from "@/lib/api/stock.functions";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/produto/$id")({
  head: () => ({ meta: [{ title: "Detalhe do produto — FiscalStock" }] }),
  component: ProdutoDetalhe,
});

function ProdutoDetalhe() {
  return (
    <AppShell>
      <RequireLoja>
        <ProdutoDetalheContent />
      </RequireLoja>
    </AppShell>
  );
}

function ProdutoDetalheContent() {
  const { id } = Route.useParams();
  const router = useRouter();
  const { lojaAtiva } = useAuth();
  const [d, setD] = useState<ProductStockDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // TODO CLAUDE:
  // substituir este mock por chamada real à Bridge SQL usando queryName + params.
  // não usar SQL livre. respeitar lojaAtiva.emp_id_maxdata.
  useEffect(() => {
    if (!lojaAtiva) return;
    setLoading(true);
    stockService.detail(lojaAtiva.id, id).then((r) => { setD(r); setLoading(false); }).catch((e) => {
      console.error(e); setLoading(false);
    });
  }, [id, lojaAtiva?.id]);

  if (loading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (!d) return <p className="text-sm text-muted-foreground">Produto não encontrado nesta loja.</p>;

  const p = d.produto;
  const c = d.composicao_estoque_fiscal;

  return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => router.history.back()} className="-ml-3">
          <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
        </Button>

        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{p.nome}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Código <span className="font-mono">{p.codigo}</span> • EAN <span className="font-mono">{p.codigoBarras}</span> • Unidade {p.unidade}
            </p>
            <div className="mt-2"><FiscalPhysicalBadge status={d.status_risco} /></div>
          </div>
          <Button asChild>
            <Link to="/ordens"><Plus className="mr-1 h-4 w-4" /> Adicionar em O.S</Link>
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StockComparisonCard label="Estoque físico" value={d.estoque_fisico} />
          <StockComparisonCard label="Estoque fiscal" value={d.estoque_fiscal} tone={d.estoque_fiscal <= 0 ? "danger" : "default"} />
          <StockComparisonCard label="Diferença físico × fiscal" value={d.diferenca > 0 ? `+${d.diferenca}` : d.diferenca} tone={d.diferenca > 0 ? "warning" : "default"} hint="Físico − Fiscal" />
          <StockComparisonCard label="Disponível p/ emitir" value={d.disponivel_para_emissao} tone="primary" hint="Considera reservas em O.S" />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Composição do estoque fiscal</CardTitle>
                <Badge variant="outline" className="border-[color:var(--warning)]/40 text-[color:oklch(0.45_0.15_70)]">
                  Simulado • aguardando mapeamento SQL
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-xs text-muted-foreground">
                ⚠️ Os valores abaixo são <strong>simulados</strong>. A fórmula fiscal definitiva
                será validada pelo Claude Code junto ao MaxManager.
              </p>
              {c ? (
                <dl className="divide-y text-sm">
                  <Row label="Inventário fiscal base" v={c.inventario_base} />
                  <Row label="(+) Entradas fiscais" v={c.entradas} tone="success" />
                  <Row label="(−) Saídas fiscais" v={-c.saidas} tone="danger" />
                  <Row label="(+) Devoluções" v={c.devolucoes} tone="success" />
                  <Row label="(±) Ajustes fiscais" v={c.ajustes} />
                  <div className="flex items-center justify-between pt-3 font-semibold">
                    <span>Saldo fiscal calculado</span>
                    <span className="tabular-nums">{d.estoque_fiscal}</span>
                  </div>
                </dl>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Composição do estoque fiscal indisponível — aguardando validação.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Riscos</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {d.alertas.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum risco identificado para este item.</p>
              )}
              {d.alertas.map((r, i) => (
                <div key={i} className={`flex gap-2 rounded-md border p-3 text-sm ${
                  r.tipo === "danger"
                    ? "border-destructive/40 bg-destructive/5 text-destructive"
                    : "border-[color:var(--warning)]/40 bg-[color:var(--warning)]/10 text-[color:oklch(0.45_0.15_70)]"
                }`}>
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <p>{r.mensagem}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
  );
}

function Row({ label, v, tone }: { label: string; v: number; tone?: "success" | "danger" }) {
  const cls = tone === "success" ? "text-[color:var(--success)]" : tone === "danger" ? "text-destructive" : "text-foreground";
  return (
    <div className="flex items-center justify-between py-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`tabular-nums font-medium ${cls}`}>{v > 0 && tone === "success" ? `+${v}` : v}</dd>
    </div>
  );
}