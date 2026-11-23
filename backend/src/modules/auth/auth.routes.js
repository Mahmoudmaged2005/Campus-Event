import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/auth.js';
import { validate } from '../../shared/middleware/validate.js';
import { loginRateLimit } from '../../shared/middleware/rateLimit.js';
import { registerSchema, loginSchema } from './auth.schema.js';
import { register, login, me, logout } from './auth.controller.js';

export const authRouter = Router();

authRouter.post('/register', validate(registerSchema), register);
authRouter.post('/login', loginRateLimit, validate(loginSchema), login);
authRouter.get('/me', requireAuth, me);
authRouter.post('/logout', requireAuth, logout);
