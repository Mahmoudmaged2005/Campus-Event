import crypto from 'node:crypto';
import { db } from '../../db/client.js';
import { AppError } from '../../shared/errors.js';
import { findOwnedEvent, checkCanEdit } from './events.service.js';
import { saveImage, deleteImageByUrl } from './imageStorage.js';

const JPEG_START = Buffer.from([0xff, 0xd8, 0xff]);
const PNG_START = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const RIFF_TEXT = Buffer.from('RIFF');
const WEBP_TEXT = Buffer.from('WEBP');

function bytesMatch(bytes, expected, position) {
  return bytes.subarray(position, position + expected.length).equals(expected);
}

export function detectImageType(bytes) {
  if (bytesMatch(bytes, JPEG_START, 0)) {
    return { extension: 'jpg', contentType: 'image/jpeg' };
  }
  if (bytesMatch(bytes, PNG_START, 0)) {
    return { extension: 'png', contentType: 'image/png' };
  }
  if (bytesMatch(bytes, RIFF_TEXT, 0) && bytesMatch(bytes, WEBP_TEXT, 8)) {
    return { extension: 'webp', contentType: 'image/webp' };
  }
  return null;
}

async function saveNewImageUrl(eventId, imageUrl) {
  try {
    return await db().event.update({ where: { id: eventId }, data: { imageUrl: imageUrl } });
  } catch (error) {
    await deleteImageByUrl(imageUrl);
    throw error;
  }
}

export async function uploadEventImage(eventId, organizerId, file) {
  if (!file) {
    throw new AppError(400, 'Send one file in the field "image"');
  }
  const event = await findOwnedEvent(eventId, organizerId);
  checkCanEdit(event);

  const imageType = detectImageType(file.buffer);
  if (imageType === null) {
    throw new AppError(400, 'Only JPEG, PNG or WebP images are allowed');
  }

  const key = 'events/' + crypto.randomUUID() + '.' + imageType.extension;
  const imageUrl = await saveImage(key, file.buffer, imageType.contentType);
  const updatedEvent = await saveNewImageUrl(eventId, imageUrl);

  if (event.imageUrl) {
    await deleteImageByUrl(event.imageUrl);
  }
  return updatedEvent;
}

export async function removeEventImage(eventId, organizerId) {
  const event = await findOwnedEvent(eventId, organizerId);
  checkCanEdit(event);
  if (!event.imageUrl) {
    throw new AppError(404, 'This event has no poster');
  }
  const updatedEvent = await db().event.update({ where: { id: eventId }, data: { imageUrl: null } });
  await deleteImageByUrl(event.imageUrl);
  return updatedEvent;
}
