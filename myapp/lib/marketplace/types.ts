export type Category = {
  id: string;
  name: string;
};

export type User = {
  id: string;
  name: string;
  avatarUrl: string;
  isVerified: boolean;
  role?: 'user' | 'admin';
  qrCodeUrl?: string;
  paymentNote?: string;
};

export type ProductStatus = 'available' | 'reserved' | 'sold' | 'hidden';

export type ProductCondition = 'new' | 'like_new' | 'good' | 'fair';

export type DealStatus = 'interested' | 'agreed' | 'completed' | 'cancelled';

export type Deal = {
  id: string;
  productId: string;
  buyerId: string;
  sellerId: string;
  chatId: string;
  status: DealStatus;
  paymentMethod?: 'qr' | 'bank_transfer' | 'cash_meetup';
  meetupPlace?: string;
  purchaseId?: string;
  createdAt: string;
  updatedAt: string;
};

export type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: Category;
  seller: User;
  imageUrls: string[];
  dateAdded: string;
  status: ProductStatus;
  condition: ProductCondition;
  reservedBy?: string;
};

export type CartItem = {
  product: Product;
  quantity: number;
  status: 'Unpaid' | 'Paid' | 'Confirmed' | 'Successful';
};

export type Message = {
  id: string;
  text?: string;
  imageUrl?: string;
  senderId: string;
  timestamp: any; // Date-like with toDate() for UI compatibility
};

export type Purchase = {
  id: string;
  productName: string;
  productImage: string;
  price: number;
  sellerId: string;
  sellerName: string;
  buyerName: string;
  purchaseDate: any; // Date-like with toDate() for UI compatibility
  status: 'Pending' | 'Successful' | 'Delivered' | 'Cancelled';
};

export type ReportStatus = 'open' | 'resolved_hidden' | 'resolved_dismissed';

export type Report = {
  id: string;
  productId: string;
  productName: string;
  reportedBy: {
    id: string;
    name: string;
  };
  reason: string;
  date: any; // Date-like with toDate() for UI compatibility
  status: ReportStatus;
  resolvedAt?: string;
  resolverId?: string;
  adminNotes?: string;
};

export type Notification = {
  id: string;
  userId: string;
  title: string;
  message: string;
  date: any; // Date-like with toDate() for UI compatibility
  read: boolean;
  actionUrl?: string;
  actionType?: 'confirm_transaction';
  metadata?: {
    buyerId?: string;
    productId?: string;
    purchaseId?: string;
  };
};
