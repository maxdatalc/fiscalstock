import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { mockOrdens } from "@/lib/services/mock-data";
import { getProductStockDetail } from "./stock.functions";

const ListInput = z.object({
  loja_id: z.string().uuid().optional(),
  cliente: z.string().optional(),
  placa: z.string().optional(),
  status: z.string().optional(),
});
const AddItemInput = z.object({
  loja_id: z.string().uuid().optional(),
  os_id: z.string(),
  produto_id: z.string(),
  quantidade: z.number().min(1),
});

export const listServiceOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ListInput.parse(d))
  .handler(async ({ data, context }) => {
    if (data.loja_id) {
      const { data: ok } = await context.supabase.rpc("user_can_access_loja", {
        _user_id: context.userId, _loja_id: data.loja_id,
      });
      if (!ok) throw new Error("Acesso negado a esta loja");
    }
    // MOCK por enquanto. Futuramente: chamar MaxAPI via backend.
    return mockOrdens.filter((o) =>
      (data.cliente ? o.cliente.toLowerCase().includes(data.cliente.toLowerCase()) : true) &&
      (data.placa ? o.placa.toLowerCase().includes(data.placa.toLowerCase()) : true) &&
      (data.status && data.status !== "todas" ? o.status === data.status : true)
    );
  });

export const addItemToServiceOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AddItemInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const detail = await getProductStockDetail({
      data: { loja_id: data.loja_id, produto_id: data.produto_id },
    });
    if (!detail) throw new Error("Produto não encontrado");

    const excedeFiscal = data.quantidade > detail.estoque_fiscal;

    if (excedeFiscal) {
      // Audita tentativa em risco — não bloqueia tecnicamente.
      await supabaseAdmin.from("audit_logs").insert({
        user_id: context.userId,
        loja_id: data.loja_id ?? null,
        acao: "TENTOU_ADICIONAR_ITEM_SEM_ESTOQUE_FISCAL",
        entidade: "ordem_servico",
        entidade_id: data.os_id,
        detalhes_json: {
          produto_id: data.produto_id, quantidade: data.quantidade,
          estoque_fiscal: detail.estoque_fiscal, estoque_fisico: detail.estoque_fisico,
        } as never,
      });
    }

    // MOCK: simula adição. Futuramente: POST MaxAPI (escrita pelo backend).
    const os = mockOrdens.find((o) => o.id === data.os_id);
    if (os) {
      os.itens.push({
        id: `i${Date.now()}`,
        produtoId: detail.produto.id,
        produtoNome: detail.produto.nome,
        codigo: detail.produto.codigo,
        quantidade: data.quantidade,
      });
    }

    await supabaseAdmin.from("audit_logs").insert({
      user_id: context.userId,
      loja_id: data.loja_id ?? null,
      acao: "ADICIONOU_ITEM_OS",
      entidade: "ordem_servico",
      entidade_id: data.os_id,
      detalhes_json: {
        produto_id: data.produto_id, quantidade: data.quantidade, excedeu_fiscal: excedeFiscal,
      } as never,
    });

    return { ok: true, excedeu_fiscal: excedeFiscal, alerta: excedeFiscal ? "A quantidade informada pode não estar disponível para emissão fiscal." : null };
  });