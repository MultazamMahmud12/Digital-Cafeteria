import express from 'express';
import amqp from 'amqplib';
import cors from 'cors';
import { randomUUID } from 'crypto';
import stockRoutes from './routes/stockRoutes';
import healthRoutes from './routes/healthRoutes';
import { errorHandler } from './middleware/errorHandler';
import { latencyTracker } from './middleware/latencyTracker';

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://rabbitmq:5672';
const RABBITMQ_EXCHANGE = process.env.RABBITMQ_EXCHANGE || 'orders.x';
const ENABLE_CHAOS = String(process.env.ENABLE_CHAOS || '').toLowerCase() === 'true';

type CompatOrder = {
	orderId: string;
	userId: string;
	itemId: string;
	quantity: number;
	status: 'STOCK_VERIFIED';
	timestamp: string;
	remainingStock: number;
};

const inventory = new Map<string, number>();
const orders = new Map<string, CompatOrder>();

let rabbitConnection: any = null;
let rabbitChannel: any = null;

function getItemStock(itemId: string): number {
	if (!inventory.has(itemId)) {
		inventory.set(itemId, 20);
	}
	return inventory.get(itemId) ?? 20;
}

function setItemStock(itemId: string, stock: number): void {
	inventory.set(itemId, stock);
}

async function ensureRabbitChannel(): Promise<any> {
	if (rabbitChannel) {
		return rabbitChannel;
	}

	try {
		rabbitConnection = await amqp.connect(RABBITMQ_URL);
		rabbitConnection.on('close', () => {
			rabbitChannel = null;
			rabbitConnection = null;
		});

		rabbitChannel = await rabbitConnection.createChannel();
		await rabbitChannel.assertExchange(RABBITMQ_EXCHANGE, 'topic', { durable: true });
		return rabbitChannel;
	} catch {
		rabbitChannel = null;
		rabbitConnection = null;
		return null;
	}
}

const app = express();

// Middleware
app.use(express.json());
app.use(
	cors({
		origin: true,
		credentials: true,
	})
);
app.use(latencyTracker);

app.post('/order', async (req, res) => {
	const userId = String(req.body?.userId || 'anonymous');
	const itemId = String(req.body?.itemId || req.body?.sku || '').trim();
	const quantity = Number(req.body?.quantity ?? req.body?.qty);

	if (!itemId || !Number.isInteger(quantity) || quantity <= 0) {
		return res.status(400).json({ message: 'itemId and quantity are required' });
	}

	const currentStock = getItemStock(itemId);
	if (currentStock < quantity) {
		return res.status(400).json({ message: 'item is out of stock' });
	}

	const orderId = `ord_${randomUUID()}`;
	const remainingStock = currentStock - quantity;
	setItemStock(itemId, remainingStock);

	const order: CompatOrder = {
		orderId,
		userId,
		itemId,
		quantity,
		status: 'STOCK_VERIFIED',
		timestamp: new Date().toISOString(),
		remainingStock,
	};

	orders.set(orderId, order);

	const channel = await ensureRabbitChannel();
	if (channel) {
		channel.publish(
			RABBITMQ_EXCHANGE,
			'order.created',
			Buffer.from(
				JSON.stringify({
					orderId,
					userId,
					itemId,
					quantity,
					timestamp: order.timestamp,
				})
			),
			{ persistent: true, contentType: 'application/json' }
		);
	}

	return res.status(201).json({
		orderId,
		itemId,
		quantity,
		status: 'STOCK_VERIFIED',
		remainingStock,
	});
});

app.get('/order/:orderId', (req, res) => {
	const order = orders.get(req.params.orderId);
	if (!order) {
		return res.status(404).json({ message: 'Order not found' });
	}

	return res.status(200).json(order);
});

app.post('/chaos/kill', (_req, res) => {
	if (!ENABLE_CHAOS) {
		return res.status(403).json({ error: 'Chaos mode is disabled' });
	}

	res.status(202).json({ status: 'terminating' });
	setTimeout(() => process.exit(1), 50);
});

// Routes
app.use('/stock', stockRoutes);
app.use('/', healthRoutes);

// Centralized error handler (must be last)
app.use(errorHandler);

export default app;
