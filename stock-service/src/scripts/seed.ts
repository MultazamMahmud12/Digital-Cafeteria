import mongoose from 'mongoose';
import { config } from '../config/index';
import { FoodItem } from '../models/FoodItem';
import { logger } from '../config/logger';

const foodItems = [
    { name: 'biryani_chicken', stock: 150 },
    { name: 'biryani_veg', stock: 120 },
    { name: 'kebab_chicken', stock: 100 },
    { name: 'samosa', stock: 200 },
    { name: 'chai', stock: 180 },
    { name: 'juice', stock: 150 },
];

const seed = async (): Promise<void> => {
    try {
        // For local development, connect without replica set
        const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/stock-service';
        await mongoose.connect(mongoUri);
        logger.info('Connected to MongoDB for seeding');

        // Clear existing items
        await FoodItem.deleteMany({});
        logger.info('Cleared existing food items');

        // Insert seed data
        const inserted = await FoodItem.insertMany(foodItems);

        logger.info('Seeded food items:');
        inserted.forEach((item) => {
            logger.info(`  ID: ${item._id} | Name: ${item.name} | Stock: ${item.stock}`);
        });

        logger.info(`Successfully seeded ${inserted.length} food items`);
    } catch (error) {
        logger.error('Seeding failed', { error });
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
};

seed();
