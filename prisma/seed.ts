import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { HATS, PLAYER_COLORS } from "../src/shared/constants";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log("Seeding cosmetics catalog…");
  for (const hat of HATS) {
    await prisma.cosmetic.upsert({
      where: { key: `hat:${hat.id}` },
      create: {
        key: `hat:${hat.id}`,
        name: hat.name,
        type: "HAT",
        rarity: ["crown", "halo"].includes(hat.id) ? "rare" : "common",
        description: `${hat.name} headwear for your crewmate.`,
      },
      update: { name: hat.name },
    });
  }
  for (const color of PLAYER_COLORS) {
    await prisma.cosmetic.upsert({
      where: { key: `color:${color.id}` },
      create: {
        key: `color:${color.id}`,
        name: color.name,
        type: "COLOR",
        rarity: "common",
        description: `The ${color.name.toLowerCase()} suit.`,
      },
      update: { name: color.name },
    });
  }

  console.log("Seeding demo account…");
  const passwordHash = await bcrypt.hash("crewfall-demo", 12);
  const demo = await prisma.user.upsert({
    where: { email: "demo@crewfall.example" },
    create: {
      email: "demo@crewfall.example",
      name: "DemoCrew",
      passwordHash,
      profile: { create: { displayName: "DemoCrew", bio: "Just here to do tasks." } },
      stats: {
        create: {
          gamesPlayed: 12,
          gamesWon: 7,
          crewGames: 9,
          crewWins: 5,
          impostorGames: 3,
          impostorWins: 2,
          kills: 6,
          timesKilled: 4,
          tasksCompleted: 41,
          bodiesReported: 3,
          emergenciesCalled: 2,
          sabotagesFixed: 5,
        },
      },
      settings: { create: {} },
    },
    update: {},
  });

  const commons = await prisma.cosmetic.findMany({ where: { rarity: "common" } });
  await prisma.userCosmetic.createMany({
    data: commons.map((c) => ({ userId: demo.id, cosmeticId: c.id })),
    skipDuplicates: true,
  });

  console.log("Seed complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
