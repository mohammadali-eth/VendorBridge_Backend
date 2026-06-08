import { Router } from 'express';
import {
  login,
  register,
  refreshToken,
  logout,
  forgotPassword,
  resetPassword,
  getMe,
} from './auth.controller.js';
import { protect } from '../../middlewares/auth.middleware.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/refresh-token', refreshToken);
router.post('/logout', logout);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);

router.get('/me', protect, getMe);

export default router;