import type { SupabaseClient } from '@supabase/supabase-js';
import type { Deal, DealStatus, Product, User } from '@/lib/marketplace/types';
import { mapDealRow, type DealRow } from './mappers';

export function dealStatusLabel(status: DealStatus): string {
  switch (status) {
    case 'interested':
      return 'Interested';
    case 'agreed':
      return 'Agreed (reserved)';
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
  }
}

export function isOpenDeal(status: DealStatus): boolean {
  return status === 'interested' || status === 'agreed';
}

export type DealAction = 'interested' | 'agree' | 'complete' | 'cancel';

export function availableDealActions(args: {
  deal: Deal | null;
  product: Product;
  currentUserId: string;
  otherUserId: string;
}): DealAction[] {
  const { deal, product, currentUserId, otherUserId } = args;
  const isSeller = product.seller.id === currentUserId;
  const isBuyer = !isSeller && product.seller.id === otherUserId;

  if (!deal) {
    if (
      isBuyer &&
      product.status === 'available' &&
      product.seller.id !== currentUserId
    ) {
      return ['interested'];
    }
    return [];
  }

  // Only show controls in the chat that owns this deal
  if (deal.buyerId !== currentUserId && deal.sellerId !== currentUserId) {
    return [];
  }
  if (isSeller && deal.buyerId !== otherUserId) {
    return [];
  }
  if (isBuyer && deal.buyerId !== currentUserId) {
    return [];
  }

  if (deal.status === 'interested') {
    if (isSeller) return ['agree', 'cancel'];
    if (isBuyer) return ['cancel'];
  }
  if (deal.status === 'agreed') {
    if (isSeller) return ['complete', 'cancel'];
    if (isBuyer) return ['cancel'];
  }
  return [];
}

export function formatDealRpcError(error: unknown): string {
  const message =
    error && typeof error === 'object' && 'message' in error
      ? String((error as { message: unknown }).message)
      : error instanceof Error
        ? error.message
        : 'Something went wrong.';

  if (/already in a deal/i.test(message) || /unique/i.test(message)) {
    return 'Someone is already in a deal for this item.';
  }
  if (/not available for a new deal/i.test(message)) {
    return 'This item is reserved or unavailable.';
  }
  if (/Only the seller can complete/i.test(message)) {
    return 'Only the seller can mark the deal completed.';
  }
  if (/Only the seller can agree/i.test(message)) {
    return 'Only the seller can agree this deal.';
  }
  if (/Chat not found/i.test(message)) {
    return 'Send a message first, then try again.';
  }
  return message.replace(/^.*ERROR:\s*/i, '').trim() || 'Something went wrong.';
}

async function ensureChatExists(
  supabase: SupabaseClient,
  chatId: string,
  currentUser: User,
  otherUser: User
) {
  const { error } = await supabase.from('chats').upsert({
    id: chatId,
    users: [currentUser.id, otherUser.id],
    last_message: 'Deal started',
    last_updated: new Date().toISOString(),
    participants: {
      [currentUser.id]: { name: currentUser.name, avatarUrl: currentUser.avatarUrl },
      [otherUser.id]: { name: otherUser.name, avatarUrl: otherUser.avatarUrl },
    },
  });
  if (error) throw error;
}

export async function fetchDealForChatProduct(
  supabase: SupabaseClient,
  args: { productId: string; chatId: string; userId: string }
): Promise<Deal | null> {
  const { data, error } = await supabase
    .from('deals')
    .select('*')
    .eq('product_id', args.productId)
    .eq('chat_id', args.chatId)
    .or(`buyer_id.eq.${args.userId},seller_id.eq.${args.userId}`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ? mapDealRow(data as DealRow) : null;
}

export async function expressInterest(args: {
  supabase: SupabaseClient;
  product: Product;
  chatId: string;
  currentUser: User;
  otherUser: User;
}): Promise<Deal> {
  const { supabase, product, chatId, currentUser, otherUser } = args;
  await ensureChatExists(supabase, chatId, currentUser, otherUser);

  const { data, error } = await supabase.rpc('express_deal_interest', {
    p_product_id: product.id,
    p_seller_id: product.seller.id,
    p_chat_id: chatId,
  });
  if (error) throw error;
  return mapDealRow(data as DealRow);
}

export async function agreeDeal(supabase: SupabaseClient, dealId: string): Promise<Deal> {
  const { data, error } = await supabase.rpc('agree_deal', { p_deal_id: dealId });
  if (error) throw error;
  return mapDealRow(data as DealRow);
}

export async function cancelDeal(supabase: SupabaseClient, dealId: string): Promise<Deal> {
  const { data, error } = await supabase.rpc('cancel_deal', { p_deal_id: dealId });
  if (error) throw error;
  return mapDealRow(data as DealRow);
}

export async function completeDeal(supabase: SupabaseClient, dealId: string): Promise<Deal> {
  const { data, error } = await supabase.rpc('complete_deal', { p_deal_id: dealId });
  if (error) throw error;
  return mapDealRow(data as DealRow);
}
