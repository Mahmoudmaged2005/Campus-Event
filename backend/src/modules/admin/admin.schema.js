import { z } from 'zod';

const noAngleBrackets = /^[^<>]*$/;

export const rejectEventSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(5, 'The reason must have at least 5 characters')
    .max(500, 'The reason can have at most 500 characters')
    .regex(noAngleBrackets, 'The reason cannot contain < or >'),
});
