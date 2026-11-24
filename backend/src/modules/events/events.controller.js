import { AppError } from '../../shared/errors.js';
import * as eventsService from './events.service.js';
import * as recurrenceService from './recurrence.service.js';
import * as imageService from './image.service.js';
import * as capacityService from './capacity.service.js';
import * as rescheduleService from './reschedule.service.js';

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

export async function capacity(req, res) {
  const result = await capacityService.getCapacityAdvice(readEventId(req), req.user);
  res.json(result);
}

export async function reschedulePreview(req, res) {
  const result = await rescheduleService.previewReschedule(readEventId(req), req.user.id, req.body);
  res.json(result);
}

export async function reschedule(req, res) {
  const result = await rescheduleService.rescheduleEvent(readEventId(req), req.user.id, req.body);
  res.json(result);
}

export async function check(req, res) {
  const result = await eventsService.checkAvailability(req.body);
  res.json(result);
}

export async function create(req, res) {
  const event = await eventsService.createEvent(req.user.id, req.body);
  res.status(201).json({ event: event });
}

export async function seriesPreview(req, res) {
  const result = await recurrenceService.previewSeries(req.body);
  res.json(result);
}

export async function seriesCreate(req, res) {
  const result = await recurrenceService.createSeries(req.user.id, req.body);
  res.status(201).json(result);
}

export async function update(req, res) {
  const event = await eventsService.updateEvent(readEventId(req), req.user.id, req.body);
  res.json({ event: event });
}

export async function uploadPoster(req, res) {
  const event = await imageService.uploadEventImage(readEventId(req), req.user.id, req.file);
  res.json({ event: event });
}

export async function removePoster(req, res) {
  const event = await imageService.removeEventImage(readEventId(req), req.user.id);
  res.json({ event: event });
}

export async function remove(req, res) {
  const result = await eventsService.deleteEvent(readEventId(req), req.user.id);
  res.json(result);
}
