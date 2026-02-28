import express from 'express';
import stockRoutes from './routes/stockRoutes';
import healthRoutes from './routes/healthRoutes';
import { errorHandler } from './middleware/errorHandler';
import { latencyTracker } from './middleware/latencyTracker';

const app = express();

// Middleware
app.use(express.json());
app.use(latencyTracker);

// Routes
app.use('/stock', stockRoutes);
app.use('/', healthRoutes);

// Centralized error handler (must be last)
app.use(errorHandler);

export default app;
