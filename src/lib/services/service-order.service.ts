import { mockOrdens } from "./mock-data";
import type { OrdemServico, ItemOS } from "../types";

export async function listarOrdens(empresaId?: string): Promise<OrdemServico[]> {
  await new Promise((r) => setTimeout(r, 100));
  return empresaId ? mockOrdens.filter((o) => o.empresaId === empresaId) : mockOrdens.slice();
}

export async function buscarOrdem(id: string): Promise<OrdemServico | null> {
  await new Promise((r) => setTimeout(r, 80));
  return mockOrdens.find((o) => o.id === id) ?? null;
}

export async function adicionarItem(osId: string, item: Omit<ItemOS, "id">): Promise<ItemOS> {
  await new Promise((r) => setTimeout(r, 120));
  const os = mockOrdens.find((o) => o.id === osId);
  if (!os) throw new Error("O.S não encontrada");
  const novo: ItemOS = { ...item, id: `i${Date.now()}` };
  os.itens.push(novo);
  return novo;
}