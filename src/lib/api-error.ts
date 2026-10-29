import { NextResponse } from 'next/server';

/**
 * Logs the real error server-side and returns a generic message to the client,
 * so internal details (DB errors, upstream API messages, config) never leak.
 */
export function apiErrorResponse(
  context: string,
  err: unknown,
  { status = 500, message = 'Erreur serveur' }: { status?: number; message?: string } = {},
) {
  console.error(`[${context}]`, err);
  return NextResponse.json({ error: message }, { status });
}
