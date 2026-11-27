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

const categoryName = z
  .string()
  .trim()
  .min(2, 'The name must have at least 2 characters')
  .max(50, 'The name can have at most 50 characters')
  .regex(noAngleBrackets, 'The name cannot contain < or >');

function hasAtLeastOneField(changes) {
  return Object.keys(changes).length > 0;
}

export const createCategorySchema = z.object({
  name: categoryName,
});

export const updateCategorySchema = z
  .object({
    name: categoryName.optional(),
    isActive: z.boolean('isActive must be true or false').optional(),
  })
  .refine(hasAtLeastOneField, 'Send name or isActive to change');

export const auditLogQuerySchema = z.object({
  action: z.string().regex(/^[a-z.]{3,60}$/, 'action must look like event.approved').optional(),
  beforeId: z.coerce.number('beforeId must be a number').int().positive().optional(),
  limit: z.coerce.number('limit must be a number').int().min(1).max(100).default(50),
});
