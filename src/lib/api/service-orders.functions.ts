import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { BridgeConfig } from "@/lib/bridge/bridge-client";
import { queryBridge } from "@/lib/bridge/bridge-client";
import { resolveNamedQuery } from "@/lib/bridge/named-queries";
import {
  addItemToServiceOrderMaxApi,
  buildMaxApiConfig,
  type MaxApiConfig,
} from "@/lib/maxapi/maxapi-client";
import { validateStockForOsItem } from "@/lib/fiscal/calculate-fiscal-stock";

const ListInput = z.object({
  loja_id: z.string().uuid(),
  cliente: z.string().optional(),
  placa: z.string().optional(),
  status: z.string().optional(),
});

const DetailInput = z.object({
  loja_id: z.string().uuid(),
  os_id: z.string(),
});

const AddItemInput = z.object({
  loja_id: z.string().uuid(),
  os_id: z.string(),
  produto_id: z.string(),
  quantidade: z.number().min(1),
  valor_unitario: z.number().min(0),
  tipo: z.string().optional().default("P"),
  cfop: z.number().optional(),
  tecnico_id: z.number().optional(),
  forcar_sem_fiscal: z.boolean().optional().default(false),
});

// ---------------------------------------------------------------------------
// Row shapes for Bridge SQL queries
// ---------------------------------------------------------------------------

interface OsListRow {
  vedId: number;
  clienteNome: string | null;
  placa: string | null;
  status: string;
  dataAbertura: string | null;
  obs: string | null;
  defeito: string | null;
  equipamento: string | null;
  marca: string | null;
}

interface OsDetailRow {
  vedId: number;
  clienteId: number | null;
  clienteNome: string | null;
  placa: string | null;
  status: string;
  dataAbertura: string | null;
  obs: string | null;
  defeito: string | null;
  equipamento: string | null;
  marca: string | null;
  laudoTec: string | null;
}

interface OsItemRow {
  itemId: number;
  proId: number;
  proCodigo: string;
  proDescricao: string;
  proUn: string;
  qtde: number;
  precoUnitario: number;
  totalItem: number;
  cancelado: number;
}

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------

async function getLojaConfig(supabaseAdmin: SupabaseClient<Database>, lojaId: string) {
  const [{ data: loja }, { data: cfg }] = await Promise.all([
    supabaseAdmin
      .from("lojas")
      .select("emp_id_maxdata, terminal_maxdata, empresa_id")
      .eq("id", lojaId)
      .maybeSingle(),
    supabaseAdmin
      .from("integration_configs")
      .select("bridge_url, bridge_token, maxapi_url")
      .eq("loja_id", lojaId)
      .maybeSingle(),
  ]);

  if (!loja) throw new Error("Loja não encontrada");
  if (!cfg?.bridge_url || !cfg?.bridge_token)
    throw new Error("Bridge SQL não configurada para esta loja");

  const bridge: BridgeConfig = { url: cfg.bridge_url, token: cfg.bridge_token };
  const empId = parseInt(loja.emp_id_maxdata, 10);

  let maxApi: MaxApiConfig | null = null;
  if (cfg.maxapi_url) {
    maxApi = buildMaxApiConfig(loja, cfg);
  }

  return { loja, bridge, empId, maxApi };
}

async function logAuditoria(
  supabaseAdmin: SupabaseClient<Database>,
  opts: {
    userId: string;
    empresa_id?: string | null;
    loja_id?: string | null;
    acao: string;
    entidade?: string;
    entidade_id?: string;
    detalhes?: unknown;
  },
) {
  await supabaseAdmin.from("audit_logs").insert({
    user_id: opts.userId,
    empresa_id: opts.empresa_id ?? null,
    loja_id: opts.loja_id ?? null,
    acao: opts.acao,
    entidade: opts.entidade ?? null,
    entidade_id: opts.entidade_id ?? null,
    detalhes_json: (opts.detalhes ?? null) as never,
  });
}

// ---------------------------------------------------------------------------
// Status mapping helpers (Bridge SQL vedStatus ↔ display strings)
// ---------------------------------------------------------------------------

function vedStatusToDisplay(s: string): string {
  if (s === "F") return "faturada";
  if (s === "C") return "cancelada";
  return "aberta";
}

