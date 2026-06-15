import { mockOrdens } from "./mock-data";
import type { OrdemServico } from "../types";
import { listServiceOrders, addItemToServiceOrder } from "@/lib/api/service-orders.functions";

export interface IServiceOrderService {
  list(
    loja_id: string | undefined,
    filters?: { cliente?: string; placa?: string; status?: string },
  ): Promise<OrdemServico[]>;
  get(id: string): Promise<OrdemServico | null>;
  addItem(input: {
    loja_id?: string;
    os_id: string;
    produto_id: string;
    quantidade: number;
    valor_unitario?: number;
    forcar_sem_fiscal?: boolean;
  }): Promise<{ ok: boolean; excedeu_fiscal: boolean; alerta: string | null }>;
}

function mapMaxApiStatus(s: string): OrdemServico["status"] {
  if (s === "finalizada" || s === "faturada") return "faturada";
  if (s === "cancelada") return "cancelada";
  return "aberta";
}

export class MockServiceOrderService implements IServiceOrderService {
  async list(_: string | undefined, f?: { cliente?: string; placa?: string; status?: string }) {
    return mockOrdens.filter(
      (o) =>
        (f?.cliente ? o.cliente.toLowerCase().includes(f.cliente.toLowerCase()) : true) &&
        (f?.placa ? o.placa.toLowerCase().includes(f.placa.toLowerCase()) : true) &&
        (f?.status && f.status !== "todas" ? o.status === f.status : true),
    );
  }
  async get(id: string) {
    return mockOrdens.find((o) => o.id === id) ?? null;
  }
  async addItem(input: {
    loja_id?: string;
    os_id: string;
    produto_id: string;
    quantidade: number;
    valor_unitario?: number;
    forcar_sem_fiscal?: boolean;
  }) {
    const os = mockOrdens.find((o) => o.id === input.os_id);
    if (os) {
      os.itens.push({
        id: `i${Date.now()}`,
        produtoId: input.produto_id,
        produtoNome: input.produto_id,
        codigo: input.produto_id,
        quantidade: input.quantidade,
      });
    }
    return { ok: true, excedeu_fiscal: false, alerta: null };
  }
}

export class ServerServiceOrderService implements IServiceOrderService {
  async list(
    loja_id: string | undefined,
    f?: { cliente?: string; placa?: string; status?: string },
  ): Promise<OrdemServico[]> {
    if (!loja_id) return [];
    const rows = (await listServiceOrders({ data: { loja_id, ...f } })) as unknown as Array<{
      id: string;
      numero: string;
      cliente: string;
      placa: string;
      status: string;
      dataAbertura: string | null;
    }>;
    return rows.map(
      (o): OrdemServico => ({
        id: o.id,
        numero: o.numero,
        cliente: o.cliente,
        placa: o.placa,
        data: o.dataAbertura ?? new Date().toISOString(),
        status: mapMaxApiStatus(o.status),
        empresaId: "",
        itens: [],
      }),
    );
  }

  async get(_id: string): Promise<OrdemServico | null> {
    return null;
  }

  async addItem(input: {
    loja_id?: string;
    os_id: string;
    produto_id: string;
    quantidade: number;
    valor_unitario?: number;
    forcar_sem_fiscal?: boolean;
  }): Promise<{ ok: boolean; excedeu_fiscal: boolean; alerta: string | null }> {
    const lojaId = input.loja_id;
    if (!lojaId) return { ok: false, excedeu_fiscal: false, alerta: "Loja não especificada" };
    const result = (await addItemToServiceOrder({
      data: {
        loja_id: lojaId,
        os_id: input.os_id,
        produto_id: input.produto_id,
        quantidade: input.quantidade,
        valor_unitario: input.valor_unitario ?? 0,
        forcar_sem_fiscal: input.forcar_sem_fiscal ?? false,
      },
    })) as unknown as { ok: boolean; requer_confirmacao: boolean; alerta: string | null };
    return {
      ok: result.ok,
      excedeu_fiscal: !result.ok && (result.requer_confirmacao ?? false),
      alerta: result.alerta ?? null,
    };
  }
}

export const serviceOrderService: IServiceOrderService = new ServerServiceOrderService();
