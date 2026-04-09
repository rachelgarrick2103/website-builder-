import { createClient } from "@supabase/supabase-js";

const REQUIRED_DATABASE_PARAMS: Record<string, string> = {
  sslmode: "require",
  connection_limit: "1",
  pool_timeout: "20",
};

function normalizeDatabaseUrl(url?: string) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    Object.entries(REQUIRED_DATABASE_PARAMS).forEach(([key, value]) => {
      parsed.searchParams.set(key, value);
    });
    return parsed.toString();
  } catch {
    return url;
  }
}

function deriveSupabaseUrlFromDatabaseUrl(url?: string) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    const refMatch = host.match(/^db\.([a-z0-9-]+)\.supabase\.co$/i);
    if (!refMatch) return null;
    return `https://${refMatch[1]}.supabase.co`;
  } catch {
    return null;
  }
}

export const normalizedDatabaseUrl = normalizeDatabaseUrl(process.env.DATABASE_URL);

if (normalizedDatabaseUrl) {
  process.env.DATABASE_URL = normalizedDatabaseUrl;
}

const resolvedSupabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  process.env.SUPABASE_URL ??
  deriveSupabaseUrlFromDatabaseUrl(normalizedDatabaseUrl ?? process.env.DATABASE_URL) ??
  null;

const resolvedSupabaseServiceKey =
  process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? null;

export const hasSupabaseConfig = Boolean(resolvedSupabaseUrl && resolvedSupabaseServiceKey);

export const supabase = createClient(
  resolvedSupabaseUrl ?? "https://invalid-supabase-url.local",
  resolvedSupabaseServiceKey ?? "invalid-service-role-key",
);

const DEFAULT_TIMEOUT_MS = 5000;

export type SupabaseQueryResult<T> = {
  data: T;
  error: { message?: string } | null;
};

export async function withSupabaseTimeout(promise: PromiseLike<any>, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<any> {
  if (!hasSupabaseConfig) {
    throw new Error("supabase not configured");
  }
  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race<any>([
      promise,
      new Promise<any>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("timeout")), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

export function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && error.message.toLowerCase().includes("timeout");
}

export async function runSupabaseQuery<T>(
  query: PromiseLike<SupabaseQueryResult<T>>,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const { data, error } = await withSupabaseTimeout(query, timeoutMs);
  if (error) {
    throw new Error(error.message ?? "Supabase query failed");
  }
  return data;
}

export function isSupabaseError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("supabase not configured") ||
    message.includes("timeout") ||
    message.includes("fetch failed") ||
    message.includes("network") ||
    message.includes("socket") ||
    message.includes("econn") ||
    message.includes("connection terminated")
  );
}

export const isSupabaseUnavailableError = isSupabaseError;

export function hasRequiredDatabaseParams(url?: string | null) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return Object.entries(REQUIRED_DATABASE_PARAMS).every(
      ([key, value]) => parsed.searchParams.get(key) === value,
    );
  } catch {
    return false;
  }
}
