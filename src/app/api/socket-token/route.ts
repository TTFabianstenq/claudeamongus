import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/server/auth/auth";
import { signSocketToken } from "@/server/auth/socketToken";
import { randomToken } from "@/shared/rng";
import { NAME_MAX_LENGTH } from "@/shared/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  guestName: z.string().trim().min(1).max(NAME_MAX_LENGTH).optional(),
});

/**
 * Issues the short-lived JWT a browser presents in the Socket.IO handshake.
 * Signed-in users are bound to their account id; everyone else receives an
 * unlinked guest identity. The realtime server verifies this token before
 * any packet is processed.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let guestName = "Guest";
  try {
    const body = bodySchema.safeParse(await request.json());
    if (body.success && body.data.guestName) guestName = body.data.guestName;
  } catch {
    // empty body is fine
  }

  const session = await auth();
  const identity = session?.user?.id
    ? { sub: session.user.id, name: session.user.name ?? guestName, guest: false }
    : { sub: `guest:${randomToken(12)}`, name: guestName, guest: true };

  const token = await signSocketToken(identity);
  return NextResponse.json({ token, guest: identity.guest, name: identity.name });
}
