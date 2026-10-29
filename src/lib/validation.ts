import { z } from 'zod';

// Server actions are public endpoints: their arguments must be validated at
// runtime, whatever their TypeScript signature says.

/** A database id (cuid) received from the client. */
export const idSchema = z.string().min(1).max(64);

/**
 * An email as stored in the database: trimmed and lowercased. Postgres compares
 * case-sensitively, so every lookup must go through this to match one account.
 */
export const emailSchema = z.string().trim().toLowerCase().email();

/** A bounded list of database ids, to cap the work a single call can trigger. */
export function idListSchema(max: number) {
  return z.array(idSchema).max(max);
}
