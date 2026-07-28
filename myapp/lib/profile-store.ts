const PROFILES_KEY = "sh_profiles";

export type Profile = {
  id: string;
  full_name: string;
  created_at: string;
  updated_at: string;
};

export function getProfiles(): Profile[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(PROFILES_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function getProfile(userId: string): Profile | undefined {
  return getProfiles().find(p => p.id === userId);
}

export function upsertProfile(userId: string, fullName: string): Profile {
  const raw = localStorage.getItem(PROFILES_KEY);
  const profiles: Profile[] = raw ? JSON.parse(raw) : [];
  const now = new Date().toISOString();
  const idx = profiles.findIndex(p => p.id === userId);

  if (idx >= 0) {
    profiles[idx] = { ...profiles[idx], full_name: fullName, updated_at: now };
  } else {
    profiles.push({ id: userId, full_name: fullName, created_at: now, updated_at: now });
  }

  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
  return profiles[idx >= 0 ? idx : profiles.length - 1];
}
