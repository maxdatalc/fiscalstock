/**
 * MaxAPI client — server-side only.
 *
 * Authentication: POST /v2/auth with { empid, terminal } → JWT Bearer token.
 * Token TTL: exactly 3600s (1 hour). Cache TTL: 3000s (50 min) — 10 min safety margin.
 * The JWT is cached in Supabase (integration_configs) and refreshed automatically.
 * The token NEVER reaches the browser and NEVER appears in logs.
 *
 * Live-tested on 2026-06-14 against https://lucasbatauto.lcgestor.com.br:
 *  - No CF-Access headers needed — only Authorization: Bearer {token}
 *  - Auth body uses lowercase "empid"
 *  - Pagination uses "docs" key (not "items")
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type {
  TokenDto,
  ServiceOrder,
  ServiceOrderBody,
  ServiceOrderItem,
  MaxApiError,
  MaxApiPaginated,
  MaxApiProduct,
} from "./maxapi-types";

export interface MaxApiConfig {
  baseUrl: string;
  empId: number;
  terminal: string;
}

type SupabaseAdmin = SupabaseClient<Database>;

// Token is valid for 3600s; cache for 3000s (50 min) to leave a 10-min safety margin.
const CACHE_TTL_SECONDS = 3000;

// ---------------------------------------------------------------------------
// Internal — fetch a fresh JWT from the MaxAPI auth endpoint
// ---------------------------------------------------------------------------

async function fetchNewToken(config: MaxApiConfig): Promise<TokenDto> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await fetch(`${config.baseUrl}/v2/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ empid: config.empId, terminal: config.terminal }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`MaxAPI auth HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    return (await res.json()) as TokenDto;
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new Error("MaxAPI auth: timeout após 15s");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Token cache — stored in Supabase integration_configs
// ---------------------------------------------------------------------------

export async function getOrRefreshToken(
  config: MaxApiConfig,
  supabaseAdmin: SupabaseAdmin,
  lojaId: string,
): Promise<string> {
  const { data: row } = await supabaseAdmin
    .from("integration_configs")
    .select("maxapi_token_cache, maxapi_token_expires_at")
    .eq("loja_id", lojaId)
    .maybeSingle();

  const cached: string | null = row?.maxapi_token_cache ?? null;
  const expiresAt: string | null = row?.maxapi_token_expires_at ?? null;

  if (cached && expiresAt) {
    // Use cached token if it was stored less than CACHE_TTL_SECONDS ago.
    // We track the stored_at implicitly: expiresAt is set to "now + 3000s" when we cache.
    if (new Date(expiresAt).getTime() > Date.now()) {
      return cached;
    }
  }

  // Cache miss or expired — fetch a new token
  const dto = await fetchNewToken(config);

  // Cache for CACHE_TTL_SECONDS, not the full 3600s JWT TTL
  const cacheExpiresAt = new Date(Date.now() + CACHE_TTL_SECONDS * 1000).toISOString();
  await supabaseAdmin
    .from("integration_configs")
    .update({
      maxapi_token_cache: dto.token,
      maxapi_token_expires_at: cacheExpiresAt,
    })
    .eq("loja_id", lojaId);

  return dto.token;
}

// ---------------------------------------------------------------------------
// Internal — generic authenticated request with auto-retry on 401
// ---------------------------------------------------------------------------

async function maxApiRequest<T>(
  config: MaxApiConfig,
  supabaseAdmin: SupabaseAdmin,
  lojaId: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
  timeoutMs = 15_000,
): Promise<T> {
  let token = await getOrRefreshToken(config, supabaseAdmin, lojaId);

  const doRequest = async (bearerToken: string): Promise<Response> => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      return await fetch(`${config.baseUrl}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${bearerToken}`,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: ctrl.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      if ((err as Error).name === "AbortError") {
        throw new Error(`MaxAPI ${method} ${path}: timeout após ${timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  };

  let res = await doRequest(token);

  // Auto-refresh once on 401
  if (res.status === 401) {
    // Invalidate cache and get a fresh token
    await supabaseAdmin
      .from("integration_configs")
      .update({ maxapi_token_cache: null, maxapi_token_expires_at: null })
      .eq("loja_id", lojaId);
    token = await getOrRefreshToken(config, supabaseAdmin, lojaId);
    res = await doRequest(token);
  }

  if (!res.ok) {
    const errorBody = (await res.json().catch(() => ({}))) as MaxApiError;
    const msg = errorBody.message ?? (await res.text().catch(() => ""));
    throw new Error(`MaxAPI ${method} ${path} HTTP ${res.status}: ${msg}`);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ---------------------------------------------------------------------------
// Service Order — read operations
// ---------------------------------------------------------------------------

/** List service orders. Returns the docs array from the paginated response. */
export async function listServiceOrdersMaxApi(
  config: MaxApiConfig,
  supabaseAdmin: SupabaseAdmin,
  lojaId: string,
  params: { nomeCliente?: string; veiculoPlaca?: string; status?: string } = {},
): Promise<ServiceOrder[]> {
  const qs = new URLSearchParams();
  if (params.nomeCliente) qs.set("nomeCliente", params.nomeCliente);
  if (params.veiculoPlaca) qs.set("veiculoPlaca", params.veiculoPlaca);
  if (params.status) qs.set("status", params.status);

  const path = `/v2/serviceorder${qs.toString() ? `?${qs}` : ""}`;
  const result = await maxApiRequest<MaxApiPaginated<ServiceOrder>>(
    config,
    supabaseAdmin,
    lojaId,
    "GET",
    path,
  );
  return result.docs ?? [];
}

