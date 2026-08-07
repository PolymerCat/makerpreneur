import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  User,
  Product,
  ProductStatus,
  Deal,
  DealStatus,
  Purchase,
  Report,
  Notification,
  Message,
} from '@/lib/marketplace/types';
import { asProductCondition } from '@/lib/marketplace/product-condition';

export type ProfileRow = {
  id: string;
  name: string;
  email: string;
  avatar_url: string;
  is_verified: boolean;
  role?: string | null;
  qr_code_url?: string | null;
  payment_note?: string | null;
};

export type ProductRow = {
  id: string;
  name: string;
  description: string;
  price: number | string;
  category_id: string;
  category_name: string;
  seller_id: string;
  image_urls: string[] | null;
  date_added: string;
  status?: string | null;
  condition?: string | null;
  reserved_by?: string | null;
  status_updated_at?: string | null;
  profiles?: ProfileRow | ProfileRow[] | null;
};

export type PurchaseRow = {
  id: string;
  buyer_id: string;
  seller_id: string;
  product_name: string;
  product_image: string;
  price: number | string;
  seller_name: string;
  buyer_name: string;
  purchase_date: string;
  status: Purchase['status'];
};

export type ReportRow = {
  id: string;
  product_id: string;
  product_name: string;
  reported_by_id: string;
  reported_by_name: string;
  reason: string;
  date: string;
  status?: string | null;
  resolved_at?: string | null;
  resolver_id?: string | null;
  admin_notes?: string | null;
};

export type NotificationRow = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  date: string;
  read: boolean;
  action_url?: string | null;
  action_type?: string | null;
  metadata?: Notification['metadata'] | null;
};

export type MessageRow = {
  id: string;
  chat_id: string;
  sender_id: string;
  text?: string | null;
  image_url?: string | null;
  timestamp: string;
};

export type DealRow = {
  id: string;
  product_id: string;
  buyer_id: string;
  seller_id: string;
  chat_id: string;
  status: string;
  payment_method?: string | null;
  meetup_place?: string | null;
  purchase_id?: string | null;
  created_at: string;
  updated_at: string;
};

function asProfile(profiles?: ProfileRow | ProfileRow[] | null): ProfileRow | null {
  if (!profiles) return null;
  return Array.isArray(profiles) ? profiles[0] ?? null : profiles;
}

function sellerDisplayName(row: ProfileRow): string {
  if (row.name && row.name.trim()) return row.name;
  const local = (row.email || '').split('@')[0].split(/[._-]+/).filter(Boolean);
  if (local.length === 0) return 'Student';
  return local
    .map(function (part) {
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(' ');
}

export function mapProfileToUser(row: ProfileRow): User {
  return {
    id: row.id,
    name: sellerDisplayName(row),
    avatarUrl: row.avatar_url,
    isVerified: row.is_verified,
    role: row.role === "admin" ? "admin" : "user",
    qrCodeUrl: row.qr_code_url ?? undefined,
    paymentNote: row.payment_note ?? undefined,
  };
}

function asProductStatus(value?: string | null): ProductStatus {
  if (value === 'reserved' || value === 'sold' || value === 'hidden') return value;
  return 'available';
}

export function mapProductRow(row: ProductRow): Product {
  const seller = asProfile(row.profiles);
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    category: { id: row.category_id, name: row.category_name },
    seller: seller
      ? mapProfileToUser(seller)
      : {
          id: row.seller_id,
          name: 'Unknown',
          avatarUrl: '',
          isVerified: false,
        },
    imageUrls: row.image_urls ?? [],
    dateAdded: row.date_added,
    status: asProductStatus(row.status),
    condition: asProductCondition(row.condition),
    reservedBy: row.reserved_by ?? undefined,
  };
}

export function mapPurchaseRow(row: PurchaseRow): Purchase {
  return {
    id: row.id,
    productName: row.product_name,
    productImage: row.product_image,
    price: Number(row.price),
    sellerId: row.seller_id,
    sellerName: row.seller_name,
    buyerName: row.buyer_name,
    purchaseDate: { toDate: () => new Date(row.purchase_date) },
    status: row.status,
  };
}

export function mapReportRow(row: ReportRow): Report {
  const status =
    row.status === 'resolved_hidden' || row.status === 'resolved_dismissed'
      ? row.status
      : 'open';

  return {
    id: row.id,
    productId: row.product_id,
    productName: row.product_name,
    reportedBy: { id: row.reported_by_id, name: row.reported_by_name },
    reason: row.reason,
    date: { toDate: () => new Date(row.date) },
    status,
    resolvedAt: row.resolved_at ?? undefined,
    resolverId: row.resolver_id ?? undefined,
    adminNotes: row.admin_notes ?? undefined,
  };
}

export function mapNotificationRow(row: NotificationRow): Notification {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    message: row.message,
    date: { toDate: () => new Date(row.date) },
    read: row.read,
    actionUrl: row.action_url ?? undefined,
    actionType: (row.action_type as Notification['actionType']) ?? undefined,
    metadata: row.metadata ?? undefined,
  };
}

export function mapMessageRow(row: MessageRow): Message {
  return {
    id: row.id,
    text: row.text ?? undefined,
    imageUrl: row.image_url ?? undefined,
    senderId: row.sender_id,
    timestamp: { toDate: () => new Date(row.timestamp) },
  };
}

function asDealStatus(value?: string | null): DealStatus {
  if (
    value === 'interested' ||
    value === 'agreed' ||
    value === 'completed' ||
    value === 'cancelled'
  ) {
    return value;
  }
  return 'interested';
}

export function mapDealRow(row: DealRow): Deal {
  const paymentMethod =
    row.payment_method === 'qr' ||
    row.payment_method === 'bank_transfer' ||
    row.payment_method === 'cash_meetup'
      ? row.payment_method
      : undefined;

  return {
    id: row.id,
    productId: row.product_id,
    buyerId: row.buyer_id,
    sellerId: row.seller_id,
    chatId: row.chat_id,
    status: asDealStatus(row.status),
    paymentMethod,
    meetupPlace: row.meetup_place ?? undefined,
    purchaseId: row.purchase_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function uploadImage(
  supabase: SupabaseClient,
  file: File
): Promise<string> {
  const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  const filename = `${uniqueSuffix}-${file.name.replace(/\s/g, '_')}`;
  const path = filename;

  const { error } = await supabase.storage
    .from('image_uploads')
    .upload(path, file, { upsert: false });

  if (error) throw error;

  const { data } = supabase.storage.from('image_uploads').getPublicUrl(path);
  return data.publicUrl;
}
