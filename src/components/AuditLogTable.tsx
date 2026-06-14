import type { LogIntegracao } from "@/lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const statusCls: Record<LogIntegracao["status"], string> = {
  sucesso: "text-[color:var(--success)]",
  erro: "text-destructive",
  alerta: "text-[color:oklch(0.55_0.17_70)]",
};

export function AuditLogTable({ logs }: { logs: LogIntegracao[] }) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Mensagem</TableHead>
            <TableHead>Usuário</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((l) => (
            <TableRow key={l.id}>
              <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                {new Date(l.data).toLocaleString("pt-BR")}
              </TableCell>
              <TableCell className="text-sm">{l.tipo.replace("_", " ")}</TableCell>
              <TableCell className={`text-sm font-medium ${statusCls[l.status]}`}>{l.status}</TableCell>
              <TableCell className="text-sm">{l.mensagem}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{l.usuario}</TableCell>
            </TableRow>
          ))}
          {logs.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                Nenhum log registrado.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}