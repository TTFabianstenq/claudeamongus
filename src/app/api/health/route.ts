import { NextResponse } from "next/server";
import { databaseConfigured } from "@/server/persistence/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    ok: true,
    database: databaseConfigured(),
    time: new Date().toISOString(),
  });
}
