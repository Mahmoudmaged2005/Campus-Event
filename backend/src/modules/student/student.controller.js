import { AppError } from '../../shared/errors.js';
import * as studentService from './student.service.js';

function readEventId(req) {
  const eventId = Number(req.params.id);
  if (!Number.isInteger(eventId) || eventId <= 0) {
    throw new AppError(400, 'The event id must be a positive whole number');
  }
  return eventId;
}

export async function register(req, res) {
  const registration = await studentService.registerForEvent(readEventId(req), req.user.id);
  res.status(201).json({ registration: registration });
}

export async function cancelRegistration(req, res) {
  const result = await studentService.cancelRegistration(readEventId(req), req.user.id);
  res.json(result);
}

export async function listMyRegistrations(req, res) {
  const registrations = await studentService.listMyRegistrations(req.user.id);
  res.json({ registrations: registrations });
}
