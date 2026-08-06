import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Product, User } from "@/lib/marketplace/types";
import { mapProductRow, mapProfileToUser, type ProductRow, type ProfileRow } from "./mappers";
import { BROWSEABLE_STATUSES } from "@/lib/marketplace/product-status";
import { ensureUserProfile } from "./profile";

const PRODUCT_SELECT = "*, profiles:seller_id(*)";

/** Server-side read of browseable products (RLS-enforced via cookie session). */
export async function fetchBrowseableProducts(): Promise<Product[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .in("status", BROWSEABLE_STATUSES)
    .order("date_added", { ascending: false });

  if (error) throw error;
  return (data as ProductRow[] | null)?.map(mapProductRow) ?? [];
}

export async function fetchRecentProducts(limit = 3): Promise<Product[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .in("status", BROWSEABLE_STATUSES)
    .order("date_added", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data as ProductRow[] | null)?.map(mapProductRow) ?? [];
}

export async function fetchProductById(id: string): Promise<Product | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data ? mapProductRow(data as ProductRow) : null;
}

export async function fetchProductsBySeller(sellerId: string): Promise<Product[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("seller_id", sellerId)
    .order("date_added", { ascending: false });

  if (error) throw error;
  return (data as ProductRow[] | null)?.map(mapProductRow) ?? [];
}

/** Profile for the signed-in user, auto-provisioning the row on first visit. */
export async function fetchCurrentMarketplaceUser(): Promise<{
  user: User | null;
  isAdmin: boolean;
} | null> {
  const supabase = await createServerSupabaseClient();
  const { data: authData } = await supabase.auth.getUser();
  const authUser = authData?.user;
  if (!authUser) return null;

  const row = await ensureUserProfile(supabase, authUser);
  const profile = mapProfileToUser(row as ProfileRow);
  const isAdmin = profile.role === "admin" || /admin@usm\.my$/i.test(authUser.email || "");
  return { user: profile, isAdmin };
}
