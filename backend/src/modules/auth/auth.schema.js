import { z } from 'zod';

const noAngleBrackets = /^[^<>]*$/;

const emailField = z.string().trim().toLowerCase().email('Email is not valid').max(200);

const nameField = z
  .string()
  .trim()
  .min(2, 'Name must have at least 2 characters')
  .max(100, 'Name can have at most 100 characters')
  .regex(noAngleBrackets, 'Name cannot contain < or >');

const passwordField = z
  .string()
  .min(8, 'Password must have at least 8 characters')
  .max(128, 'Password can have at most 128 characters');

function changesSomething(changes) {
  return changes.name !== undefined || changes.email !== undefined || changes.newPassword !== undefined;
}

export const registerSchema = z.object({
  name: nameField,
  email: emailField,
  password: passwordField,
  role: z.enum(['STUDENT', 'ORGANIZER'], 'Role must be STUDENT or ORGANIZER').default('STUDENT'),
});

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Password is required').max(128),
  role: z.enum(['STUDENT', 'ORGANIZER', 'ADMIN'], 'Role must be STUDENT, ORGANIZER or ADMIN').optional(),
});

export const verifyEmailSchema = z.object({
  email: emailField,
  code: z.string().trim().regex(/^[0-9]{6}$/, 'The code has 6 digits'),
});

export const resendCodeSchema = z.object({
  email: emailField,
});

export const forgotPasswordSchema = z.object({
  email: emailField,
});

export const resetPasswordSchema = z.object({
  email: emailField,
  code: z.string().trim().regex(/^[0-9]{6}$/, 'The code has 6 digits'),
  newPassword: passwordField,
});

export const updateProfileSchema = z
  .object({
    name: nameField.optional(),
    email: emailField.optional(),
    currentPassword: z.string().max(128).optional(),
    newPassword: passwordField.optional(),
  })
  .refine(changesSomething, 'Change at least your name, email or password');
