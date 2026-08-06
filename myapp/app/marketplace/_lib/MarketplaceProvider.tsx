"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { User } from "@/lib/marketplace/types";
import { useSession } from "@/lib/auth-context";
import { ensureUserProfile } from "../_lib/profile";
import { mapProfileToUser, type ProfileRow } from "../_lib/mappers";
import { isAdminFromProfile } from "@/lib/marketplace/usm-identity";

type MarketplaceUser = User & {
  email?: string;
};

type MarketplaceContextValue = {
  profile: MarketplaceUser | null;
  isAdmin: boolean;
  profileLoading: boolean;
};

const MarketplaceContext = createContext<MarketplaceContextValue>({
  profile: null,
  isAdmin: false,
  profileLoading: true,
});

export function useMarketplaceUser() {
  return useContext(MarketplaceContext);
}

/**
 * Auto-provisions the marketplace profile row on first visit (covers users
 * who registered before 0014_marketplace.sql was applied; new signups get
 * the row via the on_auth_user_created DB trigger) and exposes the mapped
 * profile + admin flag to all marketplace pages.
 */
export function MarketplaceProvider({ children }: { children: React.ReactNode }) {
  const { supabase, user } = useSession();
  const [profile, setProfile] = useState<MarketplaceUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      if (!user) {
        setProfile(null);
        setIsAdmin(false);
        setProfileLoading(false);
        return;
      }
      setProfileLoading(true);
      try {
        const row = await ensureUserProfile(supabase, user);
        if (!cancelled) {
          const mapped = mapProfileToUser(row as ProfileRow);
          setProfile({ ...mapped, email: user.email });
          setIsAdmin(
            isAdminFromProfile({ role: mapped.role, email: user.email })
          );
        }
      } catch (error) {
        console.error("[MARKETPLACE] Failed to load profile:", error);
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    };

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [supabase, user]);

  return (
    <MarketplaceContext.Provider value={{ profile, isAdmin, profileLoading }}>
      {children}
    </MarketplaceContext.Provider>
  );
}
