import jwt from "jsonwebtoken";

const DEFAULT_ADMIN_PASSWORD = "Password123!";
const TOKEN_AUDIENCE = "admin-dashboard";
const TOKEN_ISSUER = "personal-money-tracker";

function getSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET || process.env.ADMIN_TOKEN_SECRET;
  if (!secret) {
    throw new Error("Missing NEXTAUTH_SECRET or ADMIN_TOKEN_SECRET for admin auth");
  }
  return secret;
}

export function verifyAdminPassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;
  return password === expected;
}

export function createAdminToken(): { token: string; expiresAt: string } {
  const secret = getSecret();
  const expiresIn = "1h";
  const token = jwt.sign(
    {
      role: "admin",
      aud: TOKEN_AUDIENCE,
      iss: TOKEN_ISSUER,
    },
    secret,
    { expiresIn },
  );
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  return { token, expiresAt };
}

export function verifyAdminToken(token: string | null | undefined): boolean {
  if (!token) return false;
  try {
    const secret = getSecret();
    const payload = jwt.verify(token, secret) as jwt.JwtPayload;
    return payload.role === "admin" && payload.aud === TOKEN_AUDIENCE && payload.iss === TOKEN_ISSUER;
  } catch {
    return false;
  }
}

export function extractAdminToken(req: Request): string | null {
  const header = req.headers.get("authorization") || req.headers.get("Authorization");
  if (header?.startsWith("Bearer ")) {
    return header.slice("Bearer ".length).trim();
  }
  const alt = req.headers.get("x-admin-token");
  return alt ? alt.trim() : null;
}

export function requireAdmin(req: Request):
  | { ok: true }
  | { ok: false; response: Response } {
  const token = extractAdminToken(req);
  if (!verifyAdminToken(token)) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    };
  }
  return { ok: true };
}
