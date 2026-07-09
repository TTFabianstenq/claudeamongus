import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/server/auth/auth";
import { databaseConfigured, getPrisma } from "@/server/persistence/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({ email: z.string().email() }).strict();
const respondSchema = z
  .object({
    friendshipId: z.string().min(1),
    action: z.enum(["accept", "decline", "remove"]),
  })
  .strict();

async function requireUser(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function GET(): Promise<NextResponse> {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!databaseConfigured()) return NextResponse.json({ friends: [], pending: [] });

  const prisma = getPrisma();
  const rows = await prisma.friendship.findMany({
    where: { OR: [{ requesterId: userId }, { addresseeId: userId }] },
    include: {
      requester: { select: { id: true, name: true } },
      addressee: { select: { id: true, name: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const friends = rows
    .filter((r) => r.status === "ACCEPTED")
    .map((r) => ({
      friendshipId: r.id,
      user: r.requesterId === userId ? r.addressee : r.requester,
    }));
  const pending = rows
    .filter((r) => r.status === "PENDING")
    .map((r) => ({
      friendshipId: r.id,
      user: r.requesterId === userId ? r.addressee : r.requester,
      incoming: r.addresseeId === userId,
    }));
  return NextResponse.json({ friends, pending });
}

export async function POST(request: Request): Promise<NextResponse> {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!databaseConfigured()) {
    return NextResponse.json({ error: "No database configured" }, { status: 503 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const prisma = getPrisma();
  const target = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
  });
  if (!target) return NextResponse.json({ error: "No player with that email" }, { status: 404 });
  if (target.id === userId) {
    return NextResponse.json({ error: "You cannot befriend yourself" }, { status: 400 });
  }
  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: userId, addresseeId: target.id },
        { requesterId: target.id, addresseeId: userId },
      ],
    },
  });
  if (existing) {
    return NextResponse.json({ error: "Friend request already exists" }, { status: 409 });
  }
  const friendship = await prisma.friendship.create({
    data: { requesterId: userId, addresseeId: target.id },
  });
  return NextResponse.json({ ok: true, friendshipId: friendship.id }, { status: 201 });
}

export async function PATCH(request: Request): Promise<NextResponse> {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!databaseConfigured()) {
    return NextResponse.json({ error: "No database configured" }, { status: 503 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = respondSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const prisma = getPrisma();
  const friendship = await prisma.friendship.findUnique({
    where: { id: parsed.data.friendshipId },
  });
  if (!friendship || (friendship.addresseeId !== userId && friendship.requesterId !== userId)) {
    return NextResponse.json({ error: "Friendship not found" }, { status: 404 });
  }
  if (parsed.data.action === "accept") {
    if (friendship.addresseeId !== userId) {
      return NextResponse.json({ error: "Only the recipient can accept" }, { status: 403 });
    }
    await prisma.friendship.update({
      where: { id: friendship.id },
      data: { status: "ACCEPTED" },
    });
  } else {
    await prisma.friendship.delete({ where: { id: friendship.id } });
  }
  return NextResponse.json({ ok: true });
}
