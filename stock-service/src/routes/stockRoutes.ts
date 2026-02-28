import { Router } from 'express';
import { stockController } from '../controllers/stockController';
import { validateDeductRequest } from '../middleware/validateRequest';

const router = Router();

router.post('/deduct', validateDeductRequest, stockController.deductStock);
router.get('/:itemId', stockController.getStock);

export default router;
