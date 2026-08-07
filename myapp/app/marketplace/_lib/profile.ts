import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { ProfileRow } from './mappers';
import { displayNameFromProfile } from './mappers';
import { formatSupabaseError, isMissingTableError, SCHEMA_SETUP_MESSAGE } from './errors';
import { identityFromEmail } from '@/lib/marketplace/usm-identity';

function isMissingColumnError(error: unknown): boolean {
  var message = formatSupabaseError(error).toLowerCase();
  return (
    message.includes('pgrst204') ||
    message.includes('could not find the') ||
    (message.includes('column') && message.includes('does not exist')) ||
    message.includes('schema cache')
  );
}

function displayNameForUser(user: User): string {
  var metaName = (user.user_metadata?.name as string | undefined) || '';
  var metaFull = (user.user_metadata?.full_name as string | undefined) || '';
  var trimmed = (metaName || metaFull || '').trim();
  if (trimmed) return trimmed;
  var local = user.email?.split('@')[0];
  return local || 'User';
}

/**
 * Ensure a profiles row exists for the signed-in user. The DB trigger
 * (0014 / 0019) creates it on signup; this covers users who registered
 * before the marketplace schema was applied, and backfills `name` from
 * study-hub `full_name` when needed.
 */
export async function ensureUserProfile(
  supabase: SupabaseClient,
  user: User
): Promise<ProfileRow> {
  var { data: existing, error: readError } = await supabase
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
    var { data: synced, error: syncError } = await supabase.rpc('sync_profile_identity');
    var row = (!syncError && synced ? synced : existing) as ProfileRow;

    // Persist marketplace `name` from study-hub `full_name` (or auth metadata).
    var resolved = displayNameFromProfile(row);
    if (!(row.name || '').trim()) {
      var fillFrom =
        (row.full_name || '').trim() ||
        (resolved !== 'Unknown' ? resolved : '') ||
        displayNameForUser(user);
      if (fillFrom) {
        row = await backfillDisplayName(supabase, user.id, row, fillFrom);
      }
    }

    return row;
  }

  var avatarUrl =
    (user.user_metadata?.avatar_url as string | undefined) ||
    `https://picsum.photos/seed/${user.id}/100/100`;
  var identity = identityFromEmail(user.email);
  var displayName = displayNameForUser(user);

  var created = await insertProfileFlexible(supabase, {
    id: user.id,
    name: displayName,
    full_name: displayName,
    email: user.email || '',
    avatar_url: avatarUrl,
    is_verified: identity.isVerified,
    role: identity.role,
    preferred_language: 'en',
  });

  return created;
}

async function backfillDisplayName(
  supabase: SupabaseClient,
  userId: string,
  row: ProfileRow,
  displayName: string
): Promise<ProfileRow> {
  if (!displayName || displayName === 'Unknown') return row;

  var attempts: Record<string, unknown>[] = [
    { name: displayName, full_name: displayName },
    { name: displayName },
    { full_name: displayName },
  ];

  for (var i = 0; i < attempts.length; i++) {
    var { data, error } = await supabase
      .from('profiles')
      .update(attempts[i])
      .eq('id', userId)
      .select('*')
      .maybeSingle();
    if (!error && data) return data as ProfileRow;
    if (error && !isMissingColumnError(error)) break;
  }

  return {
    ...row,
    name: row.name || displayName,
    full_name: row.full_name || displayName,
  };
}

async function insertProfileFlexible(
  supabase: SupabaseClient,
  profile: {
    id: string;
    name: string;
    full_name: string;
    email: string;
    avatar_url: string;
    is_verified: boolean;
    role: string;
    preferred_language: string;
  }
): Promise<ProfileRow> {
  var attempts: Record<string, unknown>[] = [
    {
      id: profile.id,
      name: profile.name,
      full_name: profile.full_name,
      email: profile.email,
      avatar_url: profile.avatar_url,
      is_verified: profile.is_verified,
      role: profile.role,
      preferred_language: profile.preferred_language,
    },
    {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      avatar_url: profile.avatar_url,
      is_verified: profile.is_verified,
      role: profile.role,
    },
    {
      id: profile.id,
      full_name: profile.full_name,
      preferred_language: profile.preferred_language,
      role: profile.role === 'admin' ? 'admin' : 'student',
    },
    {
      id: profile.id,
      full_name: profile.full_name,
      preferred_language: profile.preferred_language,
    },
  ];

  var lastError: unknown = null;
  for (var i = 0; i < attempts.length; i++) {
    var { data: created, error: insertError } = await supabase
      .from('profiles')
      .upsert(attempts[i], { onConflict: 'id' })
      .select('*')
      .single();

    if (!insertError && created) {
      return created as ProfileRow;
    }
    lastError = insertError;
    if (
      insertError &&
      !isMissingColumnError(insertError) &&
      !isRoleConstraintError(insertError)
    ) {
      throw new Error(formatSupabaseError(insertError));
    }
  }

  throw new Error(formatSupabaseError(lastError));
}

function isRoleConstraintError(error: unknown): boolean {
  var message = formatSupabaseError(error).toLowerCase();
  return message.includes('profiles_role_check') || message.includes('role');
}

export type MarketplaceProfileUpdate = {
  displayName: string;
  paymentNote?: string | null;
  avatarUrl?: string;
  qrCodeUrl?: string | null;
};

/**
 * Update marketplace profile fields while keeping study-hub `full_name` in sync
 * when that column exists.
 */
export async function updateMarketplaceProfile(
  supabase: SupabaseClient,
  userId: string,
  fields: MarketplaceProfileUpdate
): Promise<void> {
  var base: Record<string, unknown> = {
    name: fields.displayName,
    full_name: fields.displayName,
  };
  if (fields.paymentNote !== undefined) {
    base.payment_note = fields.paymentNote;
  }
  if (fields.avatarUrl !== undefined) {
    base.avatar_url = fields.avatarUrl;
  }
  if (fields.qrCodeUrl !== undefined) {
    base.qr_code_url = fields.qrCodeUrl;
  }

  var attempts: Record<string, unknown>[] = [
    base,
    omitKeys(base, ['full_name']),
    omitKeys(base, ['name']),
    omitKeys(base, ['payment_note', 'qr_code_url', 'avatar_url']),
  ];

  var lastError: unknown = null;
  for (var i = 0; i < attempts.length; i++) {
    var payload = attempts[i];
    if (!payload.name && !payload.full_name && fields.displayName) {
      continue;
    }
    var { error } = await supabase.from('profiles').update(payload).eq('id', userId);
    if (!error) return;
    lastError = error;
    if (!isMissingColumnError(error)) {
      throw new Error(formatSupabaseError(error));
    }
  }

  throw new Error(formatSupabaseError(lastError) || 'Failed to update profile');
}

function omitKeys(
  source: Record<string, unknown>,
  keys: string[]
): Record<string, unknown> {
  var next: Record<string, unknown> = {};
  var skip: Record<string, boolean> = {};
  for (var i = 0; i < keys.length; i++) skip[keys[i]] = true;
  for (var key in source) {
    if (!skip[key]) next[key] = source[key];
  }
  return next;
}
