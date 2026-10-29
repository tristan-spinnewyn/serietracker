// AniList GraphQL transport: request pacing, retries and error tracking.
// Shared state is module-level, so every caller goes through the same limiter.

const ENDPOINT = 'https://graphql.anilist.co';
// AniList est en mode dégradé : 30 req/min annoncé (au lieu de 90).
// 60_000 / 2_000 = 30 req/min max → on tient pile dans la limite, sans burst.
// Doc : https://docs.anilist.co/guide/rate-limiting
const MIN_INTERVAL_MS = 2000;
const LOW_REMAINING_THRESHOLD = 5; // backoff proactif quand on s'approche de la limite

// nextSlotAt = timestamp ms du prochain envoi autorisé.
// On le réserve AVANT le fetch → race-safe entre callers concurrents (cron + resync manuel + import).
let nextSlotAt = 0;

// Quand AniList nous dit explicitement "API désactivée", on coupe les appels pour
// API_DISABLED_COOLDOWN_MS. Évite de spammer pendant les outages (cron sinon flush
// tous ses slots dans le vide). Cf. log "temporarily disabled".
const API_DISABLED_COOLDOWN_MS = 5 * 60_000;
let apiDisabledUntil = 0;
// Mémorise la dernière erreur AniList pour enrichir les exceptions des callers
let lastAnilistErrorMessage: string | null = null;

export function getLastAnilistError(): string | null {
  return lastAnilistErrorMessage;
}

function isApiDisabledError(errors: AnilistGqlError[] | undefined): boolean {
  return !!errors?.some(e =>
    typeof e.message === 'string' && /api has been temporarily disabled/i.test(e.message)
  );
}

interface AnilistGqlError {
  message?: string;
  status?: number;
  locations?: unknown;
}
interface AnilistGqlResponse<T> {
  data?: T | null;
  errors?: AnilistGqlError[];
}

function formatAnilistErrors(errors: AnilistGqlError[] | undefined): string {
  if (!errors?.length) return '';
  return errors
    .map(e => `[${e.status ?? '?'}] ${(e.message ?? '(no message)').trim()}`)
    .join(' | ');
}

export async function gql<T>(query: string, variables: Record<string, unknown>, attempt = 0): Promise<T | null> {
  // Court-circuit : AniList nous a récemment dit "API désactivée" → on évite d'envoyer
  // (et on garde l'erreur en cache pour les callers qui veulent l'inclure dans leurs messages)
  if (Date.now() < apiDisabledUntil) return null;

  const now = Date.now();
  const mySlot = Math.max(now, nextSlotAt);
  nextSlotAt = mySlot + MIN_INTERVAL_MS;
  if (mySlot > now) await new Promise(r => setTimeout(r, mySlot - now));

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      // Cloudflare devant graphql.anilist.co renvoie 403 aux requêtes sans UA identifiable
      'User-Agent': 'SeriesTracker/1.0 (+self-hosted)',
    },
    body: JSON.stringify({ query, variables }),
  });

  // Backoff proactif : si on s'approche de la limite, on saute jusqu'au reset
  const remaining = parseInt(res.headers.get('X-RateLimit-Remaining') ?? '', 10);
  const resetTs = parseInt(res.headers.get('X-RateLimit-Reset') ?? '', 10);
  if (!Number.isNaN(remaining) && remaining <= LOW_REMAINING_THRESHOLD && resetTs > 0) {
    const resetAtMs = resetTs * 1000 + 500;
    if (resetAtMs > nextSlotAt) nextSlotAt = resetAtMs;
  }

  // AniList renvoie le message d'erreur dans le corps même en cas de 4xx
  // (API suspendue, IP bloquée, rate limit, syntax error…). On parse toujours.
  let body: AnilistGqlResponse<T> | null = null;
  let rawText: string | null = null;
  try {
    body = await res.json() as AnilistGqlResponse<T>;
  } catch {
    try { rawText = await res.text(); } catch { /* abandon */ }
  }

  const errors = body?.errors;
  if (errors?.length) {
    const formatted = formatAnilistErrors(errors);
    lastAnilistErrorMessage = formatted;
    console.error(`[AniList] HTTP ${res.status} — ${formatted}`);
  } else if (!res.ok) {
    const fallback = rawText?.slice(0, 300) ?? '(no body)';
    lastAnilistErrorMessage = `HTTP ${res.status} — ${fallback}`;
    console.error(`[AniList] HTTP ${res.status} — ${fallback}`);
  } else if (res.ok) {
    lastAnilistErrorMessage = null;
  }

  // API désactivée explicitement par AniList → fail-fast, pas de retry
  // (retenter dans 12s ne fera que gâcher des slots, l'outage dure souvent des heures)
  if (isApiDisabledError(errors)) {
    apiDisabledUntil = Date.now() + API_DISABLED_COOLDOWN_MS;
    return null;
  }

  // 429 (rate limit) et 403 (Cloudflare bot/anti-flood) sont retentables
  if ((res.status === 429 || res.status === 403) && attempt < 3) {
    const retryAfter = parseInt(res.headers.get('Retry-After') ?? '0', 10);
    const delayMs =
      resetTs > 0       ? Math.max(0, resetTs * 1000 - Date.now()) + 500 :
      retryAfter > 0    ? retryAfter * 1000 :
      /* fallback */      2000 * (attempt + 1);
    await new Promise(r => setTimeout(r, delayMs));
    return gql(query, variables, attempt + 1);
  }

  if (!res.ok) return null;

  // Cas défensif : AniList peut renvoyer HTTP 200 avec un 429 dans le corps GraphQL
  if (errors?.some(e => e.status === 429) && attempt < 3) {
    await new Promise(r => setTimeout(r, 60_000));
    return gql(query, variables, attempt + 1);
  }

  if (errors?.length) return null;
  return body?.data ?? null;
}

