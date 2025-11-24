import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { addCorsHeaders } from "@/lib/cors";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";


// Handle preflight
export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin");
  const res = new NextResponse(null, { status: 200 });
  return addCorsHeaders(res, origin);
}

/**
 * Verify email using token created at signup.
 * Marks User.emailVerified and deletes the verification token.
 * Redirects to /signin with a flag indicating success.
 *
 * GET /api/auth/verify-email?token=...
 */
export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin");
  
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token) {
      const res = NextResponse.json({ error: "Token is required" }, { status: 400 });
      return addCorsHeaders(res, origin);
    }

    // Find verification token
    const vt = await (prisma as any).verificationToken.findUnique({
      where: { token },
    });

    if (!vt) {
      const res = NextResponse.json({ error: "Invalid verification token" }, { status: 404 });
      return addCorsHeaders(res, origin);
    }

    // Check expiry
    if (vt.expires < new Date()) {
      // Optionally clean up expired token
      await (prisma as any).verificationToken.delete({ where: { token } }).catch(() => {});
      const res = NextResponse.json({ error: "Verification token has expired" }, { status: 400 });
      return addCorsHeaders(res, origin);
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
    const res = NextResponse.redirect(redirectUrl);
    return addCorsHeaders(res, origin);
  } catch (error) {
    console.error("Error verifying email:", error);
    const res = NextResponse.json({ error: "Internal server error" }, { status: 500 });
    return addCorsHeaders(res, origin);
  }
}
