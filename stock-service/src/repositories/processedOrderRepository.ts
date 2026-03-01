import { ClientSession } from 'mongoose';
import { ProcessedOrder, IProcessedOrder } from '../models/ProcessedOrder';

export interface ProcessedOrderRecord {
    orderId: string;
    status: 'success' | 'failed';
    createdAt: Date;
}

export const processedOrderRepository = {
    /**
     * Create a processed order record within a transaction session.
     * The unique index on orderId prevents double-processing at the DB level.
     */
    async create(
        orderId: string,
        status: 'success' | 'failed',
        session: ClientSession
    ): Promise<IProcessedOrder> {
        const [doc] = await ProcessedOrder.create([{ orderId, status }], { session });
        return doc;
    },

    /**
     * Find a processed order by orderId (fallback idempotency check).
     */
    async findByOrderId(orderId: string): Promise<ProcessedOrderRecord | null> {
        return ProcessedOrder.findOne({ orderId }).lean<ProcessedOrderRecord>().exec();
    },
};
