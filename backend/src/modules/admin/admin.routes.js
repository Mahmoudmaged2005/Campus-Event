import { Router } from 'express';
import { requireAuth, requireRole } from '../../shared/middleware/auth.js';
import { validate } from '../../shared/middleware/validate.js';
import { rejectEventSchema } from './admin.schema.js';
import { reviewQueue, approve, reject } from './admin.controller.js';

export const adminRouter = Router();

const adminOnly = [requireAuth, requireRole('ADMIN')];

adminRouter.get('/review-queue', adminOnly, reviewQueue);
adminRouter.post('/events/:id/approve', adminOnly, approve);
adminRouter.post('/events/:id/reject', adminOnly, validate(rejectEventSchema), reject);
