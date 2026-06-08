import { Router } from 'express';
import { createRfq, uploadAttachments, getRfq, getRfqComparison, getRfqs } from './rfq.controller.js';
import { protect } from '../../middlewares/auth.middleware.js';

const router = Router();

// Protect all RFQ routes
router.use(protect);

router.post('/', createRfq);
router.post('/upload', uploadAttachments);
router.get('/', getRfqs);
router.get('/:id', getRfq);
router.get('/:id/comparison', getRfqComparison);

export default router;
