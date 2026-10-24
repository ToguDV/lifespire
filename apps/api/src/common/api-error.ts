import { HttpException } from '@nestjs/common';
import type { ErrorCode } from './problem';
import { problemType } from './problem';

export interface ApiErrorOptions {
  status: number;
  code: ErrorCode;
  title: string;
  detail?: string;
  currentVersion?: string;
  currentUpdatedAt?: string;
}

/** Domain-aware HTTP error that the ProblemFilter renders as application/problem+json. */
export class ApiError extends HttpException {
  readonly code: ErrorCode;
  readonly title: string;
  readonly currentVersion?: string;
  readonly currentUpdatedAt?: string;

  constructor(options: ApiErrorOptions) {
    super(
      {
        type: problemType(options.code),
        title: options.title,
        status: options.status,
        code: options.code,
        ...(options.detail ? { detail: options.detail } : {}),
        ...(options.currentVersion ? { currentVersion: options.currentVersion } : {}),
        ...(options.currentUpdatedAt ? { currentUpdatedAt: options.currentUpdatedAt } : {}),
      },
      options.status,
    );
    this.code = options.code;
    this.title = options.title;
    this.currentVersion = options.currentVersion;
    this.currentUpdatedAt = options.currentUpdatedAt;
  }
}
