/** Format Supabase/PostgREST errors for logging and toasts. */
export function formatSupabaseError(error: unknown): string {
  if (!error) return 'Unknown error';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;

  const e = error as Record<string, unknown>;
  const parts = [e.message, e.details, e.hint, e.code]
    .filter((part) => typeof part === 'string' && part.length > 0);
  if (parts.length > 0) return parts.join(' — ');

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function isMissingTableError(error: unknown): boolean {
  const message = formatSupabaseError(error).toLowerCase();
  return (
    message.includes('pgrst205') ||
    message.includes('could not find the table') ||
    message.includes('schema cache')
  );
}

export const SCHEMA_SETUP_MESSAGE =
  'Database tables are missing. Open Supabase → SQL Editor → paste and run 0014_marketplace.sql, then refresh this page.';
