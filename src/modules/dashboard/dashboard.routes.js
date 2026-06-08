import { Router } from 'express';
import {
  getStats,
  getRecentPOs,
  getRecentInvoices,
  getActivities,
  getAnalytics,
} from './dashboard.controller.js';
import { protect } from '../../middlewares/auth.middleware.js';

const router = Router();

// Apply authentication middleware to all dashboard endpoints
router.use(protect);

router.get('/stats', getStats);
router.get('/recent-pos', getRecentPOs);
router.get('/recent-invoices', getRecentInvoices);
router.get('/activities', getActivities);
router.get('/analytics', getAnalytics);

export default router;
