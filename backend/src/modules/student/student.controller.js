import { AppError } from '../../shared/errors.js';
import * as registrationService from './registration.service.js';
import * as savedService from './saved.service.js';

function readEventId(req) {
  const eventId = Number(req.params.id);
  if (!Number.isInteger(eventId) || eventId <= 0) {
    throw new AppError(400, 'The event id must be a positive whole number');
  }
  return eventId;
}

export async function register(req, res) {
  const registration = await registrationService.registerForEvent(readEventId(req), req.user.id);
  res.status(201).json({ registration: registration });
}

export async function cancelRegistration(req, res) {
  const result = await registrationService.cancelRegistration(readEventId(req), req.user.id);
  res.json(result);
}

export async function listMyRegistrations(req, res) {
  const registrations = await registrationService.listMyRegistrations(req.user.id);
  res.json({ registrations: registrations });
}

export async function saveEvent(req, res) {
  const savedEvent = await savedService.saveEvent(readEventId(req), req.user.id);
  res.status(201).json({ savedEvent: savedEvent });
}

export async function unsaveEvent(req, res) {
  const result = await savedService.unsaveEvent(readEventId(req), req.user.id);
  res.json(result);
}

export async function listMySavedEvents(req, res) {
  const savedEvents = await savedService.listMySavedEvents(req.user.id);
  res.json({ savedEvents: savedEvents });
}
