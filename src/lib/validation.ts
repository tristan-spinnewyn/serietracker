import { z } from 'zod';

// Server actions are public endpoints: their arguments must be validated at
// runtime, whatever their TypeScript signature says.

/** A database id (cuid) received from the client. */
export const idSchema = z.string().min(1).max(64);

/** A bounded list of database ids, to cap the work a single call can trigger. */
export function idListSchema(max: number) {
  return z.array(idSchema).max(max);
}
