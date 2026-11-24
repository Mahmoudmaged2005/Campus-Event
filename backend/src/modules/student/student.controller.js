import { AppError } from '../../shared/errors.js';
import * as registrationService from './registration.service.js';
import * as savedService from './saved.service.js';
import * as followService from './follow.service.js';

function readEventId(req) {
  const eventId = Number(req.params.id);
  if (!Number.isInteger(eventId) || eventId <= 0) {
    throw new AppError(400, 'The event id must be a positive whole number');
  }
  return eventId;
}

function readCategoryId(req) {
  const categoryId = Number(req.params.id);
  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    throw new AppError(400, 'The category id must be a positive whole number');
  }
  return categoryId;
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

export async function listCategories(req, res) {
  const categories = await followService.listCategoriesForStudent(req.user.id);
  res.json({ categories: categories });
}

export async function followCategory(req, res) {
  const follow = await followService.followCategory(readCategoryId(req), req.user.id);
  res.status(201).json({ follow: follow });
}

export async function unfollowCategory(req, res) {
  const result = await followService.unfollowCategory(readCategoryId(req), req.user.id);
  res.json(result);
}

export async function listFollowedCategories(req, res) {
  const categories = await followService.listFollowedCategories(req.user.id);
  res.json({ categories: categories });
}
