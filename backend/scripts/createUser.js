import 'dotenv/config';
import { z } from 'zod';
import { db } from '../src/db/client.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { registerSchema } from '../src/modules/auth/auth.schema.js';

const createUserSchema = registerSchema.extend({
  role: z.enum(['ORGANIZER', 'ADMIN'], 'Role must be ORGANIZER or ADMIN'),
});

function readArguments() {
  const values = process.argv.slice(2);
  return {
    name: values[0],
    email: values[1],
    password: values[2],
    role: values[3],
  };
}

function printProblems(issues) {
  console.log('Usage: npm run create-user -- "Full Name" email password ORGANIZER|ADMIN');
  for (const issue of issues) {
    console.log('- ' + issue.path.join('.') + ': ' + issue.message);
  }
}

async function saveUser(input) {
  const passwordHash = await hashPassword(input.password);
  try {
    const user = await db().user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash: passwordHash,
        role: input.role,
      },
    });
    console.log('Created ' + user.role + ' with id ' + user.id + ': ' + user.email);
  } catch (error) {
    if (error.code === 'P2002') {
      console.log('This email is already registered');
      process.exitCode = 1;
      return;
    }
    throw error;
  }
}

async function createUser() {
  const result = createUserSchema.safeParse(readArguments());
  if (!result.success) {
    printProblems(result.error.issues);
    process.exitCode = 1;
    return;
  }
  await saveUser(result.data);
}

await createUser();
await db().$disconnect();
