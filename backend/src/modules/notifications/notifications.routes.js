import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/auth.js';
import { listMine, markRead } from './notifications.controller.js';

export const notificationsRouter = Router();

notificationsRouter.get('/', requireAuth, listMine);
notificationsRouter.patch('/:id/read', requireAuth, markRead);
