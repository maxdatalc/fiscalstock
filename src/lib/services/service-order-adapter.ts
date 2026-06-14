import { mockOrdens } from "./mock-data";
import type { OrdemServico } from "../types";
import { listServiceOrders, addItemToServiceOrder } from "@/lib/api/service-orders.functions";

export interface IServiceOrderService {
  list(loja_id: string | undefined, filters?: { cliente?: string; placa?: string; status?: string }): Promise<OrdemServico[]>;
  get(id: string): Promise<OrdemServico | null>;
  addItem(input: { loja_id?: string; os_id: string; produto_id: string; quantidade: number }): Promise<{ ok: boolean; excedeu_fiscal: boolean; alerta: string | null }>;
}

export class MockServiceOrderService implements IServiceOrderService {
  async list(_: string | undefined, f?: { cliente?: string; placa?: string; status?: string }) {
    return mockOrdens.filter((o) =>
      (f?.cliente ? o.cliente.toLowerCase().includes(f.cliente.toLowerCase()) : true) &&
      (f?.placa ? o.placa.toLowerCase().includes(f.placa.toLowerCase()) : true) &&
      (f?.status && f.status !== "todas" ? o.status === f.status : true),
    );
  }
  async get(id: string) { return mockOrdens.find((o) => o.id === id) ?? null; }
  async addItem(input: { loja_id?: string; os_id: string; produto_id: string; quantidade: number }) {
    const os = mockOrdens.find((o) => o.id === input.os_id);
    if (os) {
      os.itens.push({ id: `i${Date.now()}`, produtoId: input.produto_id, produtoNome: input.produto_id, codigo: input.produto_id, quantidade: input.quantidade });
    }
    return { ok: true, excedeu_fiscal: false, alerta: null };
  }
}

export class ServerServiceOrderService implements IServiceOrderService {
  async list(loja_id: string | undefined, f?: { cliente?: string; placa?: string; status?: string }) {
    return listServiceOrders({ data: { loja_id, ...f } });
  }
  async get(id: string) { return mockOrdens.find((o) => o.id === id) ?? null; }
  async addItem(input: { loja_id?: string; os_id: string; produto_id: string; quantidade: number }) {
    return addItemToServiceOrder({ data: input });
  }
}

export const serviceOrderService: IServiceOrderService = new ServerServiceOrderService();