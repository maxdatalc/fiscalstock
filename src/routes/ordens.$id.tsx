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

  // TODO CLAUDE: substituir por chamada real à MaxAPI (GET O.S. por id).
  useEffect(() => {
    setLoading(true);
    serviceOrderService
      .get(id)
      .then((r) => {
        setOs(r);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id, reload]);

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
              A consulta detalhada por ID ainda não está disponível — aguardando integração definitiva com a MaxAPI.
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

  return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => router.history.back()} className="-ml-3">
          <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
        </Button>

        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{os.numero}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Cliente <span className="font-medium text-foreground">{os.cliente}</span> • Placa <span className="font-mono">{os.placa}</span> • {new Date(os.data).toLocaleDateString("pt-BR")}
            </p>
            <Badge variant="outline" className="mt-2">{os.status}</Badge>
          </div>
          <Button onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" /> Adicionar item</Button>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Itens da O.S</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {os.itens.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell className="font-mono text-sm">{it.codigo}</TableCell>
                    <TableCell>{it.produtoNome}</TableCell>
                    <TableCell className="text-right tabular-nums">{it.quantidade}</TableCell>
                  </TableRow>
                ))}
                {os.itens.length === 0 && (
                  <TableRow><TableCell colSpan={3} className="py-6 text-center text-sm text-muted-foreground">Nenhum item adicionado.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <ServiceOrderItemEditor
          open={open}
          onOpenChange={setOpen}
          empresaId={os.empresaId}
          onAdd={(item) => submitAdd(item, false)}
        />

        <AlertDialog
          open={!!confirmacao}
          onOpenChange={(o) => !o && setConfirmacao(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" /> Confirmar inclusão com risco fiscal
              </AlertDialogTitle>
              <AlertDialogDescription>
                {confirmacao?.alerta} Deseja prosseguir mesmo assim? Esta ação será registrada no log de auditoria.
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