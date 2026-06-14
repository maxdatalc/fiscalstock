import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { mockProdutos } from "@/lib/services/mock-data";

const SearchInput = z.object({ loja_id: z.string().uuid().optional(), termo: z.string().optional() });
const DetailInput = z.object({ loja_id: z.string().uuid().optional(), produto_id: z.string() });

export type ProdutoListItem = {
  id: string; codigo: string; codigoBarras: string; nome: string;
  unidade: string; estoqueFisico: number; estoqueFiscal: number;
};

export type ProductStockDetail = {
  produto: { id: string; codigo: string; codigoBarras: string; nome: string; unidade: string };
  estoque_fisico: number;
  estoque_fiscal: number;
  diferenca: number;
  status_risco: "ok" | "atencao" | "bloqueado";
  composicao_estoque_fiscal: {
    inventario_base: number; entradas: number; saidas: number;
    devolucoes: number; ajustes: number;
  };
  pode_emitir_nf: boolean;
  pode_lancar_os: boolean;
  disponivel_para_emissao: number;
  alertas: { tipo: "warning" | "danger"; mensagem: string }[];
};

async function assertLojaAccess(supabase: any, userId: string, loja_id?: string) {
  if (!loja_id) return;
  const { data: ok } = await supabase.rpc("user_can_access_loja", {
    _user_id: userId, _loja_id: loja_id,
  });
  if (!ok) throw new Error("Acesso negado a esta loja");
}

export const searchProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SearchInput.parse(d))
  .handler(async ({ data, context }): Promise<ProdutoListItem[]> => {
    await assertLojaAccess(context.supabase, context.userId, data.loja_id);

    // MOCK por enquanto. Futuramente: chamar Bridge SQL via backend
    // usando queryName + params (nunca SQL livre do frontend).
    const q = (data.termo ?? "").toLowerCase();
    return mockProdutos
      .filter((p) =>
        !q ||
        p.nome.toLowerCase().includes(q) ||
        p.codigo.toLowerCase().includes(q) ||
        p.codigoBarras.includes(q),
      )
      .map((p) => ({
        id: p.id, codigo: p.codigo, codigoBarras: p.codigoBarras,
        nome: p.nome, unidade: p.unidade,
        estoqueFisico: p.estoqueFisico, estoqueFiscal: p.estoqueFiscal,
      }));
  });

export const getProductStockDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DetailInput.parse(d))
  .handler(async ({ data, context }): Promise<ProductStockDetail | null> => {
    await assertLojaAccess(context.supabase, context.userId, data.loja_id);

    const p = mockProdutos.find((x) => x.id === data.produto_id);
    if (!p) return null;

    const diferenca = p.estoqueFisico - p.estoqueFiscal;
    const status_risco: "ok" | "atencao" | "bloqueado" =
      p.estoqueFiscal <= 0 ? "bloqueado" : p.estoqueFiscal < p.estoqueFisico ? "atencao" : "ok";
    const disponivel = Math.max(0, Math.min(p.estoqueFisico, p.estoqueFiscal) - p.reservadoEmOS);
    const alertas: ProductStockDetail["alertas"] = [];
    if (p.estoqueFisico > p.estoqueFiscal)
      alertas.push({ tipo: "warning", mensagem: `Físico (${p.estoqueFisico}) maior que fiscal (${p.estoqueFiscal}).` });
    if (p.estoqueFiscal <= 0)
      alertas.push({ tipo: "danger", mensagem: "Estoque fiscal zerado ou negativo — não é possível emitir." });
    if (p.reservadoEmOS > 0)
      alertas.push({ tipo: "warning", mensagem: `${p.reservadoEmOS} unidade(s) reservadas em O.S aberta.` });

    return {
      produto: {
        id: p.id, codigo: p.codigo, codigoBarras: p.codigoBarras,
        nome: p.nome, unidade: p.unidade,
      },
      estoque_fisico: p.estoqueFisico,
      estoque_fiscal: p.estoqueFiscal,
      diferenca,
      status_risco,
      composicao_estoque_fiscal: {
        inventario_base: p.composicaoFiscal.inventarioBase,
        entradas: p.composicaoFiscal.entradas,
        saidas: p.composicaoFiscal.saidas,
        devolucoes: p.composicaoFiscal.devolucoes,
        ajustes: p.composicaoFiscal.ajustes,
      },
      pode_emitir_nf: p.estoqueFiscal > 0,
      pode_lancar_os: p.estoqueFisico > 0,
      disponivel_para_emissao: disponivel,
      alertas,
    };
  });