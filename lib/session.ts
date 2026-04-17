import 'server-only';

import { JWTPayload, jwtVerify, SignJWT } from 'jose';
import { cookies } from 'next/headers';

const secretKey = process.env.SESSION_SECRET;
if (!secretKey) {
  throw new Error("Missing required environment variable: SESSION_SECRET");
}
const encodedKey = new TextEncoder().encode(secretKey);

type SessionPayload = {
  sub: string | undefined;
  iat: number;
  exp: number;
};

export async function deleteSession() {
  // destroy session cookie
  const cookieStore = await cookies();
  cookieStore.delete('session');
}
export async function createSession(email: string) {
  const exp = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const iat = Date.now();
  const payload: SessionPayload = {
    sub: email,
    iat,
    exp,
  };

  const session = await encrypt(payload);
  const cookieStore = await cookies();
  cookieStore.set('session', session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    expires: exp,
    sameSite: 'lax',
    path: '/',
  });

  // TODO: remove return statement
  return session;
}
export async function encrypt(payload: SessionPayload) {
  // create signed JWT
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(encodedKey);
}
export async function decrypt(session: string = ''): Promise<JWTPayload> {
  // decrypt JWT, throw error if invalid
  try {
    const { payload } = await jwtVerify(session, encodedKey, {
      algorithms: ['HS256'],
    });
    return payload;
  } catch (error) {
    return {
      invalid: true,
    };
  }
}
