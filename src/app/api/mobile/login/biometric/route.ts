import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";
import { addCorsHeaders } from "@/lib/cors";

// Handle preflight
export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin");
  const res = new NextResponse(null, { status: 200 });
  return addCorsHeaders(res, origin);
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");

  try {
    const { email, assertion } = await req.json();

    if (!email || !assertion) {
      const res = NextResponse.json(
        { error: "Email and biometric assertion required" },
        { status: 400 }
      );
      return addCorsHeaders(res, origin);
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      const res = NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
      return addCorsHeaders(res, origin);
    }

    // Find quick login for biometric authentication
    const quickLogin = await prisma.quickLogin.findFirst({
      where: {
        userId: user.id,
        type: 'BIOMETRIC',
        enabled: true,
      },
    });

    if (!quickLogin) {
      const res = NextResponse.json(
        { error: "Biometric authentication not set up for this user" },
        { status: 400 }
      );
      return addCorsHeaders(res, origin);
    }

    // In a real implementation, you would verify WebAuthn assertion here
    // For now, we'll simulate successful verification
    // TODO: Implement actual WebAuthn verification
    const isValid = true; // This would be replaced with actual WebAuthn verification

    if (!isValid) {
      const res = NextResponse.json(
        { error: "Biometric verification failed" },
        { status: 401 }
      );
      return addCorsHeaders(res, origin);
    }

    // Sign JWT
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
      throw new Error("Missing NEXTAUTH_SECRET");
    }

    const token = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        name: user.name,
      },
      secret,
      { expiresIn: "7d" }
    );

    const res = NextResponse.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });

    return addCorsHeaders(res, origin);
  } catch (err) {
    console.error("Mobile biometric login error", err);
    const res = NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
    return addCorsHeaders(res, origin);
  }
}