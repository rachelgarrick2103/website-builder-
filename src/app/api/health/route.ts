import { NextResponse } from "next/server";
import {
  hasRequiredDatabaseParams,
  hasSupabaseConfig,
  isSupabaseUnavailableError,
  normalizedDatabaseUrl,
  supabase,
  withSupabaseTimeout,
} from "@/lib/supabase";

export async function GET() {
  const databaseUrl = process.env.DATABASE_URL ?? null;
  const hasDatabaseUrl = Boolean(databaseUrl);
  const activeDatabaseUrl = normalizedDatabaseUrl ?? databaseUrl;

  try {
    const { error } = await withSupabaseTimeout(
      supabase.from("Project").select("id").limit(1),
    );

    if (error) {
      return NextResponse.json(
        {
          databaseUrlPresent: hasDatabaseUrl,
          databaseUrlHasRequiredParams: hasRequiredDatabaseParams(activeDatabaseUrl),
          supabaseConfigured: hasSupabaseConfig,
          supabaseConnection: "failed",
          error: error.message,
        },
        { status: 503 },
      );
    }

    return NextResponse.json({
      databaseUrlPresent: hasDatabaseUrl,
      databaseUrlHasRequiredParams: hasRequiredDatabaseParams(activeDatabaseUrl),
      supabaseConfigured: hasSupabaseConfig,
      supabaseConnection: "ok",
      error: null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        databaseUrlPresent: hasDatabaseUrl,
        databaseUrlHasRequiredParams: hasRequiredDatabaseParams(activeDatabaseUrl),
        supabaseConfigured: hasSupabaseConfig,
        supabaseConnection: "failed",
        error:
          error instanceof Error
            ? error.message
            : isSupabaseUnavailableError(error)
              ? "Supabase unavailable"
              : "Unknown connection error",
      },
      { status: 503 },
    );
  }
}
