import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IProcessedOrder extends Document {
    orderId: string;
    status: 'success' | 'failed';
    createdAt: Date;
}

const processedOrderSchema = new Schema<IProcessedOrder>({
    orderId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    status: {
        type: String,
        required: true,
        enum: ['success', 'failed'],
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

export const ProcessedOrder: Model<IProcessedOrder> = mongoose.model<IProcessedOrder>(
    'ProcessedOrder',
    processedOrderSchema
);
