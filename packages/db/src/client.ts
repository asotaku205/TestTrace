// PrismaClient dùng chung, URL dựng từ biến rời (nguồn: AUTH-01).
import { PrismaClient } from '@prisma/client';
import { buildDatabaseUrl } from './database-url.js';

function resolveUrl(): string | undefined {
  const fromEnv = process.env.DATABASE_URL;
  if (fromEnv) return fromEnv;
  if (process.env.DATABASE_USERNAME ?? process.env.DATABASE_HOST ?? process.env.DATABASE_NAME) {
    return buildDatabaseUrl(process.env);
  }
  return undefined;
}

export const prisma = new PrismaClient(resolveUrl() ? { datasourceUrl: resolveUrl() } : undefined);
