import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IFoodItem extends Document {
    name: string;
    stock: number;
    createdAt: Date;
    updatedAt: Date;
}

const foodItemSchema = new Schema<IFoodItem>(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        stock: {
            type: Number,
            required: true,
            min: 0,
        },
    },
    {
        timestamps: true,
    }
);

foodItemSchema.index({ stock: 1 });

export const FoodItem: Model<IFoodItem> = mongoose.model<IFoodItem>('FoodItem', foodItemSchema);
