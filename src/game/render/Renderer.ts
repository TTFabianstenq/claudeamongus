"use client";

import { colorDarkHex, colorHex, PLAYER_RADIUS, type HatId } from "@/shared/constants";
import { HELION, type MapDef } from "@/shared/map/helion";
import { mulberry32 } from "@/shared/rng";
import type { RenderPlayer, RenderState } from "@/game/client/GameClient";
import type { PlayerMeta } from "@/game/store/gameStore";

export interface RenderMeta {
  playersMeta: Record<string, PlayerMeta>;
  myRole: "crewmate" | "impostor";
  mates: string[];
  highlightConsoleId: string | null;
  highlightVentId: string | null;
  meIsDead: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

const WALL_COLOR = "#101527";

/**
 * Canvas 2D renderer. Everything on screen is drawn procedurally — the
 * ship, the crewmates, fog of war and lighting — so the game ships with
 * zero bitmap assets.
 */
export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private fogCanvas: HTMLCanvasElement;
  private fogCtx: CanvasRenderingContext2D;
  private map: MapDef = HELION;
  private cam = { x: HELION.spawn.x, y: HELION.spawn.y };
  private stars: Array<{ x: number; y: number; r: number; tw: number }> = [];
  private particles: Particle[] = [];
  private width = 0;
  private height = 0;
  private dpr = 1;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D not supported");
    this.ctx = ctx;
    this.fogCanvas = document.createElement("canvas");
    const fogCtx = this.fogCanvas.getContext("2d");
    if (!fogCtx) throw new Error("Canvas 2D not supported");
    this.fogCtx = fogCtx;

