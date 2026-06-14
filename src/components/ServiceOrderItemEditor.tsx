import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ProductSearch } from "./ProductSearch";
import { stockService } from "@/lib/services/stock-adapter";
import { disponivelParaEmissao, type Produto } from "@/lib/types";
import { AlertTriangle } from "lucide-react";

export function ServiceOrderItemEditor({
  open, onOpenChange, empresaId, onAdd,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  empresaId?: string;
  onAdd: (item: { produtoId: string; produtoNome: string; codigo: string; quantidade: number }) => void;
}) {
  const [busca, setBusca] = useState("");
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [selecionado, setSelecionado] = useState<Produto | null>(null);
  const [qtd, setQtd] = useState(1);

  useEffect(() => {
    if (!open) return;
    // TODO CLAUDE: respeitar lojaAtiva; substituir por consulta real Bridge SQL.
    stockService.search(empresaId, busca).then(setProdutos).catch(console.error);
  }, [busca, empresaId, open]);

  useEffect(() => {
    if (!open) { setBusca(""); setSelecionado(null); setQtd(1); }
  }, [open]);

  const disponivel = selecionado ? disponivelParaEmissao(selecionado) : 0;
  const excedeFiscal = selecionado ? qtd > selecionado.estoqueFiscal : false;
  const excedeFisico = selecionado ? qtd > selecionado.estoqueFisico : false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Adicionar item à O.S</DialogTitle>
          <DialogDescription>
            Confira sempre o estoque fiscal antes de adicionar para evitar bloqueios na emissão.
          </DialogDescription>
        </DialogHeader>

        {!selecionado ? (
          <div className="space-y-3">
            <ProductSearch value={busca} onChange={setBusca} />
            <div className="max-h-72 overflow-y-auto rounded-md border">
              {produtos.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelecionado(p)}
                  className="flex w-full items-center justify-between border-b px-3 py-2 text-left text-sm hover:bg-secondary last:border-b-0"
                >
                  <div>
                    <p className="font-medium">{p.nome}</p>
                    <p className="text-xs text-muted-foreground">{p.codigo} • EAN {p.codigoBarras}</p>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Físico <span className="font-mono text-foreground">{p.estoqueFisico}</span> •
                    Fiscal <span className="font-mono text-foreground"> {p.estoqueFiscal}</span>
                  </div>
                </button>
              ))}
              {produtos.length === 0 && (
                <p className="p-4 text-center text-sm text-muted-foreground">Nenhum produto.</p>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md border bg-secondary/50 p-3">
              <p className="font-medium">{selecionado.nome}</p>
              <p className="text-xs text-muted-foreground">{selecionado.codigo} • {selecionado.unidade}</p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Físico</p>
                <p className="text-lg font-semibold tabular-nums">{selecionado.estoqueFisico}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Fiscal</p>
                <p className="text-lg font-semibold tabular-nums">{selecionado.estoqueFiscal}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Disponível p/ emitir</p>
                <p className="text-lg font-semibold tabular-nums text-primary">{disponivel}</p>
              </div>
            </div>
            <div>
              <Label htmlFor="qtd">Quantidade</Label>
              <Input id="qtd" type="number" min={1} value={qtd}
                onChange={(e) => setQtd(Math.max(1, Number(e.target.value)))} />
            </div>
            {excedeFiscal && (
              <div className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <p><strong>Atenção fiscal:</strong> a quantidade informada pode não estar disponível para emissão fiscal. Físico: {selecionado.estoqueFisico}, fiscal: {selecionado.estoqueFiscal}.</p>
              </div>
            )}
            {!excedeFiscal && excedeFisico && (
              <div className="rounded-md border border-[color:var(--warning)]/40 bg-[color:var(--warning)]/10 p-3 text-sm text-[color:oklch(0.45_0.15_70)]">
                A quantidade excede o estoque físico atual.
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {selecionado && (<Button variant="ghost" onClick={() => setSelecionado(null)}>Voltar</Button>)}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            disabled={!selecionado || qtd < 1}
            onClick={() => {
              if (!selecionado) return;
              onAdd({ produtoId: selecionado.id, produtoNome: selecionado.nome, codigo: selecionado.codigo, quantidade: qtd });
              onOpenChange(false);
            }}
          >
            Adicionar item
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}