import { z } from 'zod';

const noAngleBrackets = /^[^<>]*$/;

export const reportEventSchema = z.object({
  reason: z
    .string('The reason must be text')
    .trim()
    .min(5, 'The reason must have at least 5 characters')
    .max(500, 'The reason can have at most 500 characters')
    .regex(noAngleBrackets, 'The reason cannot contain < or >'),
});

const dateTimeText = z.iso.datetime({ offset: true, message: 'Must be a date and time like 2026-12-01T10:00:00Z' });

export const browseEventsSchema = z.object({
  from: dateTimeText.optional(),
  to: dateTimeText.optional(),
  categoryId: z.coerce.number('categoryId must be a number').int().positive().optional(),
  recommended: z.enum(['true', 'false'], 'recommended must be true or false').optional(),
});

export const createReminderSchema = z.object({
  minutesBefore: z
    .number('minutesBefore must be a number')
    .int('minutesBefore must be a whole number')
    .min(5, 'A reminder must be at least 5 minutes before the event')
    .max(10080, 'A reminder can be at most 7 days (10080 minutes) before the event'),
});
