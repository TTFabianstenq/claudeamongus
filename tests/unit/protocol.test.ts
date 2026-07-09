import { describe, expect, it } from "vitest";
import {
  chatSchema,
  createRoomSchema,
  inputSchema,
  nameSchema,
  roomCodeSchema,
  settingsSchema,
  voteSchema,
} from "@/shared/protocol";
import { DEFAULT_SETTINGS } from "@/shared/types";

describe("protocol schemas", () => {
  it("accepts sane names and rejects garbage", () => {
    expect(nameSchema.safeParse("SusMuffin").success).toBe(true);
    expect(nameSchema.safeParse("Ana-María_9").success).toBe(true);
    expect(nameSchema.safeParse("").success).toBe(false);
    expect(nameSchema.safeParse("x".repeat(40)).success).toBe(false);
    expect(nameSchema.safeParse("<script>alert(1)</script>").success).toBe(false);
    expect(nameSchema.safeParse("name\nnewline").success).toBe(false);
  });

  it("normalizes room codes to uppercase and enforces the format", () => {
    expect(roomCodeSchema.parse("abcdef")).toBe("ABCDEF");
    expect(roomCodeSchema.safeParse("ABC").success).toBe(false);
    expect(roomCodeSchema.safeParse("ABC12F").success).toBe(false);
  });

  it("clamps movement inputs to the unit square", () => {
    expect(inputSchema.safeParse({ seq: 1, t: 1, moveX: 0.5, moveY: -1 }).success).toBe(true);
    expect(inputSchema.safeParse({ seq: 1, t: 1, moveX: 50, moveY: 0 }).success).toBe(false);
    expect(inputSchema.safeParse({ seq: -1, t: 1, moveX: 0, moveY: 0 }).success).toBe(false);
    expect(inputSchema.safeParse({ seq: 1, t: 1, moveX: 0, moveY: 0, extra: 1 }).success).toBe(
      false,
    );
  });

  it("rejects settings outside the allowed ranges", () => {
    expect(settingsSchema.safeParse(DEFAULT_SETTINGS).success).toBe(true);
    expect(settingsSchema.safeParse({ ...DEFAULT_SETTINGS, playerSpeed: 99 }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...DEFAULT_SETTINGS, impostorCount: 0 }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...DEFAULT_SETTINGS, votingTime: 1 }).success).toBe(false);
  });

  it("bounds chat length and trims whitespace-only messages", () => {
    expect(chatSchema.safeParse({ text: "hello" }).success).toBe(true);
    expect(chatSchema.safeParse({ text: "   " }).success).toBe(false);
    expect(chatSchema.safeParse({ text: "x".repeat(500) }).success).toBe(false);
  });

  it("accepts vote targets and skip", () => {
    expect(voteSchema.safeParse({ targetId: "skip" }).success).toBe(true);
    expect(voteSchema.safeParse({ targetId: "abc123" }).success).toBe(true);
    expect(voteSchema.safeParse({ targetId: "" }).success).toBe(false);
  });

  it("requires cosmetics to come from the catalog", () => {
    expect(
      createRoomSchema.safeParse({ name: "A", color: "red", hat: "none", isPublic: false }).success,
    ).toBe(true);
    expect(
      createRoomSchema.safeParse({ name: "A", color: "#ff0000", hat: "none", isPublic: false })
        .success,
    ).toBe(false);
    expect(
      createRoomSchema.safeParse({ name: "A", color: "red", hat: "fedora", isPublic: false })
        .success,
    ).toBe(false);
  });
});
