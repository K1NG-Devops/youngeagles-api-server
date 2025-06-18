import { Router } from 'express';
import { requestPasswordReset, resetPassword } from '../controllers/passwordResetController.js';

const router = Router();

// Request password reset
router.post('/request', requestPasswordReset);

// Reset password with token
router.post('/reset', resetPassword);

export default router; 