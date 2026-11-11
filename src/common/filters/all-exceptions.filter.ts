import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import mongoose from 'mongoose';

interface MongoDuplicateKeyError {
  code?: number;
  keyValue?: Record<string, unknown>;
}

/**
 * Centralized exception filter handling HTTP exceptions, Mongoose validation/cast
 * errors, MongoDB duplicate-key errors, and unexpected runtime errors.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        error = exception.name;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null
      ) {
        const resObj = exceptionResponse as Record<string, unknown>;
        message =
          (resObj.message as string | string[]) ||
          exception.message ||
          'Request failed';
        error = (resObj.error as string) || exception.name;
      }
    } else if (this.isMongoDuplicateKeyError(exception)) {
      status = HttpStatus.CONFLICT;
      error = 'Conflict';
      const duplicateFields = exception.keyValue
        ? Object.keys(exception.keyValue).join(', ')
        : 'field';
      message = `A record with this ${duplicateFields} already exists`;
    } else if (exception instanceof mongoose.Error.ValidationError) {
      status = HttpStatus.BAD_REQUEST;
      error = 'Bad Request';
      message = Object.values(exception.errors).map((err) => err.message);
    } else if (exception instanceof mongoose.Error.CastError) {
      status = HttpStatus.BAD_REQUEST;
      error = 'Bad Request';
      message = `Invalid ${exception.path}: ${String(exception.value)}`;
    } else if (exception instanceof Error) {
      this.logger.error(
        `Unhandled error on ${request.method} ${request.url}: ${exception.message}`,
        exception.stack,
      );
    }

    response.status(status).json({
      statusCode: status,
      error,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private isMongoDuplicateKeyError(
    exception: unknown,
  ): exception is MongoDuplicateKeyError {
    return (
      typeof exception === 'object' &&
      exception !== null &&
      'code' in exception &&
      (exception as MongoDuplicateKeyError).code === 11000
    );
  }
}
