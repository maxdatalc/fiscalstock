import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { StockComparisonCard } from "@/components/StockComparisonCard";
import { FiscalPhysicalBadge } from "@/components/FiscalPhysicalBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, ChevronLeft, Plus } from "lucide-react";
import { buscarProduto } from "@/lib/services/stock.service";
import { calcularStatusFiscal, disponivelParaEmissao, type Produto } from "@/lib/types";

export const Route = createFileRoute("/produto/$id")({
  head: () => ({ meta: [{ title: "Detalhe do produto — FiscalStock" }] }),
  component: ProdutoDetalhe,
});

function ProdutoDetalhe() {
  const { id } = Route.useParams();
  const router = useRouter();
  const [p, setP] = useState<Produto | null>(null);

  useEffect(() => { buscarProduto(id).then(setP); }, [id]);

  if (!p) return <AppShell><p className="text-sm text-muted-foreground">Carregando...</p></AppShell>;

  const status = calcularStatusFiscal(p);
  const disp = disponivelParaEmissao(p);
  const dif = p.estoqueFisico - p.estoqueFiscal;
  const c = p.composicaoFiscal;

  const riscos: { tipo: "danger" | "warning"; msg: string }[] = [];
  if (p.estoqueFisico > p.estoqueFiscal) riscos.push({ tipo: "warning", msg: `Estoque físico (${p.estoqueFisico}) é maior que o fiscal (${p.estoqueFiscal}). Risco de emitir sem cobertura fiscal.` });
  if (p.estoqueFiscal <= 0) riscos.push({ tipo: "danger", msg: "Estoque fiscal zerado ou negativo. Não é possível emitir nota fiscalmente." });
  if (p.reservadoEmOS > 0) riscos.push({ tipo: "warning", msg: `Existem ${p.reservadoEmOS} unidade(s) reservadas em O.S aberta.` });

  return (
    <AppShell>
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
            <div className="mt-2"><FiscalPhysicalBadge status={status} /></div>
          </div>
          <Button asChild>
            <Link to="/ordens"><Plus className="mr-1 h-4 w-4" /> Adicionar em O.S</Link>
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StockComparisonCard label="Estoque físico" value={p.estoqueFisico} />
          <StockComparisonCard label="Estoque fiscal" value={p.estoqueFiscal} tone={p.estoqueFiscal <= 0 ? "danger" : "default"} />
          <StockComparisonCard label="Diferença físico × fiscal" value={dif > 0 ? `+${dif}` : dif} tone={dif > 0 ? "warning" : "default"} hint="Físico − Fiscal" />
          <StockComparisonCard label="Disponível p/ emitir" value={disp} tone="primary" hint="Considera reservas em O.S" />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Composição do estoque fiscal</CardTitle></CardHeader>
            <CardContent>
              <dl className="divide-y text-sm">
                <Row label="Inventário fiscal base" v={c.inventarioBase} />
                <Row label="(+) Entradas fiscais" v={c.entradas} tone="success" />
                <Row label="(−) Saídas fiscais" v={-c.saidas} tone="danger" />
                <Row label="(+) Devoluções" v={c.devolucoes} tone="success" />
                <Row label="(±) Ajustes fiscais" v={c.ajustes} />
                <div className="flex items-center justify-between pt-3 font-semibold">
                  <span>Saldo fiscal calculado</span>
                  <span className="tabular-nums">{p.estoqueFiscal}</span>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Riscos</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {riscos.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum risco identificado para este item.</p>
              )}
              {riscos.map((r, i) => (
                <div key={i} className={`flex gap-2 rounded-md border p-3 text-sm ${
                  r.tipo === "danger"
                    ? "border-destructive/40 bg-destructive/5 text-destructive"
                    : "border-[color:var(--warning)]/40 bg-[color:var(--warning)]/10 text-[color:oklch(0.45_0.15_70)]"
                }`}>
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <p>{r.msg}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
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