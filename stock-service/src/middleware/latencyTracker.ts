import { Request, Response, NextFunction } from 'express';
import { metricsStore } from '../metrics/metricsStore';

export const latencyTracker = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    const startTime = process.hrtime.bigint();

    res.on('finish', () => {
        const endTime = process.hrtime.bigint();
        const durationMs = Number(endTime - startTime) / 1_000_000;
        metricsStore.recordResponseTime(durationMs);
    });

    next();
};
