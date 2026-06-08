import { Router } from 'express';
import {
  getTimeline,
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getAuditLogs,
} from './activity.controller.js';
import { protect } from '../../middlewares/auth.middleware.js';

const router = Router();

// Protect all activity endpoints
router.use(protect);

router.get('/timeline', getTimeline);
router.get('/notifications', getNotifications);
router.patch('/notifications/read-all', markAllAsRead);
router.patch('/notifications/:id/read', markAsRead);
router.delete('/notifications/:id', deleteNotification);
router.get('/audit-logs', getAuditLogs);

export default router;
