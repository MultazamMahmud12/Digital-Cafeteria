import express from 'express';
import cors from 'cors';
import stockRoutes from './routes/stockRoutes';
import healthRoutes from './routes/healthRoutes';
import { stockController } from './controllers/stockController';
import { errorHandler } from './middleware/errorHandler';
import { latencyTracker } from './middleware/latencyTracker';

const app = express();

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(latencyTracker);

// Routes
app.post('/order', stockController.placeOrder); // Gateway compatibility endpoint
app.use('/stock', stockRoutes);
app.use('/', healthRoutes);

// Centralized error handler (must be last)
app.use(errorHandler);

export default app;
