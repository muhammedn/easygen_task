import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

type ErrorBody = {
  statusCode: number;
  message: string | string[];
  error: string;
  timestamp: string;
  path: string;
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { statusCode, message, error, stack } =
      this.normalizeException(exception);

    const body: ErrorBody = {
      statusCode,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    if (statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.url} ${statusCode}`,
        stack,
      );
    } else {
      this.logger.warn(
        `${request.method} ${request.url} ${statusCode} - ${this.stringifyMessage(message)}`,
      );
    }

    response.status(statusCode).json(body);
  }

  private normalizeException(exception: unknown): {
    statusCode: number;
    message: string | string[];
    error: string;
    stack?: string;
  } {
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        return {
          statusCode,
          message: exceptionResponse,
          error: exception.name.replace(/Exception$/, '') || 'Error',
          stack: exception.stack,
        };
      }

      const responseObj = exceptionResponse as {
        message?: string | string[];
        error?: string;
        statusCode?: number;
      };

      return {
        statusCode,
        message: responseObj.message ?? exception.message,
        error:
          responseObj.error ??
          (exception.name.replace(/Exception$/, '') || 'Error'),
        stack: exception.stack,
      };
    }

    const error =
      exception instanceof Error ? exception : new Error('Unknown error');

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: 'Internal Server Error',
      stack: error.stack,
    };
  }

  private stringifyMessage(message: string | string[]): string {
    return Array.isArray(message) ? message.join('; ') : message;
  }
}
