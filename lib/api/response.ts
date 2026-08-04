import { NextResponse } from "next/server";
import type { ApiFieldError } from "./errors";

/**
 * Standardized response envelope for every route handler. Matches the
 * {success, ...} shape /api/leads already produced before this module —
 * this is a formalization of the existing convention, not a new one, so
 * refactoring an existing route onto it changes zero bytes on the wire.
 */

export function apiSuccess<T extends Record<string, unknown>>(
  payload: T,
  status = 200,
  headers?: HeadersInit,
): NextResponse {
  return NextResponse.json({ success: true, ...payload }, { status, headers });
}

export function apiError(errors: ApiFieldError[], status: number, headers?: HeadersInit): NextResponse {
  return NextResponse.json({ success: false, errors }, { status, headers });
}
