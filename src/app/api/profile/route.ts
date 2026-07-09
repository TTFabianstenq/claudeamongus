import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/server/auth/auth";
import { databaseConfigured, getPrisma } from "@/server/persistence/prisma";
import { HATS, PLAYER_COLORS } from "@/shared/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const updateSchema = z
  .object({
    displayName: z.string().trim().min(1).max(24).optional(),
    bio: z.string().max(200).optional(),
    favoriteColor: z.enum(PLAYER_COLORS.map((c) => c.id) as [string, ...string[]]).optional(),
    equippedHat: z.enum(HATS.map((h) => h.id) as [string, ...string[]]).optional(),
    settings: z
      .object({
        theme: z.enum(["dark", "light"]).optional(),
        sfxVolume: z.number().min(0).max(1).optional(),
        musicVolume: z.number().min(0).max(1).optional(),
        reducedMotion: z.boolean().optional(),
        colorblindMode: z.boolean().optional(),
      })
      .optional(),
  })
  .strict();

export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  if (!databaseConfigured()) {
    return NextResponse.json({ error: "No database configured" }, { status: 503 });
  }
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      profile: true,
      stats: true,
      settings: true,
      cosmetics: { include: { cosmetic: true } },
    },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  return NextResponse.json({
    name: user.name,
    email: user.email,
    profile: user.profile,
    stats: user.stats,
    settings: user.settings,
    cosmetics: user.cosmetics.map((uc) => ({
      key: uc.cosmetic.key,
      name: uc.cosmetic.name,
      type: uc.cosmetic.type,
      rarity: uc.cosmetic.rarity,
      unlockedAt: uc.unlockedAt,
    })),
  });
}

export async function PUT(request: Request): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  if (!databaseConfigured()) {
    return NextResponse.json({ error: "No database configured" }, { status: 503 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }
  const prisma = getPrisma();
  const { settings, ...profileFields } = parsed.data;

  if (Object.keys(profileFields).length > 0) {
    await prisma.profile.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        displayName: profileFields.displayName ?? session.user.name ?? "Crewmate",
        ...profileFields,
      },
      update: profileFields,
    });
    if (profileFields.displayName) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { name: profileFields.displayName },
      });
    }
  }
  if (settings) {
    await prisma.userSettings.upsert({
      where: { userId: session.user.id },
      create: { userId: session.user.id, ...settings },
      update: settings,
    });
  }
  return NextResponse.json({ ok: true });
}
