import { createClient } from "@supabase/supabase-js";

export const hasSupabaseConfig = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY,
);

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://invalid-supabase-url.local",
  process.env.SUPABASE_SERVICE_KEY ?? "invalid-service-role-key",
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
