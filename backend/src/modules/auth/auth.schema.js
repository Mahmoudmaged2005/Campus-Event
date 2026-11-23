import { z } from 'zod';

const noAngleBrackets = /^[^<>]*$/;

const emailField = z.string().trim().toLowerCase().email('Email is not valid').max(200);

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must have at least 2 characters')
    .max(100, 'Name can have at most 100 characters')
    .regex(noAngleBrackets, 'Name cannot contain < or >'),
  email: emailField,
  password: z
    .string()
    .min(8, 'Password must have at least 8 characters')
    .max(128, 'Password can have at most 128 characters'),
});

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Password is required').max(128),
});
