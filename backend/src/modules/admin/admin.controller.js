import * as adminService from './admin.service.js';

export async function reviewQueue(req, res) {
  const events = await adminService.listReviewQueue();
  res.json({ events: events });
}
