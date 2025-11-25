import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";
import { hashWithPepper } from "@/lib/security";

export async function handlePasswordResetRequest(req: Request) {
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

export async function handlePasswordResetConfirm(req: Request) {
  const body = await req.json().catch(() => null);
  const token = body?.token?.toString().trim();
  const password = body?.password?.toString();

  if (!token || !password) {
    return NextResponse.json(
      { error: "Token and password are required" },
      { status: 400 },
    );
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 },
    );
  }

  const record = await prisma.verificationToken.findUnique({
    where: { token },
  });

  if (!record || record.expires < new Date()) {
    if (record) {
      await prisma.verificationToken.delete({ where: { token } });
    }
    return NextResponse.json(
      { error: "Reset link is invalid or has expired" },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { email: record.identifier },
  });

  if (!user) {
    await prisma.verificationToken.delete({ where: { token } });
    return NextResponse.json(
      { error: "User not found" },
      { status: 404 },
    );
  }

  const passwordHash = await hashWithPepper(password);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });
  await prisma.verificationToken.delete({ where: { token } });

  return NextResponse.json({ success: true });
}
