import { Link } from "@tanstack/react-router";
import type { OrdemServico } from "@/lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const statusLabel: Record<OrdemServico["status"], { label: string; cls: string }> = {
  aberta: { label: "Aberta", cls: "bg-primary/10 text-primary border-primary/20" },
  em_andamento: { label: "Em andamento", cls: "bg-[color:var(--warning)]/15 text-[color:oklch(0.5_0.15_70)] border-[color:var(--warning)]/30" },
  faturada: { label: "Faturada", cls: "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30" },
  cancelada: { label: "Cancelada", cls: "bg-muted text-muted-foreground border-border" },
};

export function ServiceOrderList({ ordens }: { ordens: OrdemServico[] }) {
  return (
    <div className="overflow-x-auto rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Número</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Placa</TableHead>
            <TableHead>Data</TableHead>
            <TableHead>Itens</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ordens.map((os) => {
            const s = statusLabel[os.status];
            return (
              <TableRow key={os.id}>
                <TableCell className="font-medium">{os.numero}</TableCell>
                <TableCell>{os.cliente}</TableCell>
                <TableCell className="font-mono text-sm">{os.placa}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(os.data).toLocaleDateString("pt-BR")}
                </TableCell>
                <TableCell>{os.itens.length}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={s.cls}>{s.label}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button asChild size="sm" variant="outline">
                    <Link to="/ordens/$id" params={{ id: os.id }}>Abrir</Link>
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
          {ordens.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                Nenhuma O.S encontrada.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}