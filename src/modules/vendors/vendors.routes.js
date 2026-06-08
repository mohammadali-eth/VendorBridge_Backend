import { Router } from 'express';
import {
  getVendors,
  getCategories,
  getStatuses,
  getVendorById,
  createVendor,
  updateVendor,
  deleteVendor,
  bulkUpdateVendors,
  bulkDeleteVendors,
  importVendors
} from './vendors.controller.js';
import { protect } from '../../middlewares/auth.middleware.js';

const router = Router();

// Apply auth check globally on vendor routes
router.use(protect);

// Standard vendor endpoints
router.get('/', getVendors);
router.get('/categories', getCategories);
router.get('/statuses', getStatuses);
router.get('/:id', getVendorById);

// Creation, Updates, Deletions
router.post('/', createVendor);
router.put('/:id', updateVendor);
router.delete('/:id', deleteVendor);

// Bulk operations
router.post('/bulk-update', bulkUpdateVendors);
router.post('/bulk-delete', bulkDeleteVendors);
router.post('/import', importVendors);

export default router;
