import type { SupabaseClient } from '@supabase/supabase-js';

export async function notifySellerOfReport(
  supabase: SupabaseClient,
  args: { productId: string; reason: string }
): Promise<void> {
  const { error } = await supabase.rpc('notify_seller_of_report', {
    p_product_id: args.productId,
    p_reason: args.reason,
  });
  if (error) throw error;
}

export async function notifyDealRecorded(
  supabase: SupabaseClient,
  args: {
    purchaseId: string;
    method: 'qr' | 'cash_meetup';
    productId?: string;
  }
): Promise<void> {
  const { error } = await supabase.rpc('notify_deal_recorded', {
    p_purchase_id: args.purchaseId,
    p_method: args.method,
    p_product_id: args.productId ?? null,
  });
  if (error) throw error;
}

export async function notifyAdminDeletedListing(
  supabase: SupabaseClient,
  args: { productId: string; productName: string; sellerId: string }
): Promise<void> {
  const { error } = await supabase.rpc('notify_admin_deleted_listing', {
    p_product_id: args.productId,
    p_product_name: args.productName,
    p_seller_id: args.sellerId,
  });
  if (error) throw error;
}
