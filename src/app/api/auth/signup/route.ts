import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, hashPassword } from "@/lib/auth";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

function logSignupDatabaseError(stage: string, email: string, error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    console.error("[signup][db] Prisma known request error", {
      stage,
      email,
      code: error.code,
      message: error.message,
      meta: error.meta,
      stack: error.stack
    });
    return;
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    console.error("[signup][db] Prisma initialization error", {
      stage,
      email,
      message: error.message,
      errorCode: error.errorCode,
      stack: error.stack
    });
    return;
  }

  if (error instanceof Prisma.PrismaClientRustPanicError) {
    console.error("[signup][db] Prisma engine panic", {
      stage,
      email,
      message: error.message,
      stack: error.stack
    });
    return;
  }

  if (error instanceof Error) {
    console.error("[signup][db] Unknown error", {
      stage,
      email,
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    return;
  }

  console.error("[signup][db] Non-error thrown value", {
    stage,
    email,
    value: error
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Please enter a valid email and password." }, { status: 400 });
    }

    const email = parsed.data.email.toLowerCase();

    try {
      const existing = await db.user.findUnique({ where: { email } });
      if (existing) {
        return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
      }

      const passwordHash = await hashPassword(parsed.data.password);
      const user = await db.user.create({
        data: { email, passwordHash }
      });

      await createSession(user.id);
    } catch (dbError) {
      logSignupDatabaseError("create-account", email, dbError);
      return NextResponse.json({ error: "Unable to create account right now." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("signup error", error);
    return NextResponse.json({ error: "Unable to create account right now." }, { status: 500 });
  }
}
