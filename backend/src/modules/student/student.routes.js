import { Router } from 'express';
import { requireAuth, requireRole } from '../../shared/middleware/auth.js';
import {
  register,
  cancelRegistration,
  listMyRegistrations,
  saveEvent,
  unsaveEvent,
  listMySavedEvents,
} from './student.controller.js';

export const studentRouter = Router();

const studentOnly = [requireAuth, requireRole('STUDENT')];

studentRouter.get('/registrations', studentOnly, listMyRegistrations);
studentRouter.post('/events/:id/registration', studentOnly, register);
studentRouter.delete('/events/:id/registration', studentOnly, cancelRegistration);

studentRouter.get('/saved', studentOnly, listMySavedEvents);
studentRouter.post('/events/:id/save', studentOnly, saveEvent);
studentRouter.delete('/events/:id/save', studentOnly, unsaveEvent);
