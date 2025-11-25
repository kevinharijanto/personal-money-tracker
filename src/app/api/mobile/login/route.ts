import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";
import { addCorsHeaders } from "@/lib/cors";
import { verifyPassword } from "@/lib/security";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";


// Handle preflight
export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin");
  const res = new NextResponse(null, { status: 200 });
  return addCorsHeaders(res, origin);
}

// Normal POST login
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");

  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      const res = NextResponse.json(
        { error: "Email and password required" },
        { status: 400 }
      );
      return addCorsHeaders(res, origin);
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      const res = NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
      return addCorsHeaders(res, origin);
    }

    if (!user.passwordHash) {
      const res = NextResponse.json(
        { error: "Account cannot sign in with credentials" },
        { status: 401 }
      );
      return addCorsHeaders(res, origin);
    }

    // Passwords are stored with a pepper, so use the shared helper to verify.
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      const res = NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
      return addCorsHeaders(res, origin);
    }

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
    console.error("Mobile login error", err);
    const res = NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
    return addCorsHeaders(res, origin);
  }
}
