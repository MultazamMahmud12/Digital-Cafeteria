import { Request, Response, NextFunction } from 'express';
import { stockService, DeductionRequest } from '../services/stockService';
import { stockRepository } from '../repositories/stockRepository';
import { metricsStore } from '../metrics/metricsStore';
import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';

export const stockController = {
    async placeOrder(
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        try {
            metricsStore.incrementRequests();

            const { userId, itemId, quantity } = req.body;

            // Validate input
            if (!userId || !itemId || !quantity) {
                res.status(400).json({
                    success: false,
                    message: 'userId, itemId, and quantity are required',
                });
                return;
            }

            // Resolve itemId: if not a valid ObjectId, try to find by name
            let resolvedItemId = itemId;
            if (!mongoose.Types.ObjectId.isValid(itemId)) {
                const item = await stockRepository.findByName(itemId);
                if (!item) {
                    res.status(404).json({
                        success: false,
                        message: `Item '${itemId}' not found`,
                    });
                    return;
                }
                resolvedItemId = item._id;
            }

            // Generate order ID
            const orderId = uuidv4();

            // Convert to deduction format
            const deductionRequest: DeductionRequest = {
                orderId,
                items: [{ itemId: resolvedItemId, quantity }],
            };

            const result = await stockService.deductStock(deductionRequest);

            // Get remaining stock
            const stockInfo = await stockService.getStock(resolvedItemId);

            res.status(201).json({
                message: 'Order placed successfully',
                orderId: result.orderId,
                itemId: resolvedItemId,
                quantity,
                remainingStock: stockInfo.available,
                status: 'CONFIRMED',
            });
        } catch (error) {
            next(error);
        }
    },

    async deductStock(
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        try {
            metricsStore.incrementRequests();

            const { orderId, items } = req.body as DeductionRequest;

            const result = await stockService.deductStock({ orderId, items });

            res.status(200).json({
                success: true,
                data: result,
            });
        } catch (error) {
            next(error);
        }
    },

    async getStock(
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        try {
            const { itemId } = req.params;

            const result = await stockService.getStock(itemId);

            res.status(200).json({
                success: true,
                data: result,
            });
        } catch (error) {
            next(error);
        }
    },
};