/** Get a single service order by id. */
export async function getServiceOrderMaxApi(
  config: MaxApiConfig,
  supabaseAdmin: SupabaseAdmin,
  lojaId: string,
  osId: number,
): Promise<ServiceOrder> {
  return maxApiRequest<ServiceOrder>(
    config,
    supabaseAdmin,
    lojaId,
    "GET",
    `/v2/serviceorder/${osId}`,
  );
}

// ---------------------------------------------------------------------------
// Product — read operations
// ---------------------------------------------------------------------------

/** Search products by description. Returns docs array. */
export async function searchProductsMaxApi(
  config: MaxApiConfig,
  supabaseAdmin: SupabaseAdmin,
  lojaId: string,
  descricao: string,
): Promise<MaxApiProduct[]> {
  const qs = new URLSearchParams({ descricao });
  const result = await maxApiRequest<MaxApiPaginated<MaxApiProduct>>(
    config,
    supabaseAdmin,
    lojaId,
    "GET",
    `/v2/product?${qs}`,
  );
  return result.docs ?? [];
}

/** Get a single product by id. */
export async function getProductMaxApi(
  config: MaxApiConfig,
  supabaseAdmin: SupabaseAdmin,
  lojaId: string,
  productId: number,
): Promise<MaxApiProduct> {
  return maxApiRequest<MaxApiProduct>(
    config,
    supabaseAdmin,
    lojaId,
    "GET",
    `/v2/product/${productId}`,
  );
}

// ---------------------------------------------------------------------------
// Service Order — write operations (all writes go through MaxAPI only)
// ---------------------------------------------------------------------------

/** Create a new service order. Returns the created OS. */
export async function createServiceOrder(
  config: MaxApiConfig,
  supabaseAdmin: SupabaseAdmin,
  lojaId: string,
  body: ServiceOrderBody,
): Promise<{ id: number }> {
  return maxApiRequest<{ id: number }>(
    config,
    supabaseAdmin,
    lojaId,
    "POST",
    "/v2/serviceorder",
    body,
  );
}

/** Add an item to an existing OS. Returns the created item. */
export async function addItemToServiceOrderMaxApi(
  config: MaxApiConfig,
  supabaseAdmin: SupabaseAdmin,
  lojaId: string,
  item: ServiceOrderItem,
): Promise<{ id: number }> {
  return maxApiRequest<{ id: number }>(
    config,
    supabaseAdmin,
    lojaId,
    "POST",
    "/v2/serviceorder/items",
    item,
  );
}

/** Cancel / delete an OS item by its id. */
export async function cancelServiceOrderItem(
  config: MaxApiConfig,
  supabaseAdmin: SupabaseAdmin,
  lojaId: string,
  itemId: number,
): Promise<void> {
  await maxApiRequest<void>(
    config,
    supabaseAdmin,
    lojaId,
    "DELETE",
    `/v2/serviceorder/items/${itemId}`,
  );
}

// ---------------------------------------------------------------------------
// Config helper
// ---------------------------------------------------------------------------

export interface LojaMaxApiRow {
  emp_id_maxdata: string;
  terminal_maxdata: string;
}

export interface IntegrationConfigRow {
  maxapi_url: string | null;
}

/** Build MaxApiConfig from Supabase rows. Throws if any required field is missing. */
export function buildMaxApiConfig(loja: LojaMaxApiRow, cfg: IntegrationConfigRow): MaxApiConfig {
  if (!cfg.maxapi_url) throw new Error("MaxAPI não configurada: falta maxapi_url");
  if (!loja.emp_id_maxdata) throw new Error("Loja sem emp_id_maxdata configurado");
  if (!loja.terminal_maxdata) throw new Error("Loja sem terminal_maxdata configurado");

  return {
    baseUrl: cfg.maxapi_url.replace(/\/$/, ""),
    empId: parseInt(loja.emp_id_maxdata, 10),
    terminal: loja.terminal_maxdata,
  };
}
