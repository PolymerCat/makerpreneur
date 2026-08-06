import type { ProductStatus } from './types';

export const BROWSEABLE_STATUSES: ProductStatus[] = ['available', 'reserved'];

export const SELLER_STATUS_ACTIONS: {
  status: Exclude<ProductStatus, 'hidden'>;
  label: string;
}[] = [
  { status: 'available', label: 'Mark available' },
  { status: 'reserved', label: 'Mark reserved' },
  { status: 'sold', label: 'Mark sold' },
];

export function canBrowseStatus(status: ProductStatus): boolean {
  return status === 'available' || status === 'reserved';
}

export function canMessageOrSave(status: ProductStatus): boolean {
  return status === 'available' || status === 'reserved';
}

export function statusBadgeLabel(status: ProductStatus): string | null {
  if (status === 'available') return null;
  if (status === 'reserved') return 'Reserved';
  if (status === 'sold') return 'Sold';
  return 'Unavailable';
}
