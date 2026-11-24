import { Router } from 'express';
import { requireAuth, requireRole } from '../../shared/middleware/auth.js';
import { validate } from '../../shared/middleware/validate.js';
import { reportEventSchema } from './student.schema.js';
import {
  register,
  cancelRegistration,
  listMyRegistrations,
  saveEvent,
  unsaveEvent,
  listMySavedEvents,
  listCategories,
  followCategory,
  unfollowCategory,
  listFollowedCategories,
  reportEvent,
} from './student.controller.js';

export const studentRouter = Router();

const studentOnly = [requireAuth, requireRole('STUDENT')];

studentRouter.get('/registrations', studentOnly, listMyRegistrations);
studentRouter.post('/events/:id/registration', studentOnly, register);
studentRouter.delete('/events/:id/registration', studentOnly, cancelRegistration);

studentRouter.get('/saved', studentOnly, listMySavedEvents);
studentRouter.post('/events/:id/save', studentOnly, saveEvent);
studentRouter.delete('/events/:id/save', studentOnly, unsaveEvent);

studentRouter.get('/categories', studentOnly, listCategories);
studentRouter.get('/followed-categories', studentOnly, listFollowedCategories);
studentRouter.post('/categories/:id/follow', studentOnly, followCategory);
studentRouter.delete('/categories/:id/follow', studentOnly, unfollowCategory);

studentRouter.post('/events/:id/report', studentOnly, validate(reportEventSchema), reportEvent);
