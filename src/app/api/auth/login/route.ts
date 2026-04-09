import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSession, createStudentSession } from "@/lib/auth";

const schema = z.object({
  email: z.string().trim().min(1),
  password: z.string().trim().min(1),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Please enter a valid email and password." }, { status: 400 });
    }

    const email = parsed.data.email.toLowerCase().trim();
    const password = parsed.data.password;

    if (email === "rachel@psclashes.com" && password === "PSC180admin!") {
      await createAdminSession();
      return NextResponse.json({ ok: true });
    }

    const inviteCode = password.toUpperCase();
    if (/^PSC180-[A-Z0-9-]{2,40}$/.test(inviteCode)) {
      await createStudentSession(inviteCode);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Invalid login details." }, { status: 401 });
  } catch (error) {
    console.error("login error", error);
    return NextResponse.json({ error: "Unable to log in right now." }, { status: 500 });
  }
}
