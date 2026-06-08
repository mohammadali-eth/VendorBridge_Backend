import { Router } from 'express';
import {
  getSummary,
  getSpendAnalysis,
  getVendorPerformance,
  getProcurementTrends,
  getPoAnalytics,
  getInvoiceAnalytics,
  generateReport,
  getReports,
  getReport,
  downloadReport,
  deleteReport,
} from './reports.controller.js';
import { protect } from '../../middlewares/auth.middleware.js';

const router = Router();

// Protect all reports endpoints
router.use(protect);

router.get('/summary', getSummary);
router.get('/spend-analysis', getSpendAnalysis);
router.get('/vendor-performance', getVendorPerformance);
router.get('/procurement-trends', getProcurementTrends);
router.get('/po-analytics', getPoAnalytics);
router.get('/invoice-analytics', getInvoiceAnalytics);
router.post('/generate', generateReport);
router.get('/', getReports);
router.get('/:id', getReport);
router.get('/download/:id', downloadReport);
router.delete('/:id', deleteReport);

export default router;
