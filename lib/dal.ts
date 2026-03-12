import 'server-only';
import { cookies } from 'next/headers';
import { decrypt } from './session';
import { redirect } from 'next/navigation';
import { db } from '@/db';

export type User = {
  email: string;
  name: string;
  password: string;
};

export async function verifySession() {
  const session = (await cookies()).get('session')?.value;
  const payload = await decrypt(session);

  // check if the payload is invalid
  if (payload.invalid) return redirect('/login');

  return {
    payload,
  };
}

export async function verifyAuth() {
  const { payload } = await verifySession();
  if (!payload.sub) return redirect('/login');

  // check if user exists
  const user = await db.query.usersTable.findFirst({
    where: (usersTable, { eq }) => eq(usersTable.email, payload.sub!),
  });
  const exists = !!user;
  if (!exists) return redirect('/login');
  if (user.status !== "active") return redirect('/login');

  return {
    user: user,
    authenticated: true,
  };
}
