import { NextResponse } from "next/server";
import { z } from "zod";
import { createStudentSession } from "@/lib/auth";

const schema = z.object({
  inviteCode: z.string().trim().min(1),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Please enter a valid invite code." }, { status: 400 });
    }

    await createStudentSession(parsed.data.inviteCode);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("signup invite error", error);
    return NextResponse.json({ error: "Unable to create account right now." }, { status: 500 });
  }
}
