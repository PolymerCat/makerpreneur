import type { SupabaseClient } from '@supabase/supabase-js';
import type { Report } from '@/lib/marketplace/types';
import { mapReportRow, type ReportRow } from './mappers';

export const REPORT_REASON_MIN = 10;
export const REPORT_REASON_MAX = 500;

export function validateReportReason(reason: string): string | null {
  const trimmed = reason.trim();
  if (trimmed.length < REPORT_REASON_MIN) {
    return `Please provide at least ${REPORT_REASON_MIN} characters.`;
  }
  if (trimmed.length > REPORT_REASON_MAX) {
    return `Reason must be at most ${REPORT_REASON_MAX} characters.`;
  }
  return null;
}

export function formatAdminReportError(error: unknown): string {
  const message =
    error && typeof error === 'object' && 'message' in error
      ? String((error as { message: unknown }).message)
      : error instanceof Error
        ? error.message
        : 'Something went wrong.';

  if (/Only admin/i.test(message)) {
    return 'Only admins can moderate reports.';
  }
  if (/already resolved/i.test(message)) {
    return 'This report was already resolved.';
  }
  if (/Product not found/i.test(message)) {
    return 'The listed product no longer exists.';
  }
  return message.replace(/^.*ERROR:\s*/i, '').trim() || 'Something went wrong.';
}

export async function adminHideListing(
  supabase: SupabaseClient,
  reportId: string
): Promise<Report> {
  const { data, error } = await supabase.rpc('admin_hide_listing', {
    p_report_id: reportId,
  });
  if (error) throw error;
  return mapReportRow(data as ReportRow);
}

export async function adminDismissReport(
  supabase: SupabaseClient,
  reportId: string
): Promise<Report> {
  const { data, error } = await supabase.rpc('admin_dismiss_report', {
    p_report_id: reportId,
  });
  if (error) throw error;
  return mapReportRow(data as ReportRow);
}

export async function adminRestoreListing(
  supabase: SupabaseClient,
  productId: string
): Promise<void> {
  const { error } = await supabase.rpc('admin_restore_listing', {
    p_product_id: productId,
  });
  if (error) throw error;
}
