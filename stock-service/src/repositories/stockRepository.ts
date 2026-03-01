import { ClientSession } from 'mongoose';
import { FoodItem } from '../models/FoodItem';

export interface DeductionResult {
    itemId: string;
    success: boolean;
}

export const stockRepository = {
    /**
     * Atomically deduct stock using conditional update.
     * Only succeeds if current stock >= quantity.
     * Returns true if deduction was applied, false if insufficient stock.
     */
    async deductStock(
        itemId: string,
        quantity: number,
        session: ClientSession
    ): Promise<boolean> {
        const result = await FoodItem.updateOne(
            { _id: itemId, stock: { $gte: quantity } },
            { $inc: { stock: -quantity } },
            { session }
        );
        return result.modifiedCount === 1;
    },

    /**
     * Get current stock for an item (read-only, for health/diagnostics).
     */
    async getStock(itemId: string): Promise<number | null> {
        const item = await FoodItem.findById(itemId).select('stock').lean();
        return item ? item.stock : null;
    },

    /**
     * Find item by name (case-insensitive).
     */
    async findByName(name: string): Promise<{ _id: string; name: string; stock: number } | null> {
        const item = await FoodItem.findOne({ name: new RegExp(`^${name}$`, 'i') }).lean();
        if (!item) return null;
        return {
            _id: item._id.toString(),
            name: item.name,
            stock: item.stock,
        };
    },
};
