import { AppError } from '../../shared/errors.js';
import * as adminService from './admin.service.js';

function readEventId(req) {
  const eventId = Number(req.params.id);
  if (!Number.isInteger(eventId) || eventId <= 0) {
    throw new AppError(400, 'The event id must be a positive whole number');
  }
  return eventId;
}

export async function reviewQueue(req, res) {
  const events = await adminService.listReviewQueue();
  res.json({ events: events });
}

export async function approve(req, res) {
  const event = await adminService.approveEvent(readEventId(req));
  res.json({ event: event });
}

export async function reject(req, res) {
  const event = await adminService.rejectEvent(readEventId(req), req.body.reason);
  res.json({ event: event });
}
