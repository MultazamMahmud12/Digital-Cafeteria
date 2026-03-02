// MongoDB seed script - run with: docker compose exec mongodb mongosh cafeteria /seed-mongo.js

// Clear existing items
db.fooditems.deleteMany({});

// Insert food items with names matching frontend itemIds
db.fooditems.insertMany([
    { name: 'biryani_chicken', stock: 150, createdAt: new Date(), updatedAt: new Date() },
    { name: 'biryani_veg', stock: 120, createdAt: new Date(), updatedAt: new Date() },
    { name: 'kebab_chicken', stock: 100, createdAt: new Date(), updatedAt: new Date() },
    { name: 'samosa', stock: 200, createdAt: new Date(), updatedAt: new Date() },
    { name: 'chai', stock: 180, createdAt: new Date(), updatedAt: new Date() },
    { name: 'juice', stock: 150, createdAt: new Date(), updatedAt: new Date() }
]);

print('✅ Seeded ' + db.fooditems.countDocuments() + ' food items');
db.fooditems.find().forEach(printjson);
