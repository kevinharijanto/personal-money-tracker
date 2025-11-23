import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";
import { compareWithPepper } from "@/lib/security";
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
    const { email, pin } = await req.json();

    if (!email || !pin) {
      const res = NextResponse.json(
        { error: "Email and PIN required" },
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

    // Find quick login record for PIN
    const quickLogin = await prisma.quickLogin.findFirst({
      where: {
        user: { email },
        type: 'PIN',
        enabled: true,
        pinHash: { not: null }
      },
      include: { user: true },
    });

    // Always return same error to prevent user enumeration
    if (!quickLogin || !quickLogin.user || !quickLogin.pinHash) {
      // Run dummy comparison to prevent timing attacks
      await compareWithPepper('dummy', '$2a$10$dummydummydummydummydum');
      const res = NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
      return addCorsHeaders(res, origin);
    }
    
    // Verify PIN
    const isValid = await compareWithPepper(pin, quickLogin.pinHash);
    if (!isValid) {
      const res = NextResponse.json(
        { error: "Invalid PIN" },
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
    console.error("Mobile PIN login error", err);
    const res = NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
    return addCorsHeaders(res, origin);
  }
}