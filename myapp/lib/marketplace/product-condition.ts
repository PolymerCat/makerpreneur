export const PRODUCT_CONDITIONS = [
  'new',
  'like_new',
  'good',
  'fair',
] as const;

export type ProductCondition = (typeof PRODUCT_CONDITIONS)[number];

export const PRODUCT_CONDITION_OPTIONS: {
  value: ProductCondition;
  label: string;
}[] = [
  { value: 'new', label: 'New' },
  { value: 'like_new', label: 'Like new' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
];

export function conditionLabel(condition: ProductCondition | string | null | undefined): string {
  const match = PRODUCT_CONDITION_OPTIONS.find((o) => o.value === condition);
  return match?.label ?? 'Good';
}

export function asProductCondition(value?: string | null): ProductCondition {
  if (
    value === 'new' ||
    value === 'like_new' ||
    value === 'good' ||
    value === 'fair'
  ) {
    return value;
  }
  return 'good';
}
