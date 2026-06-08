import { Router } from 'express';
import { getQuotation, createQuotation, updateQuotation } from './quotations.controller.js';
import { protect } from '../../middlewares/auth.middleware.js';

const router = Router();

// Protect all quotation routes
router.use(protect);

router.post('/', createQuotation);
router.get('/:id', getQuotation);
router.put('/:id', updateQuotation);

export default router;
