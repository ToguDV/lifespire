import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { ApiError } from './api-error';
import { problemType } from './problem';

function isBodyTooLarge(exception: unknown): boolean {
  if (typeof exception !== 'object' || exception === null) return false;
  const err = exception as { type?: unknown; status?: unknown };
  return err.type === 'entity.too.large' || err.status === 413;
}
function isPrismaUniqueViolation(exception: unknown): boolean {
  if (typeof exception !== 'object' || exception === null) return false;
  return (exception as { code?: unknown }).code === 'P2002';
}

@Catch()
export class ProblemFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const traceId = (req.headers['x-request-id'] as string) ?? randomUUID();

    if (exception instanceof ApiError) {
      const body = exception.getResponse() as Record<string, unknown>;
      res
        .status(exception.getStatus())
        .type('application/problem+json')
        .json({ ...body, traceId });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      const detail = typeof response === 'string' ? response : JSON.stringify(response);
      res
        .status(status)
        .type('application/problem+json')
        .json({
          type: problemType('VALIDATION_FAILED'),
          title: status === 429 ? 'Too many requests' : 'Request failed',
          status,
          code: status === 429 ? 'RATE_LIMITED' : 'VALIDATION_FAILED',
          detail,
          traceId,
        });
      return;
    }

    if (isBodyTooLarge(exception)) {
      res
        .status(HttpStatus.PAYLOAD_TOO_LARGE)
        .type('application/problem+json')
        .json({
          type: problemType('SYNC_DOCUMENT_TOO_LARGE'),
          title: 'Request body too large',
          status: 413,
          code: 'SYNC_DOCUMENT_TOO_LARGE',
          traceId,
        });
      return;
    }

    if (isPrismaUniqueViolation(exception)) {
      res
        .status(HttpStatus.CONFLICT)
        .type('application/problem+json')
        .json({
          type: problemType('VALIDATION_FAILED'),
          title: 'Conflict',
          status: 409,
          code: 'VALIDATION_FAILED',
          traceId,
        });
      return;
    }

    // Unknown error: generic 500 with no detail so internals never leak.
    res
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .type('application/problem+json')
      .json({
        type: problemType('INTERNAL'),
        title: 'Internal server error',
        status: 500,
        code: 'INTERNAL',
        traceId,
      });
  }
}
