import { Router } from 'express';
import { requireAuth, requireRole } from '../../shared/middleware/auth.js';
import { validate } from '../../shared/middleware/validate.js';
import { rejectEventSchema, createCategorySchema, updateCategorySchema } from './admin.schema.js';
import {
  reviewQueue,
  approve,
  reject,
  listCategories,
  createCategory,
  updateCategory,
  listFlags,
  resolveFlag,
  dismissFlag,
  runLifecycle,
} from './admin.controller.js';

export const adminRouter = Router();

const adminOnly = [requireAuth, requireRole('ADMIN')];

adminRouter.get('/review-queue', adminOnly, reviewQueue);
adminRouter.post('/events/:id/approve', adminOnly, approve);
adminRouter.post('/events/:id/reject', adminOnly, validate(rejectEventSchema), reject);

adminRouter.get('/categories', adminOnly, listCategories);
adminRouter.post('/categories', adminOnly, validate(createCategorySchema), createCategory);
adminRouter.patch('/categories/:id', adminOnly, validate(updateCategorySchema), updateCategory);

adminRouter.get('/flags', adminOnly, listFlags);
adminRouter.post('/flags/:id/resolve', adminOnly, resolveFlag);
adminRouter.post('/flags/:id/dismiss', adminOnly, dismissFlag);

adminRouter.post('/lifecycle/run', adminOnly, runLifecycle);
