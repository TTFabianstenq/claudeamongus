import { describe, expect, it } from "vitest";
import { AntiCheat, MAX_STRIKES } from "@/server/engine/AntiCheat";

describe("AntiCheat", () => {
  it("allows normal input rates and rejects floods", () => {
    const guard = new AntiCheat();
    const t0 = 1_000_000;
    // 30 inputs over one second: fine
    for (let i = 0; i < 30; i++) {
      expect(guard.allow("game:input", t0 + i * 33)).toBe(true);
    }
    // 500 inputs in the same instant: the burst budget runs out
    let rejected = 0;
    for (let i = 0; i < 500; i++) {
      if (!guard.allow("game:input", t0 + 1000)) rejected += 1;
    }
    expect(rejected).toBeGreaterThan(400);
  });

  it("caps sustained input rate near the legitimate tick rate", () => {
    const guard = new AntiCheat();
    const t0 = 2_000_000;
    let accepted = 0;
    // a speed-hacking client sends 120 inputs/second for 5 seconds
    for (let i = 0; i < 600; i++) {
      if (guard.allow("game:input", t0 + i * (1000 / 120))) accepted += 1;
    }
    // budget: 90 burst + 45/s refill * 5s = 315 max
    expect(accepted).toBeLessThanOrEqual(320);
  });

  it("kicks after enough strikes", () => {
    const guard = new AntiCheat();
    expect(guard.shouldKick).toBe(false);
    guard.strike(MAX_STRIKES);
    expect(guard.shouldKick).toBe(true);
  });

  it("rate limits kills far harder than movement", () => {
    const guard = new AntiCheat();
    const t0 = 3_000_000;
    expect(guard.allow("game:kill", t0)).toBe(true);
    expect(guard.allow("game:kill", t0)).toBe(true);
    expect(guard.allow("game:kill", t0)).toBe(true);
    expect(guard.allow("game:kill", t0)).toBe(false);
    // refills after a second or two
    expect(guard.allow("game:kill", t0 + 2000)).toBe(true);
  });
});
