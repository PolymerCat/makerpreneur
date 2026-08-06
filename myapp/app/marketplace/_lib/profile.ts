import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { ProfileRow } from './mappers';
import { formatSupabaseError, isMissingTableError, SCHEMA_SETUP_MESSAGE } from './errors';
import { identityFromEmail } from '@/lib/marketplace/usm-identity';

/**
 * Ensure a profiles row exists for the signed-in user. The DB trigger
 * (0014_marketplace.sql on_auth_user_created) creates it on signup; this
 * covers users who registered before the marketplace schema was applied.
 * Server-side variant: use the cookie-scoped server client (RLS applies).
 */
export async function ensureUserProfile(
  supabase: SupabaseClient,
  user: User
): Promise<ProfileRow> {
  const { data: existing, error: readError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (readError) {
    if (isMissingTableError(readError)) {
      throw new Error(SCHEMA_SETUP_MESSAGE);
    }
    throw new Error(formatSupabaseError(readError));
  }

  if (existing) {
    const { data: synced, error: syncError } = await supabase.rpc('sync_profile_identity');
    if (!syncError && synced) {
      return synced as ProfileRow;
    }
    // RPC may be missing before migration is applied; fall back to existing row.
    return existing as ProfileRow;
  }

  const avatarUrl =
    (user.user_metadata?.avatar_url as string | undefined) ||
    `https://picsum.photos/seed/${user.id}/100/100`;
  const identity = identityFromEmail(user.email);

  const profile = {
    id: user.id,
    name:
      (user.user_metadata?.name as string | undefined) ||
      user.email?.split('@')[0] ||
      'User',
    email: user.email || '',
    avatar_url: avatarUrl,
    is_verified: identity.isVerified,
    role: identity.role,
  };

  const { data: created, error: insertError } = await supabase
    .from('profiles')
    .upsert(profile)
    .select()
    .single();

  if (insertError) {
    throw new Error(formatSupabaseError(insertError));
  }

  return created as ProfileRow;
}
