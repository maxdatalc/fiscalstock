import { mockProdutos } from "./mock-data";
import type { Produto } from "../types";

export async function listarProdutos(empresaId?: string, busca?: string): Promise<Produto[]> {
  await new Promise((r) => setTimeout(r, 120));
  let res = mockProdutos.slice();
  if (empresaId) res = res.filter((p) => p.empresaId === empresaId);
  if (busca) {
    const q = busca.toLowerCase();
    res = res.filter(
      (p) =>
        p.nome.toLowerCase().includes(q) ||
        p.codigo.toLowerCase().includes(q) ||
        p.codigoBarras.includes(q),
    );
  }
  return res;
}

export async function buscarProduto(id: string): Promise<Produto | null> {
  await new Promise((r) => setTimeout(r, 80));
  return mockProdutos.find((p) => p.id === id) ?? null;
}