import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../prisma/generated/client.ts';

let prismaClient = null;

export function db() {
  if (prismaClient === null) {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
    prismaClient = new PrismaClient({ adapter });
  }
  return prismaClient;
}