function displayToVedStatus(s: string): string {
  if (s === "faturada" || s === "finalizada") return "F";
  if (s === "cancelada") return "C";
  if (s === "aberta" || s === "pendente") return "A";
  return "";
}

// ---------------------------------------------------------------------------
// listServiceOrders — Bridge SQL (returns all non-deleted OS without pagination)
// ---------------------------------------------------------------------------

export const listServiceOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ListInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: canAccess } = await context.supabase.rpc("user_can_access_loja", {
      _user_id: context.userId,
      _loja_id: data.loja_id,
    });
    if (!canAccess) throw new Error("Acesso negado a esta loja");

    const { bridge, empId } = await getLojaConfig(supabaseAdmin, data.loja_id);

    const { sql, params } = resolveNamedQuery("LIST_SERVICE_ORDERS", {
      empId,
      statusFilter: data.status && data.status !== "todas" ? displayToVedStatus(data.status) : "",
      clienteNome: data.cliente ? `%${data.cliente}%` : "",
    });

    const rows = await queryBridge<OsListRow>(bridge, sql, params);

    return rows.map((o) => ({
      id: String(o.vedId),
      numero: String(o.vedId),
      cliente: o.clienteNome ?? "",
      placa: o.placa ?? "",
      status: vedStatusToDisplay(o.status),
      statusOs: o.status,
      dataAbertura: o.dataAbertura,
      totalNf: 0,
      valorTotalProduto: 0,
      valorTotalServico: 0,
      obs: o.obs ?? "",
      defeito: o.defeito ?? "",
      equipamento: o.equipamento ?? "",
      marca: o.marca ?? "",
    }));
  });

// ---------------------------------------------------------------------------
// getServiceOrderDetail — Bridge SQL
// ---------------------------------------------------------------------------

export const getServiceOrderDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DetailInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: canAccess } = await context.supabase.rpc("user_can_access_loja", {
      _user_id: context.userId,
      _loja_id: data.loja_id,
    });
    if (!canAccess) throw new Error("Acesso negado a esta loja");

    const { bridge, empId } = await getLojaConfig(supabaseAdmin, data.loja_id);

    const osId = parseInt(data.os_id, 10);
    if (isNaN(osId)) throw new Error("os_id inválido");

    const { sql, params } = resolveNamedQuery("GET_SERVICE_ORDER_DETAIL", { empId, osId });
    const rows = await queryBridge<OsDetailRow>(bridge, sql, params);

    if (!rows[0]) throw new Error("Ordem de serviço não encontrada");

    const o = rows[0];
    return {
      id: String(o.vedId),
      numero: String(o.vedId),
      clienteId: o.clienteId ? String(o.clienteId) : null,
      cliente: o.clienteNome ?? "",
      placa: o.placa ?? "",
      status: vedStatusToDisplay(o.status),
      statusOs: o.status,
      dataAbertura: o.dataAbertura,
      obs: o.obs ?? "",
      defeito: o.defeito ?? "",
      laudoTec: o.laudoTec ?? "",
    };
  });

// ---------------------------------------------------------------------------
// getServiceOrderItems — Bridge SQL vendaItem (MaxAPI não expõe GET items)
// ---------------------------------------------------------------------------

export const getServiceOrderItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DetailInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: canAccess } = await context.supabase.rpc("user_can_access_loja", {
      _user_id: context.userId,
      _loja_id: data.loja_id,
    });
    if (!canAccess) throw new Error("Acesso negado a esta loja");

    const { bridge, empId } = await getLojaConfig(supabaseAdmin, data.loja_id);

    const osId = parseInt(data.os_id, 10);
    if (isNaN(osId)) throw new Error("os_id inválido");

    const { sql, params } = resolveNamedQuery("GET_SERVICE_ORDER_ITEMS", { osId, empId });
    const rows = await queryBridge<OsItemRow>(bridge, sql, params);

    return rows.map((r) => ({
      id: String(r.itemId),
      produtoId: String(r.proId),
      codigo: r.proCodigo ?? "",
      produtoNome: r.proDescricao ?? "",
      unidade: r.proUn ?? "",
      quantidade: Number(r.qtde),
      precoUnitario: Number(r.precoUnitario ?? 0),
      total: Number(r.totalItem ?? 0),
    }));
  });

