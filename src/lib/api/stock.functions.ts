import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { calculateFiscalStock } from "@/lib/fiscal/calculate-fiscal-stock";
import { statusToRiskLevel } from "@/lib/fiscal/stock-status";
import { queryBridge } from "@/lib/bridge/bridge-client";
import type { BridgeConfig } from "@/lib/bridge/bridge-client";
import { resolveNamedQuery } from "@/lib/bridge/named-queries";

const SearchInput = z.object({
  loja_id: z.string().uuid(),
  termo: z.string().optional(),
});
const DetailInput = z.object({
  loja_id: z.string().uuid(),
  produto_id: z.string(),
});

export type ProdutoListItem = {
  id: string;
  codigo: string;
  codigoBarras: string;
  nome: string;
  unidade: string;
  estoqueFisico: number;
  estoqueFiscal: number;
};

export type ProductStockDetail = {
  produto: { id: string; codigo: string; codigoBarras: string; nome: string; unidade: string };
  estoque_fisico: number;
  estoque_fiscal: number;
  diferenca: number;
  status_risco: "ok" | "atencao" | "bloqueado";
  composicao_estoque_fiscal: {
    inventario_base: number;
    entradas: number;
    saidas: number;
    devolucoes: number;
    ajustes: number;
  } | null;
  pode_emitir_nf: boolean;
  pode_lancar_os: boolean;
  disponivel_para_emissao: number;
  alertas: { tipo: "warning" | "danger"; mensagem: string }[];
};

interface ProductRow {
  proId: number;
  proCodigo: string;
  proDescricao: string;
  proEstoqueAtual: number;
  proUn: string;
}

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------

async function assertLojaAccess(
  supabase: SupabaseClient<Database>,
  userId: string,
  loja_id: string,
) {
  const { data: ok } = await supabase.rpc("user_can_access_loja", {
    _user_id: userId,
    _loja_id: loja_id,
  });
  if (!ok) throw new Error("Acesso negado a esta loja");
}

async function getLojaConfigs(supabaseAdmin: SupabaseClient<Database>, lojaId: string) {
  const [{ data: loja }, { data: cfg }] = await Promise.all([
    supabaseAdmin
      .from("lojas")
      .select("emp_id_maxdata")
      .eq("id", lojaId)
      .maybeSingle(),
    supabaseAdmin
      .from("integration_configs")
      .select("bridge_url, bridge_token")
      .eq("loja_id", lojaId)
      .maybeSingle(),
  ]);

  if (!loja?.emp_id_maxdata) throw new Error("Loja sem emp_id_maxdata configurado");

  const empId = parseInt(loja.emp_id_maxdata, 10);

  if (!cfg?.bridge_url || !cfg?.bridge_token)
    throw new Error("Bridge SQL não configurada para esta loja");
  const bridge: BridgeConfig = { url: cfg.bridge_url, token: cfg.bridge_token };

  return { empId, bridge };
}

// ---------------------------------------------------------------------------
// searchProducts — Bridge SQL (returns proCodigo per loja)
// ---------------------------------------------------------------------------

export const searchProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SearchInput.parse(d))
  .handler(async ({ data, context }): Promise<ProdutoListItem[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await assertLojaAccess(context.supabase, context.userId, data.loja_id);

    const termo = (data.termo ?? "").trim();
    if (!termo) return [];

    const { empId, bridge } = await getLojaConfigs(supabaseAdmin, data.loja_id);

    const { sql, params } = resolveNamedQuery("SEARCH_PRODUCTS", {
      empId,
      termo: `%${termo}%`,
    });
    const rows = await queryBridge<ProductRow>(bridge, sql, params);

    return rows.map((p) => ({
      id: String(p.proId),
      codigo: p.proCodigo ?? String(p.proId),
      codigoBarras: "",
      nome: p.proDescricao ?? "",
      unidade: p.proUn ?? "",
      estoqueFisico: Number(p.proEstoqueAtual ?? 0),
      estoqueFiscal: 0,
    }));
  });

// ---------------------------------------------------------------------------
// getProductStockDetail — physical (Bridge SQL) + fiscal (Bridge CTE)
// ---------------------------------------------------------------------------

export const getProductStockDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DetailInput.parse(d))
  .handler(async ({ data, context }): Promise<ProductStockDetail | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await assertLojaAccess(context.supabase, context.userId, data.loja_id);
    const { empId, bridge } = await getLojaConfigs(supabaseAdmin, data.loja_id);

    const proId = parseInt(data.produto_id, 10);
    if (isNaN(proId)) throw new Error("produto_id inválido");

    const physQuery = resolveNamedQuery("GET_PRODUCT_PHYSICAL_STOCK", { empId, proId });

    const [physRows, fiscalResult] = await Promise.all([
      queryBridge<ProductRow>(bridge, physQuery.sql, physQuery.params),
      calculateFiscalStock(empId, proId, bridge),
    ]);

    const phys = physRows[0] ?? null;
    const estoqueFisico = phys ? Number(phys.proEstoqueAtual ?? 0) : fiscalResult.estoqueFisico;
    const estoqueFiscal = fiscalResult.estoqueFiscal;
    const diferenca = estoqueFisico - estoqueFiscal;
    const status_risco = statusToRiskLevel(fiscalResult.statusCode);
    const disponivel = Math.max(0, Math.min(estoqueFisico, estoqueFiscal));

    const alertas: ProductStockDetail["alertas"] = fiscalResult.alertas.map((msg) => ({
      tipo: (status_risco === "bloqueado" ? "danger" : "warning") as "warning" | "danger",
      mensagem: msg,
    }));

    if (fiscalResult.semInventario) {
      alertas.push({
        tipo: "danger",
        mensagem: "Inventário não encontrado — estoque fiscal não pode ser calculado.",
      });
    }

    return {
      produto: {
        id: String(proId),
        codigo: phys?.proCodigo ?? fiscalResult.proCodigo,
        codigoBarras: "",
        nome: phys?.proDescricao ?? fiscalResult.proDescricao,
        unidade: phys?.proUn ?? fiscalResult.proUn,
      },
      estoque_fisico: estoqueFisico,
      estoque_fiscal: estoqueFiscal,
      diferenca,
      status_risco,
      composicao_estoque_fiscal: fiscalResult.composicao
        ? {
            inventario_base: fiscalResult.composicao.estoqueBaseInventario,
            entradas: fiscalResult.composicao.entradasFiscais,
            saidas: fiscalResult.composicao.saidasFiscais,
            devolucoes: fiscalResult.composicao.devolucoesFiscais,
            ajustes: fiscalResult.composicao.ajustesEstoque,
          }
        : null,
      pode_emitir_nf: estoqueFiscal > 0,
      pode_lancar_os: estoqueFisico > 0,
      disponivel_para_emissao: disponivel,
      alertas,
    };
  });