import bcrypt from "bcryptjs";

export async function hashWithPepper(plain: string): Promise<string> {
  const pepper = process.env.PEPPER_SECRET!;
  return bcrypt.hash(plain + pepper, 12);
}

export async function compareWithPepper(
  plain: string,
  hashed: string,
): Promise<boolean> {
  const pepper = process.env.PEPPER_SECRET!;
  return bcrypt.compare(plain + pepper, hashed);
}

export async function verifyPassword(
  plain: string,
  hashed: string,
): Promise<boolean> {
  let ok = false;
  if (process.env.PEPPER_SECRET) {
    try {
      ok = await compareWithPepper(plain, hashed);
    } catch {
      ok = false;
    }
  }
  if (ok) return true;
  return bcrypt.compare(plain, hashed);
}

export function generateRandomString(length: number): string {
  const charset =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+";
  return Array.from(crypto.getRandomValues(new Uint8Array(length)))
    .map((byte) => charset[byte % charset.length])
    .join("");
}
