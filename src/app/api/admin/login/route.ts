import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminToken, verifyAdminPassword } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const loginSchema = z.object({
  password: z.string().min(1),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = loginSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { password } = parsed.data;
  if (!verifyAdminPassword(password)) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const { token, expiresAt } = createAdminToken();
  return NextResponse.json({ token, expiresAt });
}
