/** Parses a comma-separated list of emails from an env var (trimmed, lowercased). */
export function parseEmailList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Admins may edit data shared by every user, such as relations between shows.
 * They are listed in ADMIN_EMAILS; when it is unset, nobody is an admin.
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return parseEmailList(process.env.ADMIN_EMAILS).includes(email.toLowerCase());
}
