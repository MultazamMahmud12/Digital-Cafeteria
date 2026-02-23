 const mongoose = require('mongoose');

 function connect(){
    console.log('Attempting to connect to MongoDB...');

    const uri = process.env.MONGO_URL || process.env.MONGO_URI;
    if (!uri) {
        console.error('MONGO_URL or MONGO_URI is not set. Please set one in your .env file.');
        return;
    }

    console.log('Using MongoDB URI from environment');

    mongoose.connect(uri,{
       serverSelectionTimeoutMS: 5000,
    }).then(()=>{
        console.log('✅ Connected to MongoDB successfully');
    }).catch((err)=>{
        console.error('❌ Error connecting to MongoDB');
        console.error('Error name:', err.name);
        console.error('Error message:', err.message);
        console.error('Error code:', err.code);
    })
}

module.exports = connect