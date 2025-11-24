import NextAuth from "next-auth";
import { authOptions } from "@/auth";
import { addCorsHeaders } from "@/lib/cors";
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";


const handler = NextAuth(authOptions);

const corsHandler = async (
  ...args: Parameters<typeof handler>
) => {
  const [req] = args;
  const origin = req.headers.get("origin");
  const response = await handler(...args);

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