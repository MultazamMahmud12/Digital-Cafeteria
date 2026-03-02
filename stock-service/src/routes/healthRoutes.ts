import { Router } from 'express';
import { healthController } from '../controllers/healthController';

const router = Router();

router.get('/health', healthController.checkHealth);
router.get('/metrics', healthController.getMetrics);

export default router;
