import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { databaseConfigured, getPrisma } from "@/server/persistence/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const registerSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
  name: z.string().trim().min(1).max(24),
});

export async function POST(request: Request): Promise<NextResponse> {
  if (!databaseConfigured()) {
    return NextResponse.json(
      { error: "Accounts are disabled on this server (no database configured)" },
      { status: 503 },
    );
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }
  const prisma = getPrisma();
  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists" },
      { status: 409 },
    );
  }
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const user = await prisma.user.create({
    data: {
      email,
      name: parsed.data.name,
      passwordHash,
      profile: { create: { displayName: parsed.data.name } },
      stats: { create: {} },
      settings: { create: {} },
    },
  });

  // grant the starter cosmetics catalog
  const starters = await prisma.cosmetic.findMany({ where: { rarity: "common" } });
  if (starters.length > 0) {
    await prisma.userCosmetic.createMany({
      data: starters.map((c) => ({ userId: user.id, cosmeticId: c.id })),
      skipDuplicates: true,
    });
  }

  return NextResponse.json({ ok: true, userId: user.id }, { status: 201 });
}
