import { Router } from 'express';
import { requireAuth, requireRole } from '../../shared/middleware/auth.js';
import { register, cancelRegistration, listMyRegistrations } from './student.controller.js';

export const studentRouter = Router();

const studentOnly = [requireAuth, requireRole('STUDENT')];

studentRouter.get('/registrations', studentOnly, listMyRegistrations);
studentRouter.post('/events/:id/registration', studentOnly, register);
studentRouter.delete('/events/:id/registration', studentOnly, cancelRegistration);
