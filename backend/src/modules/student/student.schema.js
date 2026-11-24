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
