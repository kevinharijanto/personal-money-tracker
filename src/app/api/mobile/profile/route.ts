import { NextRequest, NextResponse } from "next/server";
import { verifyMobileToken } from "@/lib/mobile-auth";
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

export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin");

  // Verify mobile token
  const user = await verifyMobileToken(req as any);
  
  if (!user) {
    const res = NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
    return addCorsHeaders(res, origin);
  }

  try {
    // Get user profile with additional data
    const profile = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
        // Include any other fields you want to expose to mobile
      },
    });

    if (!profile) {
      const res = NextResponse.json(
        { error: "User not found" },
        { status: 401 }
      );
      return addCorsHeaders(res, origin);
    }

    const res = NextResponse.json({
      success: true,
      profile,
    });
    return addCorsHeaders(res, origin);
  } catch (error) {
    console.error("Error fetching mobile profile:", error);
    const res = NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
    return addCorsHeaders(res, origin);
  }
}
