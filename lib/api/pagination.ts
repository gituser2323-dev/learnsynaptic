import type { PaginationParams } from "@/lib/pagination";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/** Parses page/limit query params with sane defaults and clamping — the
 *  only HTTP-specific part of pagination; the shape itself
 *  (lib/pagination.ts) has nothing to do with HTTP. */
export function parsePaginationParams(searchParams: URLSearchParams): PaginationParams {
  const page = Math.max(1, Math.trunc(Number(searchParams.get("page"))) || 1);
  const rawLimit = Math.trunc(Number(searchParams.get("limit"))) || DEFAULT_LIMIT;
  const limit = Math.min(MAX_LIMIT, Math.max(1, rawLimit));
  return { page, limit };
}
