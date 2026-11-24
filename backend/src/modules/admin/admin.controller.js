import { AppError } from '../../shared/errors.js';
import * as adminService from './admin.service.js';
import * as categoriesService from './categories.service.js';
import * as flagsService from './flags.service.js';

function readIdFromUrl(req) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(400, 'The id must be a positive whole number');
  }
  return id;
}

export async function reviewQueue(req, res) {
  const events = await adminService.listReviewQueue();
  res.json({ events: events });
}

export async function approve(req, res) {
  const event = await adminService.approveEvent(readIdFromUrl(req), req.user.id);
  res.json({ event: event });
}

export async function reject(req, res) {
  const event = await adminService.rejectEvent(readIdFromUrl(req), req.user.id, req.body.reason);
  res.json({ event: event });
}

export async function listCategories(req, res) {
  const categories = await categoriesService.listAllCategories();
  res.json({ categories: categories });
}

export async function createCategory(req, res) {
  const category = await categoriesService.createCategory(req.user.id, req.body.name);
  res.status(201).json({ category: category });
}

export async function updateCategory(req, res) {
  const category = await categoriesService.updateCategory(req.user.id, readIdFromUrl(req), req.body);
  res.json({ category: category });
}

export async function listFlags(req, res) {
  const flags = await flagsService.listOpenFlags();
  res.json({ flags: flags });
}

export async function resolveFlag(req, res) {
  const flag = await flagsService.resolveFlag(req.user.id, readIdFromUrl(req));
  res.json({ flag: flag });
}

export async function dismissFlag(req, res) {
  const flag = await flagsService.dismissFlag(req.user.id, readIdFromUrl(req));
  res.json({ flag: flag });
}
