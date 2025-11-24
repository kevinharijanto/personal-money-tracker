import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashWithPepper } from "@/lib/security";

export async function POST(req: Request) {
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
