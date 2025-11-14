import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Verify email using token created at signup.
 * Marks User.emailVerified and deletes the verification token.
 * Redirects to /signin with a flag indicating success.
 *
 * GET /api/auth/verify-email?token=...
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    // Find verification token
    const vt = await (prisma as any).verificationToken.findUnique({
      where: { token },
    });

    if (!vt) {
      return NextResponse.json({ error: "Invalid verification token" }, { status: 404 });
    }

    // Check expiry
    if (vt.expires < new Date()) {
      // Optionally clean up expired token
      await (prisma as any).verificationToken.delete({ where: { token } }).catch(() => {});
      return NextResponse.json({ error: "Verification token has expired" }, { status: 400 });
    }

    // Mark user email as verified
    await (prisma as any).user.update({
      where: { email: vt.identifier },
      data: { emailVerified: new Date() },
    });

    // Delete token after successful verification
    await (prisma as any).verificationToken.delete({
      where: { token },
    });

    // Redirect to sign-in with a success indicator
    const redirectUrl = new URL("/signin?emailVerified=1", req.url);
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error("Error verifying email:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}