export const STUDENT_EMAIL_SUFFIX = '@student.usm.my';
export const ADMIN_EMAIL = 'admin@usm.my';

export type ProfileRole = 'user' | 'admin';

export function isStudentEmail(email: string | null | undefined): boolean {
  return (email ?? '').toLowerCase().endsWith(STUDENT_EMAIL_SUFFIX);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  return (email ?? '').toLowerCase() === ADMIN_EMAIL;
}

export function isAllowedRegisterEmail(email: string): boolean {
  return isStudentEmail(email) || isAdminEmail(email);
}

export function identityFromEmail(email: string | null | undefined): {
  isVerified: boolean;
  role: ProfileRole;
} {
  if (isAdminEmail(email)) {
    return { isVerified: true, role: 'admin' };
  }
  if (isStudentEmail(email)) {
    return { isVerified: true, role: 'user' };
  }
  return { isVerified: false, role: 'user' };
}

/** Client-side admin check: prefer DB role, fall back to admin email during migration. */
export function isAdminFromProfile(args: {
  role?: ProfileRole | null;
  email?: string | null;
}): boolean {
  return args.role === 'admin' || isAdminEmail(args.email);
}
