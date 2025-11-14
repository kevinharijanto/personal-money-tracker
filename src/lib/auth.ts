import { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";

export async function authenticate(req: NextRequest): Promise<string> {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.uid || typeof token.uid !== 'string') {
    throw new Error('Unauthorized');
  }
  return token.uid;
}

export function handleError(error: unknown): NextResponse {
  console.error(error);
  
  if (error instanceof Error) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}