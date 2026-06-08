import { Router } from 'express';
import { getUsers, createUser, toggleUserStatus, deleteUser } from './users.controller.js';
import { protect, restrictTo } from '../../middlewares/auth.middleware.js';

const router = Router();

// Protect all routes to Admin users only
router.use(protect);
router.use(restrictTo('ADMIN'));

router.route('/')
  .get(getUsers)
  .post(createUser);

router.patch('/:id/toggle-status', toggleUserStatus);
router.delete('/:id', deleteUser);

export default router;
