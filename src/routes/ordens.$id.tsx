import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RequireLoja } from "@/components/RequireLoja";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ChevronLeft, Plus } from "lucide-react";
import { serviceOrderService } from "@/lib/services/service-order-adapter";
import { ServiceOrderItemEditor } from "@/components/ServiceOrderItemEditor";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import type { OrdemServico } from "@/lib/types";

export const Route = createFileRoute("/ordens/$id")({
  head: () => ({ meta: [{ title: "O.S — FiscalStock" }] }),
  component: OSDetail,
});

const statusLabel: Record<OrdemServico["status"], { label: string; cls: string }> = {
  aberta: { label: "Aberta", cls: "bg-primary/10 text-primary border-primary/20" },
  em_andamento: {
    label: "Em andamento",
    cls: "bg-[color:var(--warning)]/15 text-[color:oklch(0.5_0.15_70)] border-[color:var(--warning)]/30",
  },
  faturada: {
    label: "Faturada",
    cls: "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30",
  },
  cancelada: { label: "Cancelada", cls: "bg-muted text-muted-foreground border-border" },
};

function OSDetail() {
  return (
    <AppShell>
      <RequireLoja>
        <OSDetailContent />
      </RequireLoja>
    </AppShell>
  );
}

function OSDetailContent() {
  const { id } = Route.useParams();
  const router = useRouter();
  const { lojaAtiva } = useAuth();
  const [os, setOs] = useState<OrdemServico | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [reload, setReload] = useState(0);
  const [confirmacao, setConfirmacao] = useState<
    | {
        alerta: string;
        item: { produtoId: string; produtoNome: string; codigo: string; quantidade: number };
      }
    | null
  >(null);

  useEffect(() => {
    if (!lojaAtiva) return;
    setLoading(true);
    serviceOrderService
      .get(id, lojaAtiva.id)
      .then((r) => {
        setOs(r);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id, lojaAtiva?.id, reload]);

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-6 w-48 animate-pulse rounded bg-muted" />
        <div className="h-4 w-72 animate-pulse rounded bg-muted" />
        <div className="h-40 w-full animate-pulse rounded bg-muted" />
      </div>
    );
  }

  if (!os) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.history.back()} className="-ml-3">
          <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
        </Button>
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm font-medium">Ordem de serviço não encontrada</p>
            <p className="mt-1 text-xs text-muted-foreground">
              O.S #{id} não existe nesta loja ou foi excluída.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const submitAdd = async (
    item: { produtoId: string; produtoNome: string; codigo: string; quantidade: number },
    forcar: boolean,
  ) => {
    try {
      const r = await serviceOrderService.addItem({
        loja_id: lojaAtiva?.id,
        os_id: os.id,
        produto_id: item.produtoId,
        quantidade: item.quantidade,
        forcar_sem_fiscal: forcar,
      });
      if (r.ok) {
        toast.success(r.alerta ? `Item adicionado. ${r.alerta}` : "Item adicionado à O.S.");
        setReload((x) => x + 1);
        setConfirmacao(null);
        return;
      }
      if (r.excedeu_fiscal) {
        setConfirmacao({ alerta: r.alerta ?? "Estoque fiscal insuficiente.", item });
        return;
      }
      toast.error(r.alerta ?? "Operação bloqueada pelo controle fiscal.");
      setConfirmacao(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao adicionar item.");
      setConfirmacao(null);
    }
  };

  const s = statusLabel[os.status] ?? statusLabel.aberta;
  const totalItens = os.itens.reduce((acc, it) => acc + (it.total ?? 0), 0);

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.history.back()} className="-ml-3">
        <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
      </Button>

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">O.S {os.numero}</h1>
            <Badge variant="outline" className={s.cls}>
              {s.label}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Cliente <span className="font-medium text-foreground">{os.cliente}</span>
            {os.placa && (
              <>
                {" "}• Placa <span className="font-mono text-foreground">{os.placa}</span>
              </>
            )}
            {(os.equipamento || os.marca) && (
              <>
                {" "}•{" "}
                <span className="text-foreground">
                  {[os.marca, os.equipamento].filter(Boolean).join(" ")}
                </span>
              </>
            )}
            {" "}• {new Date(os.data).toLocaleDateString("pt-BR")}
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-1 h-4 w-4" /> Adicionar item
        </Button>
      </div>

      {(os.defeito || os.obs || os.laudoTec || os.equipamento || os.marca) && (
        <Card>
          <CardContent className="grid gap-4 pt-4 sm:grid-cols-2 lg:grid-cols-4">
            {(os.equipamento || os.marca) && (
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Equipamento
                </p>
                <p className="text-sm font-medium">
                  {[os.marca, os.equipamento].filter(Boolean).join(" — ")}
                </p>
              </div>
            )}
            {os.defeito && (
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Defeito reclamado
                </p>
                <p className="text-sm">{os.defeito}</p>
              </div>
            )}
            {os.laudoTec && (
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Laudo técnico
                </p>
                <p className="text-sm">{os.laudoTec}</p>
              </div>
            )}
            {os.obs && (
              <div className="sm:col-span-2 lg:col-span-1">
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Observações
                </p>
                <p className="max-h-24 overflow-y-auto whitespace-pre-wrap text-sm text-muted-foreground">
                  {os.obs}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Itens da O.S</CardTitle>
          {os.itens.length > 0 && (
            <span className="text-sm text-muted-foreground">
              {os.itens.length} {os.itens.length === 1 ? "item" : "itens"}
              {totalItens > 0 && (
                <>
                  {" "}•{" "}
                  <span className="font-medium text-foreground">
                    {totalItens.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </span>
                </>
              )}
            </span>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Código</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead className="w-16 text-right">Un</TableHead>
                <TableHead className="w-24 text-right">Qtde</TableHead>
                <TableHead className="w-32 text-right">Preço unit.</TableHead>
                <TableHead className="w-32 text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {os.itens.map((it) => (
                <TableRow key={it.id}>
                  <TableCell className="font-mono text-sm">{it.codigo}</TableCell>
                  <TableCell>{it.produtoNome}</TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {it.unidade ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{it.quantidade}</TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {it.precoUnitario != null
                      ? it.precoUnitario.toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm font-medium">
                    {it.total != null
                      ? it.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
              {os.itens.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-6 text-center text-sm text-muted-foreground"
                  >
                    Nenhum item adicionado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ServiceOrderItemEditor
        open={open}
        onOpenChange={setOpen}
        empresaId={lojaAtiva?.id}
        onAdd={(item) => submitAdd(item, false)}
      />

      <AlertDialog open={!!confirmacao} onOpenChange={(o) => !o && setConfirmacao(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Confirmar inclusão com risco fiscal
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmacao?.alerta} Deseja prosseguir mesmo assim? Esta ação será registrada no log
              de auditoria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmacao && submitAdd(confirmacao.item, true)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Prosseguir mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
