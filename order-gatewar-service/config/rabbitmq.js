const amqp = require('amqplib');

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://rabbitmq:5672';
const RABBITMQ_EXCHANGE = process.env.RABBITMQ_EXCHANGE || 'orders.x';

let connection = null;
let channel = null;

async function connect() {
    try {
        connection = await amqp.connect(RABBITMQ_URL);
        channel = await connection.createChannel();
        await channel.assertExchange(RABBITMQ_EXCHANGE, 'topic', { durable: true });
        console.log('✅ Connected to RabbitMQ');
        
        connection.on('error', (err) => {
            console.error('RabbitMQ connection error:', err);
        });
        
        connection.on('close', () => {
            console.log('RabbitMQ connection closed');
        });
    } catch (error) {
        console.error('Failed to connect to RabbitMQ:', error.message);
        // Retry after 5 seconds
        setTimeout(connect, 5000);
    }
}

async function publishOrder(orderId, orderData) {
    if (!channel) {
        console.error('RabbitMQ channel not available');
        return false;
    }
    
    try {
        const message = JSON.stringify({
            orderId,
            ...orderData,
            timestamp: new Date().toISOString()
        });
        
        channel.publish(
            RABBITMQ_EXCHANGE,
            'order.created',
            Buffer.from(message),
            { persistent: true }
        );
        
        console.log(`[RabbitMQ] Published order ${orderId} to kitchen`);
        return true;
    } catch (error) {
        console.error('Failed to publish order:', error.message);
        return false;
    }
}

async function close() {
    try {
        if (channel) await channel.close();
        if (connection) await connection.close();
    } catch (error) {
        console.error('Error closing RabbitMQ connection:', error);
    }
}

module.exports = {
    connect,
    publishOrder,
    close
};
