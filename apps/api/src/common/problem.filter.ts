import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { ApiError } from './api-error';
import { problemType } from './problem';

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

    res
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .type('application/problem+json')
      .json({
        type: 'https://lifespire.app/errors/internal',
        title: 'Internal server error',
        status: 500,
        code: 'VALIDATION_FAILED',
        traceId,
      });
  }
}
