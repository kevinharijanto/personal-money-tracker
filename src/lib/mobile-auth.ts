import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";
import { prisma } from "./prisma";

export interface MobileUser {
  id: string;
  email: string;
  name?: string | null;
}

/**
 * Verify JWT token from mobile requests
 * Returns the user object if valid, null otherwise
 */
export async function verifyMobileToken(req: NextRequest): Promise<MobileUser | null> {
  try {
    const authHeader = req.headers.get("authorization");
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return null;
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix
    
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
      console.error("Missing NEXTAUTH_SECRET");
      return null;
    }

    // Verify JWT token
    const decoded = jwt.verify(token, secret) as any;
    
    // Optional: Verify user still exists in database
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    if (!user) {
      return null;
    }

    return user;
  } catch (error) {
    console.error("Token verification error:", error);
    return null;
  }
}

/**
 * Helper function to create a consistent unauthorized response
 */
export function createUnauthorizedResponse(message: string = "Unauthorized") {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status: 401,
      headers: { "Content-Type": "application/json" },
    }
  );
}