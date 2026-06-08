import { Router } from 'express';
import {
  getApproval,
  getApprovalTimeline,
  getApprovalAudit,
  approveApproval,
  rejectApproval,
  sendBackApproval,
  updateRemarks,
  getApprovals,
} from './approvals.controller.js';
import { protect } from '../../middlewares/auth.middleware.js';

const router = Router();

router.get('/', getApprovals);

// Protect all approval chain endpoints
router.use(protect);

router.get('/:id', getApproval);
router.get('/:id/timeline', getApprovalTimeline);
router.get('/:id/audit', getApprovalAudit);
router.post('/:id/approve', approveApproval);
router.post('/:id/reject', rejectApproval);
router.post('/:id/send-back', sendBackApproval);
router.post('/:id/remarks', updateRemarks);

export default router;
