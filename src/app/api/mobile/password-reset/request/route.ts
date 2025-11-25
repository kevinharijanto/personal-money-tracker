import { NextRequest, NextResponse } from "next/server";
import { addCorsHeaders } from "@/lib/cors";
import { handlePasswordResetRequest } from "@/lib/password-reset";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";


export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin");
  const res = new NextResponse(null, { status: 200 });
  return addCorsHeaders(res, origin);
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const res = await handlePasswordResetRequest(req);
  return addCorsHeaders(res, origin);
}
