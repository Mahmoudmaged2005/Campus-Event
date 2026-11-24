import { Router } from 'express';
import { requireAuth, requireRole } from '../../shared/middleware/auth.js';
import { validate } from '../../shared/middleware/validate.js';
import { reportEventSchema, createReminderSchema } from './student.schema.js';
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
  createReminder,
  listMyReminders,
  deleteReminder,
  sendDueReminders,
  listRecommendations,
  getMyDigest,
  sendWeeklyDigests,
  getEventWeather,
} from './student.controller.js';

export const studentRouter = Router();

const studentOnly = [requireAuth, requireRole('STUDENT')];
const adminOnly = [requireAuth, requireRole('ADMIN')];

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

studentRouter.get('/reminders', studentOnly, listMyReminders);
studentRouter.post('/events/:id/reminders', studentOnly, validate(createReminderSchema), createReminder);
studentRouter.delete('/reminders/:id', studentOnly, deleteReminder);
studentRouter.post('/reminders/send-due', adminOnly, sendDueReminders);

studentRouter.get('/recommendations', studentOnly, listRecommendations);
studentRouter.get('/digest', studentOnly, getMyDigest);
studentRouter.post('/digest/send', adminOnly, sendWeeklyDigests);

studentRouter.get('/events/:id/weather', studentOnly, getEventWeather);
