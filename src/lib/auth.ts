import { randomBytes } from "crypto";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const SESSION_COOKIE = "psc_session";
const SESSION_DURATION_DAYS = 30;
const ADMIN_EMAIL = "rachel@psclashes.com";
const ADMIN_PASSWORD = "PSC180admin!";
const STUDENT_INVITE_PREFIX = "PSC180-";

export type AuthRole = "ADMIN" | "STUDENT";

export type AuthUser = {
  id: string;
  email: string;
  role: AuthRole;
  name: string;
  inviteCode?: string;
  sid: string;
  fallbackState?: string;
};

export type SessionUser = AuthUser;

type SessionTokenPayload = JWTPayload & {
  sub: string;
  email: string;
  role: AuthRole;
  name: string;
  sid: string;
  inviteCode?: string;
  fallbackState?: string;
};

function getJwtSecret() {
  const secret = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("Missing NEXTAUTH_SECRET environment variable.");
  }
  return new TextEncoder().encode(secret);
}

function expiresAtDate() {
  return new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);
}

async function signSessionToken(payload: Omit<SessionTokenPayload, "iat" | "exp">) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_DAYS}d`)
    .sign(getJwtSecret());
}

async function writeSessionCookie(token: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAtDate(),
    path: "/",
  });
}

async function readVerifiedSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) {
    return null;
  }
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    const parsed = payload as SessionTokenPayload;

    if (!parsed.sub || !parsed.email || !parsed.role || !parsed.name || !parsed.sid) {
      store.delete(SESSION_COOKIE);
      return null;
    }
    return { store, payload: parsed };
  } catch {
    store.delete(SESSION_COOKIE);
    return null;
  }
}

export async function destroySession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export function isAdminCredentials(email: string, password: string) {
  return email.trim().toLowerCase() === ADMIN_EMAIL && password === ADMIN_PASSWORD;
}

export function normalizeInviteCode(inviteCode: string) {
  return inviteCode.trim().toUpperCase();
}

export function isValidInviteCode(inviteCode: string) {
  const normalized = normalizeInviteCode(inviteCode);
  return /^PSC180-[A-Z0-9-]{2,40}$/.test(normalized) && normalized.startsWith(STUDENT_INVITE_PREFIX);
}

export async function createAdminSession() {
  const token = await signSessionToken({
    sub: "admin-rachel",
    email: ADMIN_EMAIL,
    role: "ADMIN",
    name: "Rachel",
    sid: randomBytes(12).toString("hex"),
  });
  await writeSessionCookie(token);
}

export async function createStudentSession(inviteCodeInput: string) {
  const inviteCode = normalizeInviteCode(inviteCodeInput);
  if (!isValidInviteCode(inviteCode)) {
    throw new Error("Invalid invite code.");
  }

  const nameSegment = inviteCode.split("-").slice(1).join(" ").trim();
  const displayName = nameSegment
    ? nameSegment
        .split(" ")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(" ")
    : "PSC Student";

  const token = await signSessionToken({
    sub: `student-${inviteCode}`,
    email: `${inviteCode.toLowerCase()}@students.psc`,
    role: "STUDENT",
    name: displayName,
    sid: randomBytes(12).toString("hex"),
    inviteCode,
  });
  await writeSessionCookie(token);
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const session = await readVerifiedSession();
  if (!session) {
    return null;
  }
  const parsed = session.payload;
  return {
    id: parsed.sub,
    email: parsed.email,
    role: parsed.role,
    name: parsed.name,
    inviteCode: parsed.inviteCode,
    sid: parsed.sid,
    fallbackState: parsed.fallbackState,
  };
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

export async function setSessionFallbackState(fallbackState: string | null) {
  const session = await readVerifiedSession();
  if (!session) return;

  const payload = session.payload;
  const token = await signSessionToken({
    sub: payload.sub,
    email: payload.email,
    role: payload.role,
    name: payload.name,
    sid: payload.sid,
    inviteCode: payload.inviteCode,
    fallbackState: fallbackState ?? undefined,
  });
  await writeSessionCookie(token);
}
