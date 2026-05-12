import bcrypt from 'bcryptjs';
import { getDb } from '../db/index.js';
import type { User, UserRole } from '@lyricling/shared';

interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  display_name: string | null;
  role: UserRole;
  created_at: string;
}

const toUser = (r: UserRow): User => ({
  id: r.id,
  email: r.email,
  displayName: r.display_name,
  role: (r.role as UserRole) ?? 'student',
  createdAt: r.created_at,
});

export function findUserByEmail(email: string): UserRow | null {
  const row = getDb()
    .prepare(`SELECT * FROM users WHERE email = ?`)
    .get(email.trim().toLowerCase()) as UserRow | undefined;
  return row ?? null;
}

export function findUserById(id: number): User | null {
  const row = getDb().prepare(`SELECT * FROM users WHERE id = ?`).get(id) as
    | UserRow
    | undefined;
  return row ? toUser(row) : null;
}

export interface CreateUserInput {
  email: string;
  password: string;
  displayName?: string | null;
  role?: UserRole;
}

export async function createUser(input: CreateUserInput): Promise<User> {
  const email = input.email.trim().toLowerCase();
  if (!email.includes('@')) throw new Error('invalid email');
  if (input.password.length < 6) throw new Error('password must be at least 6 characters');

  const passwordHash = await bcrypt.hash(input.password, 10);
  const role: UserRole = input.role === 'teacher' ? 'teacher' : 'student';
  const result = getDb()
    .prepare(
      `INSERT INTO users (email, password_hash, display_name, role) VALUES (?, ?, ?, ?)`,
    )
    .run(email, passwordHash, input.displayName?.trim() || null, role);

  const user = findUserById(Number(result.lastInsertRowid));
  if (!user) throw new Error('failed to create user');
  return user;
}

export async function verifyPassword(email: string, password: string): Promise<User | null> {
  const row = findUserByEmail(email);
  if (!row) return null;
  const ok = await bcrypt.compare(password, row.password_hash);
  if (!ok) return null;
  return toUser(row);
}
