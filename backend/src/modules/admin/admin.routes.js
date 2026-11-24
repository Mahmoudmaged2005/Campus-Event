import { Router } from 'express';
import { requireAuth, requireRole } from '../../shared/middleware/auth.js';
import { reviewQueue } from './admin.controller.js';

export const adminRouter = Router();

const adminOnly = [requireAuth, requireRole('ADMIN')];

adminRouter.get('/review-queue', adminOnly, reviewQueue);
