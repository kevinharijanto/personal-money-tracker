import { handlePasswordResetConfirm } from "@/lib/password-reset";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";


export async function POST(req: Request) {
  return handlePasswordResetConfirm(req);
}
