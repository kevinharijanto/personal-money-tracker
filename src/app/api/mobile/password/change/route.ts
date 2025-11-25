import { NextRequest, NextResponse } from "next/server";
import { addCorsHeaders } from "@/lib/cors";
import { verifyMobileToken } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";
import { hashWithPepper, verifyPassword } from "@/lib/security";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";


export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin");
  const res = new NextResponse(null, { status: 200 });
  return addCorsHeaders(res, origin);
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");

  try {
    const authUser = await verifyMobileToken(req);
    if (!authUser) {
      const res = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      return addCorsHeaders(res, origin);
    }

    const body = await req.json().catch(() => null);
    const oldPassword = body?.oldPassword?.toString();
    const newPassword = body?.newPassword?.toString();

    if (!oldPassword || !newPassword) {
      const res = NextResponse.json(
        { error: "Old password and new password are required" },
        { status: 400 },
      );
      return addCorsHeaders(res, origin);
    }

    if (newPassword.length < 8) {
      const res = NextResponse.json(
        { error: "New password must be at least 8 characters" },
        { status: 400 },
      );
      return addCorsHeaders(res, origin);
    }

    const user = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: { passwordHash: true },
    });

    if (!user || !user.passwordHash) {
      const res = NextResponse.json(
        { error: "Account cannot change password" },
        { status: 400 },
      );
      return addCorsHeaders(res, origin);
    }

    const matches = await verifyPassword(oldPassword, user.passwordHash);
    if (!matches) {
      const res = NextResponse.json(
        { error: "Old password is incorrect" },
        { status: 400 },
      );
      return addCorsHeaders(res, origin);
    }

    const passwordHash = await hashWithPepper(newPassword);
    await prisma.user.update({
      where: { id: authUser.id },
      data: { passwordHash },
    });

    const res = NextResponse.json({
      success: true,
      message: "Password has changed",
    });
    return addCorsHeaders(res, origin);
  } catch (error) {
    console.error("Mobile password change error", error);
    const res = NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
    return addCorsHeaders(res, origin);
  }
}
