import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { ValidationError } from './errorHandler';

export interface DeductRequestBody {
    orderId: string;
    items: Array<{ itemId: string; quantity: number }>;
}

export const validateDeductRequest = (
    req: Request,
    _res: Response,
    next: NextFunction
): void => {
    const { orderId, items } = req.body as DeductRequestBody;

    if (!orderId || typeof orderId !== 'string' || orderId.trim().length === 0) {
        throw new ValidationError('orderId is required and must be a non-empty string');
    }

    if (!Array.isArray(items) || items.length === 0) {
        throw new ValidationError('items must be a non-empty array');
    }

    for (let i = 0; i < items.length; i++) {
        const item = items[i];

        if (!item.itemId || typeof item.itemId !== 'string') {
            throw new ValidationError(`items[${i}].itemId must be a valid string`);
        }

        if (!mongoose.Types.ObjectId.isValid(item.itemId)) {
            throw new ValidationError(`items[${i}].itemId is not a valid ObjectId`);
        }

        if (
            item.quantity === undefined ||
            typeof item.quantity !== 'number' ||
            !Number.isInteger(item.quantity) ||
            item.quantity <= 0
        ) {
            throw new ValidationError(
                `items[${i}].quantity must be a positive integer`
            );
        }
    }

    next();
};
