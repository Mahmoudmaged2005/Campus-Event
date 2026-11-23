import { z } from 'zod';

const noAngleBrackets = /^[^<>]*$/;

function toDate(text) {
  return new Date(text);
}

function safeText(fieldLabel, minLength, maxLength) {
  return z
    .string()
    .trim()
    .min(minLength, fieldLabel + ' must have at least ' + minLength + ' characters')
    .max(maxLength, fieldLabel + ' can have at most ' + maxLength + ' characters')
    .regex(noAngleBrackets, fieldLabel + ' cannot contain < or >');
}

const dateTimeField = z.iso
  .datetime({ offset: true, message: 'Must be a date and time like 2026-12-01T10:00:00Z' })
  .transform(toDate);

const eventFields = z.object({
  title: safeText('Title', 3, 120),
  description: safeText('Description', 1, 2000),
  location: safeText('Location', 2, 120),
  startsAt: dateTimeField,
  endsAt: dateTimeField,
  capacity: z.number().int().min(1).max(5000).nullable().optional(),
  categoryId: z.number().int().positive(),
});

function hasAtLeastOneField(changes) {
  return Object.keys(changes).length > 0;
}

export const createEventSchema = eventFields;

export const checkPlaceSchema = eventFields
  .pick({ location: true, startsAt: true, endsAt: true })
  .extend({ ignoreEventId: z.number().int().positive().optional() });

const repeatFields = {
  frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY'], 'Frequency must be DAILY, WEEKLY or MONTHLY'),
  interval: z.number().int().min(1).max(12).default(1),
  count: z.number().int().min(2, 'A series has at least 2 events').max(20, 'A series has at most 20 events'),
};

export const seriesPreviewSchema = eventFields
  .pick({ location: true, startsAt: true, endsAt: true })
  .extend(repeatFields);

export const seriesCreateSchema = eventFields.extend(repeatFields).extend({
  onClash: z.enum(['reject', 'skip'], 'onClash must be reject or skip').default('reject'),
});

export const updateEventSchema = eventFields
  .partial()
  .refine(hasAtLeastOneField, 'Send at least one field to change');
