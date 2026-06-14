import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RequireLoja } from "@/components/RequireLoja";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Plus } from "lucide-react";
import { serviceOrderService } from "@/lib/services/service-order-adapter";
import { ServiceOrderItemEditor } from "@/components/ServiceOrderItemEditor";
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
  const [open, setOpen] = useState(false);
  const [reload, setReload] = useState(0);

  // TODO CLAUDE: substituir por chamada real à MaxAPI (GET O.S. por id).
  useEffect(() => { serviceOrderService.get(id).then(setOs); }, [id, reload]);

  if (!os) return <p className="text-sm text-muted-foreground">Carregando...</p>;

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
          onAdd={async (item) => {
            // TODO CLAUDE:
            // substituir simulação por chamada real à MaxAPI.
            // escritas em O.S. devem ser feitas somente pela MaxAPI, nunca via SQL direto.
            await serviceOrderService.addItem({
              loja_id: lojaAtiva?.id,
              os_id: os.id,
              produto_id: item.produtoId,
              quantidade: item.quantidade,
            });
            setReload((r) => r + 1);
          }}
        />
      </div>
  );
}