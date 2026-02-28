import { Request, Response, NextFunction } from 'express';
import { stockService, DeductionRequest } from '../services/stockService';
import { metricsStore } from '../metrics/metricsStore';

export const stockController = {
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
