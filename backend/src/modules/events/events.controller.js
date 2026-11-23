import { AppError } from '../../shared/errors.js';
import * as eventsService from './events.service.js';

function readEventId(req) {
  const eventId = Number(req.params.id);
  if (!Number.isInteger(eventId) || eventId <= 0) {
    throw new AppError(400, 'The event id must be a positive whole number');
  }
  return eventId;
}

export async function listCategories(req, res) {
  const categories = await eventsService.listActiveCategories();
  res.json({ categories: categories });
}

export async function listMine(req, res) {
  const events = await eventsService.listMyEvents(req.user.id);
  res.json({ events: events });
}

export async function getOne(req, res) {
  const event = await eventsService.getEventForUser(readEventId(req), req.user);
  res.json({ event: event });
}

export async function check(req, res) {
  const result = await eventsService.checkAvailability(req.body);
  res.json(result);
}

export async function create(req, res) {
  const event = await eventsService.createEvent(req.user.id, req.body);
  res.status(201).json({ event: event });
}

export async function update(req, res) {
  const event = await eventsService.updateEvent(readEventId(req), req.user.id, req.body);
  res.json({ event: event });
}

export async function remove(req, res) {
  const result = await eventsService.deleteEvent(readEventId(req), req.user.id);
  res.json(result);
}
