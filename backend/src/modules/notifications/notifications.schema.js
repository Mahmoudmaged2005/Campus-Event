import { z } from 'zod';

export const notificationMessageSchema = z
  .string('The notification message must be text')
  .trim()
  .min(1, 'The notification message cannot be empty')
  .max(500, 'The notification message can have at most 500 characters');
