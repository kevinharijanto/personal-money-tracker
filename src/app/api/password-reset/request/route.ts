import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { sendPasswordResetEmail } from "@/lib/email";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";


export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = body?.email?.toString().trim().toLowerCase();

  if (!email) {
    return NextResponse.json(
      { error: "Email is required" },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({ where: { email } }).catch(() => null);

  if (user) {
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 60 mins

    await prisma.verificationToken.deleteMany({
      where: { identifier: email },
    });

    await prisma.verificationToken.create({
      data: {
        identifier: email,
        token,
        expires,
      },
    });

    await sendPasswordResetEmail(email, token);
  }

  return NextResponse.json({
    success: true,
    message: "If that email exists, a reset link has been sent.",
  });
}