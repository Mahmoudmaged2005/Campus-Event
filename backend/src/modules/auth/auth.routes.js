import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/auth.js';
import { validate } from '../../shared/middleware/validate.js';
import { loginRateLimit } from '../../shared/middleware/rateLimit.js';
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  resendCodeSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from './auth.schema.js';
import {
  register,
  verifyEmail,
  resendCode,
  forgotPassword,
  resetPassword,
  login,
  me,
  updateMe,
  logout,
} from './auth.controller.js';

export const authRouter = Router();

authRouter.post('/register', validate(registerSchema), register);
authRouter.post('/verify-email', loginRateLimit, validate(verifyEmailSchema), verifyEmail);
authRouter.post('/resend-code', loginRateLimit, validate(resendCodeSchema), resendCode);
authRouter.post('/forgot-password', loginRateLimit, validate(forgotPasswordSchema), forgotPassword);
authRouter.post('/reset-password', loginRateLimit, validate(resetPasswordSchema), resetPassword);
authRouter.post('/login', loginRateLimit, validate(loginSchema), login);
authRouter.get('/me', requireAuth, me);
authRouter.patch('/me', requireAuth, validate(updateProfileSchema), updateMe);
authRouter.post('/logout', requireAuth, logout);
