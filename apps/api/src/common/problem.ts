/** Stable machine-readable error codes. HTTP status is derived per throw site. */
export const ERROR_CODES = [
  'AUTH_INVALID_CREDENTIALS',
  'AUTH_EMAIL_NOT_VERIFIED',
  'AUTH_TOKEN_EXPIRED',
  'AUTH_REFRESH_REUSED',
  'AUTH_TOTP_REQUIRED',
  'AUTH_TOTP_INVALID',
  'SYNC_VERSION_CONFLICT',
  'SYNC_INVALID_DOCUMENT',
  'SYNC_DOCUMENT_TOO_LARGE',
  'SYNC_SCHEMA_OUTDATED',
  'SYNC_SCHEMA_FUTURE',
  'SYNC_RULE_VIOLATION',
  'IDEMPOTENCY_KEY_REUSED',
  'IDEMPOTENCY_KEY_MISSING',
  'DEVICE_REVOKED',
  'DEVICE_NOT_FOUND',
  'USER_NOT_FOUND',
  'USER_DISABLED',
  'INVITE_INVALID',
  'INVITE_EXPIRED',
  'INVITE_USED',
  'RESET_INVALID',
  'RESET_EXPIRED',
  'RESET_USED',
  'FORBIDDEN',
  'RATE_LIMITED',
  'VALIDATION_FAILED',
  'INTERNAL',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  code: ErrorCode;
  detail?: string;
  traceId?: string;
  currentVersion?: string;
  currentUpdatedAt?: string;
}

export function problemType(code: ErrorCode): string {
  return `https://lifespire.app/errors/${kebab(code)}`;
}

function kebab(code: string): string {
  return code.toLowerCase().replace(/_/g, '-');
}
