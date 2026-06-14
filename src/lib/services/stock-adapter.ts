// Adapter de estoque: padrão claro para trocar entre mock e server function.
import type { Produto } from "../types";
import { mockProdutos } from "./mock-data";
import { searchProducts, getProductStockDetail, type ProductStockDetail } from "@/lib/api/stock.functions";

export interface IStockService {
  search(empresaOuLojaId: string | undefined, busca?: string): Promise<Produto[]>;
  detail(loja_id: string | undefined, produto_id: string): Promise<ProductStockDetail | null>;
}

export class MockStockService implements IStockService {
  async search(_: string | undefined, busca?: string) {
    const q = (busca ?? "").toLowerCase();
    return mockProdutos.filter((p) =>
      !q || p.nome.toLowerCase().includes(q) ||
      p.codigo.toLowerCase().includes(q) || p.codigoBarras.includes(q),
    );
  }
  async detail(_: string | undefined, id: string) {
    const p = mockProdutos.find((x) => x.id === id);
    if (!p) return null;
    return {
      produto: { id: p.id, codigo: p.codigo, codigoBarras: p.codigoBarras, nome: p.nome, unidade: p.unidade },
      estoque_fisico: p.estoqueFisico, estoque_fiscal: p.estoqueFiscal,
      diferenca: p.estoqueFisico - p.estoqueFiscal,
      status_risco: p.estoqueFiscal <= 0 ? "bloqueado" : p.estoqueFiscal < p.estoqueFisico ? "atencao" : "ok",
      composicao_estoque_fiscal: {
        inventario_base: p.composicaoFiscal.inventarioBase, entradas: p.composicaoFiscal.entradas,
        saidas: p.composicaoFiscal.saidas, devolucoes: p.composicaoFiscal.devolucoes,
        ajustes: p.composicaoFiscal.ajustes,
      },
      pode_emitir_nf: p.estoqueFiscal > 0, pode_lancar_os: p.estoqueFisico > 0,
      disponivel_para_emissao: Math.max(0, Math.min(p.estoqueFisico, p.estoqueFiscal) - p.reservadoEmOS),
      alertas: [],
    } as ProductStockDetail;
  }
}

export class ServerStockService implements IStockService {
  async search(loja_id: string | undefined, busca?: string): Promise<Produto[]> {
    const items = await searchProducts({ data: { loja_id, termo: busca } });
    // Adapta para o shape Produto local (alguns campos não vêm do servidor mock).
    return items.map((i) => {
      const original = mockProdutos.find((p) => p.id === i.id);
      return original ?? {
        id: i.id, codigo: i.codigo, codigoBarras: i.codigoBarras, nome: i.nome,
        unidade: i.unidade, estoqueFisico: i.estoqueFisico, estoqueFiscal: i.estoqueFiscal,
        reservadoEmOS: 0, empresaId: "",
        composicaoFiscal: { inventarioBase: 0, entradas: 0, saidas: 0, devolucoes: 0, ajustes: 0 },
      };
    });
  }
  async detail(loja_id: string | undefined, produto_id: string) {
    return getProductStockDetail({ data: { loja_id, produto_id } });
  }
}

// Service ativo. Trocar para `new MockStockService()` quando precisar fallback offline.
export const stockService: IStockService = new ServerStockService();