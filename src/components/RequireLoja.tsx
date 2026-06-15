import type { ReactNode } from "react";
import { useFiscalAuth } from "@/lib/fiscal-auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Store, AlertTriangle } from "lucide-react";

/**
 * Garante que existe uma loja ativa no contexto antes de renderizar `children`.
 * Toda tela que consulta estoque/O.S. depende obrigatoriamente de uma loja
 * (emp_id_maxdata + terminal). Sem isso, nÃ£o hÃ¡ consulta vÃ¡lida possÃ­vel.
 */
export function RequireLoja({ children }: { children: ReactNode }) {
  const { loading, empresaAtiva, lojaAtiva, empresas } = useFiscalAuth();
  if (loading) return <p className="text-sm text-muted-foreground">Carregandoâ€¦</p>;

  if (!empresaAtiva || empresas.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 p-10 text-center">
          <AlertTriangle className="h-8 w-8 text-[color:var(--warning)]" />
          <p className="font-medium">Nenhuma empresa vinculada ao seu usuÃ¡rio.</p>
          <p className="max-w-md text-sm text-muted-foreground">
            PeÃ§a a um administrador para vincular vocÃª a uma empresa em
            ConfiguraÃ§Ãµes â†’ UsuÃ¡rios.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!lojaAtiva) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 p-10 text-center">
          <Store className="h-8 w-8 text-primary" />
          <p className="font-medium">Selecione uma loja para continuar.</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Todas as consultas de estoque e O.S. sÃ£o feitas no contexto de uma
            loja especÃ­fica (emp_id + terminal MaxData). Escolha uma loja no
            seletor no topo da pÃ¡gina.
          </p>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
}
