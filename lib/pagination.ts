/**
 * Layer-neutral pagination shape — used by repository/service list()
 * methods across every entity. Deliberately not in lib/api: pagination
 * is a generic concept with nothing to do with HTTP (an in-memory list
 * or a non-HTTP caller could paginate too), same reasoning as
 * lib/logger.ts living outside both lib/api and any one service.
 */
export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function buildPaginatedResult<T>(items: T[], total: number, params: PaginationParams): PaginatedResult<T> {
  return {
    items,
    total,
    page: params.page,
    limit: params.limit,
    totalPages: Math.max(1, Math.ceil(total / params.limit)),
  };
}