    const rng = mulberry32(1337);
    for (let i = 0; i < 220; i++) {
      this.stars.push({
        x: rng() * (this.map.width + 1600) - 800,
        y: rng() * (this.map.height + 1200) - 600,
        r: rng() * 1.6 + 0.4,
        tw: rng() * Math.PI * 2,
      });
    }
  }

  resize(width: number, height: number, dpr: number): void {
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    this.canvas.width = Math.floor(width * dpr);
    this.canvas.height = Math.floor(height * dpr);
    this.fogCanvas.width = this.canvas.width;
    this.fogCanvas.height = this.canvas.height;
  }

  spawnBurst(x: number, y: number, color: string, count = 14): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 140;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: 0.5 + Math.random() * 0.5,
        color,
        size: 2 + Math.random() * 4,
      });
    }
  }

  render(state: RenderState, meta: RenderMeta, dt: number): void {
    const { ctx } = this;
    const time = performance.now() / 1000;
    const zoom = Math.max(0.62, Math.min(1.35, this.height / 820)) * this.dpr;

    // camera follows the local player with smoothing
    this.cam.x += (state.meX - this.cam.x) * Math.min(1, dt * 8);
    this.cam.y += (state.meY - this.cam.y) * Math.min(1, dt * 8);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#05070f";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const tx = this.canvas.width / 2 - this.cam.x * zoom;
    const ty = this.canvas.height / 2 - this.cam.y * zoom;
    ctx.setTransform(zoom, 0, 0, zoom, tx, ty);

    this.drawStars(time);
    this.drawShip(time, state, meta);
    this.drawBodies(state);
    this.drawPlayers(state, meta, time);
    this.updateParticles(dt);
    this.drawFog(state, zoom, tx, ty, time);
  }

  // -------------------------------------------------------------- backdrop

  private drawStars(time: number): void {
    const { ctx } = this;
    for (const star of this.stars) {
      const alpha = 0.35 + 0.3 * Math.sin(time * 0.8 + star.tw);
      ctx.fillStyle = `rgba(210, 225, 255, ${alpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // -------------------------------------------------------------- ship

  private drawShip(time: number, state: RenderState, meta: RenderMeta): void {
    const { ctx } = this;
    const floors = [
      ...this.map.rooms.map((r) => ({ rect: r.rect, tint: r.tint })),
      ...this.map.corridors.map((rect) => ({ rect, tint: "#232838" })),
    ];

    // hull pass: thick outline behind every floor rect forms the walls
    ctx.lineJoin = "round";
    for (const f of floors) {
      ctx.strokeStyle = WALL_COLOR;
      ctx.lineWidth = 26;
      ctx.strokeRect(f.rect.x, f.rect.y, f.rect.w, f.rect.h);
    }
    for (const f of floors) {
      ctx.strokeStyle = "#38405c";
      ctx.lineWidth = 10;
      ctx.strokeRect(f.rect.x, f.rect.y, f.rect.w, f.rect.h);
    }
    // floor fill pass covers interior seams
    for (const f of floors) {
      ctx.fillStyle = f.tint;
      ctx.fillRect(f.rect.x, f.rect.y, f.rect.w, f.rect.h);
    }
    // subtle floor plating
    ctx.strokeStyle = "rgba(255,255,255,0.03)";
    ctx.lineWidth = 1;
    for (const f of floors) {
      for (let gx = f.rect.x + 40; gx < f.rect.x + f.rect.w; gx += 40) {
        ctx.beginPath();
        ctx.moveTo(gx, f.rect.y);
        ctx.lineTo(gx, f.rect.y + f.rect.h);
        ctx.stroke();
      }
      for (let gy = f.rect.y + 40; gy < f.rect.y + f.rect.h; gy += 40) {
        ctx.beginPath();
        ctx.moveTo(f.rect.x, gy);
        ctx.lineTo(f.rect.x + f.rect.w, gy);
        ctx.stroke();
      }
    }

    // room labels
    ctx.font = "700 22px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    for (const room of this.map.rooms) {
      ctx.fillText(room.name.toUpperCase(), room.rect.x + room.rect.w / 2, room.rect.y + 30);
    }

    this.drawVents(meta, time);
    this.drawConsoles(meta, time);
    this.drawEmergencyButton(time);
    this.drawDoors(state);
  }

  private drawVents(meta: RenderMeta, time: number): void {
    const { ctx } = this;
    for (const vent of this.map.vents) {
      const highlighted = meta.highlightVentId === vent.id;
      ctx.save();
      ctx.translate(vent.x, vent.y);
      if (highlighted) {
        ctx.shadowColor = "#ffd166";
        ctx.shadowBlur = 14 + Math.sin(time * 6) * 5;
      }
      ctx.fillStyle = "#151a28";
      this.roundRect(-24, -16, 48, 32, 7);
      ctx.fill();
      ctx.strokeStyle = highlighted ? "#ffd166" : "#3d465e";
      ctx.lineWidth = 3;
      this.roundRect(-24, -16, 48, 32, 7);
      ctx.stroke();
      ctx.fillStyle = "#2a3145";
      for (let i = -1; i <= 1; i++) {
        this.roundRect(-17, i * 8 - 2.5, 34, 5, 2.5);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  private drawConsoles(meta: RenderMeta, time: number): void {
    const { ctx } = this;
    for (const c of this.map.consoles) {
      const highlighted = meta.highlightConsoleId === c.id;
      ctx.save();
      ctx.translate(c.x, c.y);
      if (highlighted) {
        ctx.shadowColor = "#7ce7ff";
        ctx.shadowBlur = 16 + Math.sin(time * 6) * 6;
      }
      const isDevice = c.kind === "admin" || c.kind === "cameras";
      const isFix = ["lights", "reactor", "o2", "comms"].includes(c.kind);
      ctx.fillStyle = isDevice ? "#20304a" : isFix ? "#3a2434" : "#26324a";
      this.roundRect(-18, -14, 36, 28, 6);
      ctx.fill();
      ctx.strokeStyle = highlighted ? "#7ce7ff" : "#46557a";
      ctx.lineWidth = 2.5;
      this.roundRect(-18, -14, 36, 28, 6);
      ctx.stroke();
      // screen glow
      ctx.fillStyle = highlighted ? "#9ff0ff" : isFix ? "#e2698a" : "#5fd3a8";
      this.roundRect(-12, -8, 24, 12, 3);
      ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      this.roundRect(-12, -8, 24, 5, 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawEmergencyButton(time: number): void {
    const { ctx } = this;
    const { x, y } = this.map.emergencyButton;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "#2b3247";
    ctx.beginPath();
    ctx.arc(0, 0, 58, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#414d6d";
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.fillStyle = "#1d2334";
    ctx.beginPath();
    ctx.arc(0, 0, 34, 0, Math.PI * 2);
    ctx.fill();
    const pulse = 0.75 + 0.25 * Math.sin(time * 3);
    ctx.fillStyle = `rgba(226, 67, 75, ${pulse.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.ellipse(-6, -7, 8, 5, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawDoors(state: RenderState): void {
    const { ctx } = this;
    for (const door of this.map.doors) {
      if (!state.closedDoors.has(door.id)) continue;
      const r = door.rect;
      ctx.fillStyle = "#39415e";
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = "#141927";
      ctx.lineWidth = 3;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = "#ffd166";
      ctx.lineWidth = 4;
      ctx.setLineDash([10, 8]);
      if (door.vertical) {
        ctx.beginPath();
        ctx.moveTo(r.x + r.w / 2, r.y + 4);
        ctx.lineTo(r.x + r.w / 2, r.y + r.h - 4);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(r.x + 4, r.y + r.h / 2);
        ctx.lineTo(r.x + r.w - 4, r.y + r.h / 2);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
  }

  // -------------------------------------------------------------- entities

  private drawBodies(state: RenderState): void {
    const { ctx } = this;
    for (const body of state.bodies) {
      ctx.save();
      ctx.translate(body.x, body.y + 6);
      const main = colorHex(body.color);
      const dark = colorDarkHex(body.color);
      // pooled shadow
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath();
      ctx.ellipse(0, 12, 26, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      // lying torso (half bean)
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.ellipse(0, 2, 22, 13, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = main;
      ctx.beginPath();
      ctx.ellipse(0, 0, 20, 12, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      // protruding bone
      ctx.fillStyle = "#e8ecf5";
      ctx.beginPath();
      ctx.rect(-3, -16, 6, 12);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-4, -17, 4.5, 0, Math.PI * 2);
      ctx.arc(4, -17, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawPlayers(state: RenderState, meta: RenderMeta, time: number): void {
    const sorted = [...state.players].sort((a, b) => a.y - b.y);
    for (const player of sorted) {
      if (player.inVent && !player.isMe) {
        // vented teammates peek out subtly for fellow impostors / ghosts
        this.drawVentedMarker(player, meta);
        continue;
      }
      if (player.inVent && player.isMe) {
        this.drawVentedMarker(player, meta);
        continue;
      }
      this.drawBean(player, meta, time);
    }
  }

  private drawVentedMarker(player: RenderPlayer, meta: RenderMeta): void {
    const { ctx } = this;
    const pMeta = meta.playersMeta[player.id];
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.translate(player.x, player.y - 6);
    ctx.fillStyle = pMeta ? colorHex(pMeta.color) : "#e2434b";
    ctx.beginPath();
    ctx.ellipse(0, 0, 13, 9, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#aee3f5";
    ctx.beginPath();
    ctx.ellipse(3, -2, 7, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawBean(player: RenderPlayer, meta: RenderMeta, time: number): void {
    const { ctx } = this;
    const pMeta = meta.playersMeta[player.id];
    const main = pMeta ? colorHex(pMeta.color) : "#e2434b";
    const dark = pMeta ? colorDarkHex(pMeta.color) : "#8f1e2b";
    const ghost = !player.alive;
    const walk = player.moving ? Math.sin(time * 11 + player.x * 0.01) : 0;
    const bob = ghost ? Math.sin(time * 2.2 + player.y * 0.02) * 4 : 0;

    ctx.save();
    ctx.translate(player.x, player.y + bob);
    if (ghost) ctx.globalAlpha = 0.55;
    if (!player.connected) ctx.globalAlpha = 0.35;
    if (player.facing < 0) ctx.scale(-1, 1);

    // shadow
    if (!ghost) {
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath();
      ctx.ellipse(0, PLAYER_RADIUS + 6, 15, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // legs (walk cycle)
    if (!ghost) {
      ctx.fillStyle = dark;
      const legSwing = walk * 6;
      this.roundRect(-11, 6 + legSwing * 0.4, 9, 14 - legSwing * 0.4, 4);
      ctx.fill();
      this.roundRect(2, 6 - legSwing * 0.4, 9, 14 + legSwing * 0.4, 4);
      ctx.fill();
    } else {
      // ghost tail
      ctx.fillStyle = main;
      ctx.beginPath();
      ctx.moveTo(-13, 6);
      for (let i = 0; i <= 4; i++) {
        const px = -13 + (i * 26) / 4;
        const py = 14 + Math.sin(time * 6 + i * 1.8) * 3;
        ctx.lineTo(px, py);
      }
      ctx.lineTo(13, 6);
      ctx.closePath();
      ctx.fill();
    }

    // backpack
    ctx.fillStyle = dark;
    this.roundRect(-21, -12, 10, 22, 5);
    ctx.fill();

    // body
    ctx.fillStyle = main;
    ctx.beginPath();
    ctx.moveTo(-13, 10);
    ctx.lineTo(-13, -8);
    ctx.quadraticCurveTo(-13, -22, 0, -22);
    ctx.quadraticCurveTo(14, -22, 14, -6);
    ctx.lineTo(14, 10);
    ctx.quadraticCurveTo(14, 15, 8, 15);
    ctx.lineTo(-7, 15);
    ctx.quadraticCurveTo(-13, 15, -13, 10);
    ctx.closePath();
    ctx.fill();
    // body shading
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.beginPath();
    ctx.moveTo(-13, 4);
    ctx.lineTo(14, 4);
    ctx.lineTo(14, 10);
    ctx.quadraticCurveTo(14, 15, 8, 15);
    ctx.lineTo(-7, 15);
    ctx.quadraticCurveTo(-13, 15, -13, 10);
    ctx.closePath();
    ctx.fill();

    // visor
    ctx.fillStyle = "#9fdcef";
    ctx.beginPath();
    ctx.ellipse(6, -10, 9.5, 6.5, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.beginPath();
    ctx.ellipse(3.5, -12, 4, 2.2, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(6, -10, 9.5, 6.5, -0.1, 0, Math.PI * 2);
    ctx.stroke();

    if (pMeta) this.drawHat(pMeta.hat, time);
    ctx.restore();

    // name tag (drawn unflipped)
    if (pMeta) {
      ctx.save();
      ctx.translate(player.x, player.y + bob);
      const isMateName =
        meta.myRole === "impostor" &&
        (meta.mates.includes(player.id) || (player.isMe && meta.myRole === "impostor"));
      ctx.font = "600 13px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(0,0,0,0.7)";
      ctx.strokeText(pMeta.name, 0, -34);
      ctx.fillStyle = isMateName ? "#ff5d68" : ghost ? "#9fb2d8" : "#f2f5fb";
      ctx.fillText(pMeta.name, 0, -34);
      ctx.restore();
    }
  }

  private drawHat(hat: HatId, time: number): void {
    const { ctx } = this;
    ctx.save();
    ctx.translate(2, -22);
    switch (hat) {
      case "halo": {
        ctx.strokeStyle = "#ffe08a";
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.ellipse(0, -8 + Math.sin(time * 2) * 1.5, 12, 4, 0, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case "antenna": {
        ctx.strokeStyle = "#c8d2e8";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -12);
        ctx.stroke();
        ctx.fillStyle = "#e2434b";
        ctx.beginPath();
        ctx.arc(0, -14, 4, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "tophat": {
        ctx.fillStyle = "#20242f";
        this.roundRect(-11, -4, 22, 5, 2);
        ctx.fill();
        this.roundRect(-7, -18, 14, 15, 2);
        ctx.fill();
        ctx.fillStyle = "#e2434b";
        ctx.fillRect(-7, -8, 14, 3);
        break;
      }
      case "beanie": {
        ctx.fillStyle = "#3151cb";
        ctx.beginPath();
        ctx.arc(0, -2, 11, Math.PI, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#e8ecf5";
        ctx.beginPath();
        ctx.arc(0, -12, 4, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "crown": {
        ctx.fillStyle = "#ffd166";
        ctx.beginPath();
        ctx.moveTo(-10, 0);
        ctx.lineTo(-10, -10);
        ctx.lineTo(-5, -4);
        ctx.lineTo(0, -12);
        ctx.lineTo(5, -4);
        ctx.lineTo(10, -10);
        ctx.lineTo(10, 0);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case "leaf": {
        ctx.strokeStyle = "#1a9160";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(2, -8, 0, -10);
        ctx.stroke();
        ctx.fillStyle = "#57ef3a";
        ctx.beginPath();
        ctx.ellipse(-4, -11, 6, 3.5, -0.5, 0, Math.PI * 2);
        ctx.ellipse(5, -12, 6, 3.5, 0.5, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "horns": {
        ctx.fillStyle = "#e2434b";
        ctx.beginPath();
        ctx.moveTo(-10, -1);
        ctx.quadraticCurveTo(-14, -12, -8, -14);
        ctx.quadraticCurveTo(-8, -7, -4, -3);
        ctx.closePath();
        ctx.moveTo(10, -1);
        ctx.quadraticCurveTo(14, -12, 8, -14);
        ctx.quadraticCurveTo(8, -7, 4, -3);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case "cap": {
        ctx.fillStyle = "#3151cb";
        ctx.beginPath();
        ctx.arc(0, -2, 11, Math.PI, Math.PI * 2);
        ctx.fill();
        this.roundRect(0, -4, 16, 4, 2);
        ctx.fill();
        break;
      }
      case "chef": {
        ctx.fillStyle = "#f2f5fb";
        this.roundRect(-9, -14, 18, 12, 3);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(-6, -14, 5, 0, Math.PI * 2);
        ctx.arc(0, -16, 6, 0, Math.PI * 2);
        ctx.arc(6, -14, 5, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "none":
      default:
        break;
    }
    ctx.restore();
  }

  // -------------------------------------------------------------- particles

  private updateParticles(dt: number): void {
    const { ctx } = this;
    this.particles = this.particles.filter((p) => p.life < p.maxLife);
    for (const p of this.particles) {
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
      const alpha = 1 - p.life / p.maxLife;
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha + 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // -------------------------------------------------------------- fog

  private drawFog(state: RenderState, zoom: number, tx: number, ty: number, time: number): void {
    const { ctx, fogCtx } = this;
    if (state.meAlive === false) {
      // ghosts see the whole ship — just a gentle vignette
      this.drawVignette(0.35);
      return;
    }
    fogCtx.setTransform(1, 0, 0, 1, 0, 0);
    fogCtx.globalCompositeOperation = "source-over";
    fogCtx.clearRect(0, 0, this.fogCanvas.width, this.fogCanvas.height);
    fogCtx.fillStyle = state.lightsOut ? "rgba(1, 2, 8, 0.985)" : "rgba(2, 5, 16, 0.93)";
    fogCtx.fillRect(0, 0, this.fogCanvas.width, this.fogCanvas.height);

    const px = state.meX * zoom + tx;
    const py = state.meY * zoom + ty;
    let radius = state.vision * zoom;
    if (state.lightsOut) {
      radius *= 1 + Math.sin(time * 13) * 0.03 + Math.sin(time * 31) * 0.02; // flicker
    }
    const gradient = fogCtx.createRadialGradient(px, py, radius * 0.45, px, py, radius);
    gradient.addColorStop(0, "rgba(0,0,0,1)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    fogCtx.globalCompositeOperation = "destination-out";
    fogCtx.fillStyle = gradient;
    fogCtx.beginPath();
    fogCtx.arc(px, py, radius, 0, Math.PI * 2);
    fogCtx.fill();

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.fogCanvas, 0, 0);
    this.drawVignette(0.5);
  }

  private drawVignette(strength: number): void {
    const { ctx } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const g = ctx.createRadialGradient(
      this.canvas.width / 2,
      this.canvas.height / 2,
      Math.min(this.canvas.width, this.canvas.height) * 0.35,
      this.canvas.width / 2,
      this.canvas.height / 2,
      Math.max(this.canvas.width, this.canvas.height) * 0.75,
    );
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, `rgba(0,0,0,${strength})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  // -------------------------------------------------------------- utils

  private roundRect(x: number, y: number, w: number, h: number, r: number): void {
    const { ctx } = this;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}
