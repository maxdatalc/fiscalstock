import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { calculateFiscalStock } from "@/lib/fiscal/calculate-fiscal-stock";
import { statusToRiskLevel } from "@/lib/fiscal/stock-status";
import {
  searchProductsMaxApi,
  getProductMaxApi,
  buildMaxApiConfig,
} from "@/lib/maxapi/maxapi-client";
import type { BridgeConfig } from "@/lib/bridge/bridge-client";

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
      .select("emp_id_maxdata, terminal_maxdata")
      .eq("id", lojaId)
      .maybeSingle(),
    supabaseAdmin
      .from("integration_configs")
      .select("bridge_url, bridge_token, maxapi_url")
      .eq("loja_id", lojaId)
      .maybeSingle(),
  ]);

  if (!loja?.emp_id_maxdata) throw new Error("Loja sem emp_id_maxdata configurado");

  const empId = parseInt(loja.emp_id_maxdata, 10);

  if (!cfg?.bridge_url || !cfg?.bridge_token)
    throw new Error("Bridge SQL não configurada para esta loja");
  const bridge: BridgeConfig = { url: cfg.bridge_url, token: cfg.bridge_token };

  const maxApi = cfg.maxapi_url ? buildMaxApiConfig(loja, cfg) : null;

  return { empId, bridge, maxApi };
}

// ---------------------------------------------------------------------------
// searchProducts
// Uses MaxAPI /v2/product (returns estoque físico inline).
// Falls back to Bridge SQL if MaxAPI is not configured.
// ---------------------------------------------------------------------------

export const searchProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SearchInput.parse(d))
  .handler(async ({ data, context }): Promise<ProdutoListItem[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await assertLojaAccess(context.supabase, context.userId, data.loja_id);
    const { maxApi } = await getLojaConfigs(supabaseAdmin, data.loja_id);

    if (!maxApi) throw new Error("MaxAPI não configurada para esta loja");

    const termo = (data.termo ?? "").trim();
    if (!termo) return [];

    const produtos = await searchProductsMaxApi(maxApi, supabaseAdmin, data.loja_id, termo);

    return produtos
      .filter((p) => !p.desativado)
      .map((p) => ({
        id: String(p.id),
        codigo: p.codigoFab ?? String(p.id),
        codigoBarras: "",
        nome: p.descricao ?? "",
        unidade: p.un ?? "",
        estoqueFisico: Number(p.estoque ?? 0),
        estoqueFiscal: 0, // fiscal requer CTE por produto — calculado no detalhe
      }));
  });

// ---------------------------------------------------------------------------
// getProductStockDetail — physical (MaxAPI) + fiscal (Bridge CTE)
// ---------------------------------------------------------------------------

export const getProductStockDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DetailInput.parse(d))
  .handler(async ({ data, context }): Promise<ProductStockDetail | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await assertLojaAccess(context.supabase, context.userId, data.loja_id);
    const { empId, bridge, maxApi } = await getLojaConfigs(supabaseAdmin, data.loja_id);

    const proId = parseInt(data.produto_id, 10);
    if (isNaN(proId)) throw new Error("produto_id inválido");

    // Run physical (MaxAPI) and fiscal (Bridge CTE) concurrently
    const [product, fiscalResult] = await Promise.all([
      maxApi ? getProductMaxApi(maxApi, supabaseAdmin, data.loja_id, proId) : null,
      calculateFiscalStock(empId, proId, bridge),
    ]);

    const estoqueFisico = product ? Number(product.estoque ?? 0) : fiscalResult.estoqueFisico;

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
        codigo: product?.codigoFab ?? fiscalResult.proCodigo,
        codigoBarras: "",
        nome: product?.descricao ?? fiscalResult.proDescricao,
        unidade: product?.un ?? fiscalResult.proUn,
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
