const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://monazirmohammedminhaz_db_user:tCc9dE3WwrJVGl2k@cluster0.mlj5ojt.mongodb.net/?appName=Cluster0';

const foodItems = [
    { name: 'biryani_chicken', stock: 150 },
    { name: 'biryani_veg', stock: 120 },
    { name: 'kebab_chicken', stock: 100 },
    { name: 'samosa', stock: 200 },
    { name: 'chai', stock: 180 },
    { name: 'juice', stock: 150 }
];

async function seedAtlas() {
    try {
        console.log('Connecting to MongoDB Atlas...');
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB Atlas');

        const FoodItem = mongoose.model('FoodItem', new mongoose.Schema({
            name: { type: String, required: true },
            stock: { type: Number, required: true, min: 0 }
        }, { timestamps: true }));

        // Clear existing items
        await FoodItem.deleteMany({});
        console.log('✅ Cleared existing food items');

        // Insert seed data
        const inserted = await FoodItem.insertMany(foodItems);
        console.log('✅ Seeded food items:');
        inserted.forEach((item) => {
            console.log(`  ID: ${item._id} | Name: ${item.name} | Stock: ${item.stock}`);
        });

        console.log(`\n✅ Successfully seeded ${inserted.length} food items to MongoDB Atlas`);
    } catch (error) {
        console.error('❌ Seeding failed:', error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

seedAtlas();
