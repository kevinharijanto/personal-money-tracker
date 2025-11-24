import NextAuth from "next-auth";
import { authOptions } from "@/auth";
import { addCorsHeaders } from "@/lib/cors";
import { NextResponse, NextRequest } from "next/server";

const handler = NextAuth(authOptions);

// Wrap the handler to add CORS headers
const corsHandler = async (
  req: NextRequest,
  context: { params: { nextauth: string[] } },
) => {
  const origin = req.headers.get("origin");
  const response = await handler(req, context);

  // Convert response to NextResponse if it's not already
  const nextResponse =
    response instanceof NextResponse
      ? response
      : new NextResponse(response.body, {
          status: response.status,
          headers: response.headers,
        });

  return addCorsHeaders(nextResponse, origin);
};

export { corsHandler as GET, corsHandler as POST };
