import { Router } from 'express';
import { requireAuth, requireRole } from '../../shared/middleware/auth.js';
import { validate } from '../../shared/middleware/validate.js';
import { createEventSchema, updateEventSchema, checkPlaceSchema } from './events.schema.js';
import { listCategories, listMine, getOne, check, create, update, remove } from './events.controller.js';

export const eventsRouter = Router();

const organizerOnly = [requireAuth, requireRole('ORGANIZER')];
const organizerOrAdmin = [requireAuth, requireRole('ORGANIZER', 'ADMIN')];

eventsRouter.get('/categories', organizerOrAdmin, listCategories);
eventsRouter.get('/mine', organizerOnly, listMine);
eventsRouter.post('/check', organizerOnly, validate(checkPlaceSchema), check);
eventsRouter.post('/', organizerOnly, validate(createEventSchema), create);
eventsRouter.get('/:id', organizerOrAdmin, getOne);
eventsRouter.patch('/:id', organizerOnly, validate(updateEventSchema), update);
eventsRouter.delete('/:id', organizerOnly, remove);
