import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

export class AppError extends Error {
    public readonly statusCode: number;
    public readonly isOperational: boolean;

    constructor(message: string, statusCode: number, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        Object.setPrototypeOf(this, AppError.prototype);
    }
}

export class InsufficientStockError extends AppError {
    constructor(message: string) {
        super(message, 409);
    }
}

export class DuplicateOrderError extends AppError {
    constructor(message: string) {
        super(message, 409);
    }
}

export class ValidationError extends AppError {
    constructor(message: string) {
        super(message, 400);
    }
}

export class ServiceUnavailableError extends AppError {
    constructor(message: string) {
        super(message, 503);
    }
}

export const errorHandler = (
    err: Error,
    _req: Request,
    res: Response,
    _next: NextFunction
): void => {
    if (err instanceof AppError) {
        res.status(err.statusCode).json({
            success: false,
            error: err.message,
        });
        return;
    }

    // Unexpected errors
    logger.error('Unhandled error', { error: err.message, stack: err.stack });
    res.status(500).json({
        success: false,
        error: 'Internal server error',
    });
};