// ---------------------------------------------------------------------------
// addItemToServiceOrder
//
// Flow:
//   1. Verify loja access
//   2. Load bridge + MaxAPI config
//   3. Get physical + fiscal stock (Bridge SQL)
//   4. deriveStockStatus for requested qty
//   5. blocked → audit BLOQUEOU + throw
//   6. warning + forcar=false → audit ADVERTENCIA + return requer_confirmacao
//   7. Write via MaxAPI POST /v2/serviceorder/items (never direct SQL)
//   8. Audit success
// ---------------------------------------------------------------------------

export const addItemToServiceOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AddItemInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Step 1 — auth
    const { data: canAccess } = await context.supabase.rpc("user_can_access_loja", {
      _user_id: context.userId,
      _loja_id: data.loja_id,
    });
    if (!canAccess) throw new Error("Acesso negado a esta loja");

    // Step 2 — config
    const { loja, bridge, empId, maxApi } = await getLojaConfig(supabaseAdmin, data.loja_id);
    if (!maxApi) throw new Error("MaxAPI não configurada para esta loja");

    const proId = parseInt(data.produto_id, 10);
    const osId = parseInt(data.os_id, 10);
    if (isNaN(proId)) throw new Error("produto_id inválido");
    if (isNaN(osId)) throw new Error("os_id inválido");

    // Steps 3–4 — stock validation via Bridge SQL
    const { stock, validation } = await validateStockForOsItem(
      empId,
      proId,
      data.quantidade,
      bridge,
    );

    const auditBase = {
      userId: context.userId,
      empresa_id: loja.empresa_id,
      loja_id: data.loja_id,
      entidade: "ordem_servico",
      entidade_id: data.os_id,
    };

    // Step 5 — hard block
    if (validation.blocked) {
      await logAuditoria(supabaseAdmin, {
        ...auditBase,
        acao: "BLOQUEOU_ADICIONAR_ITEM_OS",
        detalhes: {
          produto_id: data.produto_id,
          quantidade: data.quantidade,
          status_estoque: validation.code,
          motivo: validation.message,
          estoque_fisico: stock.estoqueFisico,
          estoque_fiscal: stock.estoqueFiscal,
        },
      });
      throw new Error(`Operação bloqueada: ${validation.message}`);
    }

    // Step 6 — soft warning (requires explicit confirmation from UI)
    if (validation.warning && !data.forcar_sem_fiscal) {
      await logAuditoria(supabaseAdmin, {
        ...auditBase,
        acao: "ADVERTENCIA_ESTOQUE_FISCAL_OS",
        detalhes: {
          produto_id: data.produto_id,
          quantidade: data.quantidade,
          status_estoque: validation.code,
          advertencia: validation.message,
          estoque_fisico: stock.estoqueFisico,
          estoque_fiscal: stock.estoqueFiscal,
        },
      });
      return {
        ok: false,
        requer_confirmacao: true,
        status_estoque: validation.code,
        alerta: validation.message,
        estoque_fisico: stock.estoqueFisico,
        estoque_fiscal: stock.estoqueFiscal,
        item_adicionado: null,
      };
    }

    // Step 7 — write via MaxAPI only (never direct SQL)
    const itemAdicionado = await addItemToServiceOrderMaxApi(maxApi, supabaseAdmin, data.loja_id, {
      OsId: osId,
      produtoId: proId,
      produtoDescricao: stock.proDescricao,
      qtde: data.quantidade,
      valor: data.valor_unitario,
      tipo: data.tipo,
      cfop: data.cfop,
      tecnicoId: data.tecnico_id,
      un: stock.proUn,
    });

    // Step 8 — audit success
    await logAuditoria(supabaseAdmin, {
      ...auditBase,
      acao: "ADICIONOU_ITEM_OS",
      detalhes: {
        produto_id: data.produto_id,
        item_id_maxapi: itemAdicionado?.id,
        quantidade: data.quantidade,
        valor_unitario: data.valor_unitario,
        status_estoque: validation.code,
        excedeu_fiscal: validation.warning,
        estoque_fisico: stock.estoqueFisico,
        estoque_fiscal: stock.estoqueFiscal,
      },
    });

    return {
      ok: true,
      requer_confirmacao: false,
      status_estoque: validation.code,
      alerta: validation.warning ? validation.message : null,
      estoque_fisico: stock.estoqueFisico,
      estoque_fiscal: stock.estoqueFiscal,
      item_adicionado: itemAdicionado,
    };
  });
