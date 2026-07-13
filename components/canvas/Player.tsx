'use client';

/**
 * First-person player controller.
 *
 * Kinematic capsule driven through Rapier's character controller (autostep,
 * ground snap, slide), with acceleration/momentum, sprint stamina, crouch
 * (with collider resize), jump, vaulting, leaning with wall checks, head
 * bob, breathing, landing dips, camera sway, a shadow-casting flashlight
 * with battery + volumetric cone, physics prop grabbing/throwing, hiding,
 * material-based footsteps that feed the Keeper's hearing, and the death
 * camera.
 */

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { CapsuleCollider, RapierRigidBody, RigidBody, useRapier } from '@react-three/rapier';
import type { Collider, KinematicCharacterController } from '@dimforge/rapier3d-compat';
import { useGame, worldActive } from '@/game/state/gameStore';
import { useSettings, DIFFICULTY } from '@/game/state/settingsStore';
import { useHud } from '@/game/state/hudStore';
import { emitNoise, heatRoom, RT } from '@/game/state/runtime';
import { Input, consumeMouse, consumePressed } from '@/game/hooks/useInput';
import { AudioEngine } from '@/game/audio/engine';
import { clamp, clamp01, damp } from '@/game/utils/math';
import {
  floorIdAtY,
  isOutside,
  PLAYER_SPAWN,
  PLAYER_SPAWN_YAW,
  roomAt,
} from '@/game/levels/layout';
import { EXTERIOR } from '@/game/levels/layout';
import { makeConeMaterial } from '@/game/graphics/shaders';
import { qualityConfig } from '@/game/state/settingsStore';

const RADIUS = 0.28;
const STAND_HH = 0.59; // capsule half-height (cylinder part) → total 1.74
const CROUCH_HH = 0.17; // total 0.9 — fits through crawl vents
const EYE_STAND = 1.6;
const EYE_CROUCH = 0.78;
const WALK = 2.7;
const SPRINT = 4.35;
const CROUCH_SPEED = 1.3;
const JUMP_VEL = 5.1;
const GRAVITY = 15.5;

const STEP_SOUND: Record<string, string> = {
  wood: 'step_wood',
  darkwood: 'step_wood',
  tile: 'step_tile',
  concrete: 'step_concrete',
  asphalt: 'step_concrete',
  carpet: 'step_carpet',
  grass: 'step_grass',
};

export default function Player() {
  const bodyRef = useRef<RapierRigidBody>(null);
  const colliderRef = useRef<Collider>(null);
  const { world, rapier } = useRapier();
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;

  const ctrl = useRef<KinematicCharacterController | null>(null);
  const vel = useRef(new THREE.Vector3());
  const yaw = useRef(PLAYER_SPAWN_YAW);
  const pitch = useRef(0);
  const crouched = useRef(false);
  const stamina = useRef(100);
  const exhausted = useRef(false);
  const bobPhase = useRef(0);
  const landDip = useRef(0);
  const landDipVel = useRef(0);
  const lean = useRef(0);
  const rollSway = useRef(0);
  const wasGrounded = useRef(true);
  const strideAcc = useRef(0);
  const vaultT = useRef(-1);
  const vaultFrom = useRef(new THREE.Vector3());
  const vaultTo = useRef(new THREE.Vector3());
  const grabbed = useRef<import('@dimforge/rapier3d-compat').RigidBody | null>(null);
  const interactTimer = useRef(0);
  const vitalsTimer = useRef(0);
  const regenTimer = useRef(0);
  const lastDamageAt = useRef(-99);
  const fovCurrent = useRef(72);
  const flGroup = useRef<THREE.Group>(null);
  const flLight = useRef<THREE.SpotLight>(null);
  const flTarget = useRef<THREE.Object3D>(null);
  const flIntensity = useRef(0);
  const bestInteract = useRef<string | null>(null);
  const deathT = useRef(0);
  const climbT = useRef(-1);
  const climbFrom = useRef(new THREE.Vector3());
  const climbTo = useRef(new THREE.Vector3());

  const coneMat = useMemo(() => makeConeMaterial(), []);
  const quality = qualityConfig();

  // Spawn / load position.
  useEffect(() => {
    const g = useGame.getState();
    const save = g.pendingLoad;
    const spawn = save ? save.player.pos : PLAYER_SPAWN;
    const spawnYaw = save ? save.player.yaw : PLAYER_SPAWN_YAW;
    RT.player.pos.set(spawn[0], spawn[1], spawn[2]);
    yaw.current = spawnYaw;
    pitch.current = 0;
    stamina.current = save ? save.player.stamina : 100;
    const body = bodyRef.current;
    if (body) {
      body.setNextKinematicTranslation({
        x: spawn[0],
        y: spawn[1] + STAND_HH + RADIUS,
        z: spawn[2],
      });
    }
    camera.rotation.order = 'YXZ';
  }, [camera]);

  // Character controller lifecycle.
  useEffect(() => {
    const c = world.createCharacterController(0.06);
    c.enableAutostep(0.38, 0.12, true);
    c.enableSnapToGround(0.35);
    c.setMaxSlopeClimbAngle((58 * Math.PI) / 180);
    c.setMinSlopeSlideAngle((70 * Math.PI) / 180);
    c.setApplyImpulsesToDynamicBodies(true);
    c.setSlideEnabled(true);
    ctrl.current = c;
    return () => {
      world.removeCharacterController(c);
      ctrl.current = null;
    };
  }, [world]);

  useEffect(() => {
    if (window.location.search.includes('debug')) {
      // QA hook (see GameCanvas): expose physics internals for the soak test.
      (window as unknown as Record<string, unknown>).__hmPhysics = {
        world,
        rapier,
        body: bodyRef,
        collider: colliderRef,
        ctrl,
        vel,
      };
    }
  }, [world, rapier]);

  const tmpV = useMemo(() => new THREE.Vector3(), []);
  const tmpV2 = useMemo(() => new THREE.Vector3(), []);
  const fwd = useMemo(() => new THREE.Vector3(), []);
  const right = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    const g = useGame.getState();
    const settings = useSettings.getState();
    const body = bodyRef.current;
    const collider = colliderRef.current;
    const controller = ctrl.current;
    if (!body || !collider || !controller) return;

    const p = RT.player;

    /* ---------- death camera ---------- */
    if (g.phase === 'dead') {
      deathT.current += dt;
      const t = clamp01(deathT.current * 1.6);
      const eye = tmpV.set(p.pos.x, p.pos.y + EYE_STAND - t * 0.7, p.pos.z);
      camera.position.lerp(eye, 0.4);
      const face = tmpV2.copy(RT.enemy.pos).setY(RT.enemy.pos.y + 1.95);
      camera.lookAt(face);
      camera.rotation.z = Math.sin(deathT.current * 40) * 0.02 * (1 - t);
      return;
    }
    deathT.current = 0;

    const active = worldActive();
    // While paused / intro / overlays the physics world is not stepping —
    // integrating gravity against a frozen collider would desync and sink
    // the capsule, so the whole player sim freezes with it.
    if (!active) {
      consumeMouse();
      const dbgIdle = (window as unknown as Record<string, any>).__hmPhysics;
      if (dbgIdle) dbgIdle.lastState = 'inactive';
      return;
    }

    /* ---------- mouse look ---------- */
    if (active && Input.pointerLocked && !p.dead) {
      const [dx, dy] = consumeMouse();
      const sens = settings.sensitivity * 0.0021;
      yaw.current -= dx * sens;
      pitch.current = clamp(pitch.current + dy * sens * (settings.invertY ? 1 : -1), -1.45, 1.45);
      rollSway.current = damp(rollSway.current, clamp(-dx * 0.0016, -0.05, 0.05), 9, dt);
    } else {
      consumeMouse();
      rollSway.current = damp(rollSway.current, 0, 9, dt);
    }

    // forward = -Z at yaw 0
    fwd.set(-Math.sin(yaw.current), 0, -Math.cos(yaw.current));
    right.set(-fwd.z, 0, fwd.x);

    /* ---------- hidden state ---------- */
    if (p.hidden) {
      p.holdingBreath = active && Input.keys.has('ShiftLeft');
      camera.position.lerp(p.hidden.eye, 1 - Math.exp(-6 * dt));
      camera.rotation.set(pitch.current * 0.4, yaw.current, 0);
      // breathing noise if the Keeper is near and you're not holding it
      if (!p.holdingBreath && RT.enemy.pos.distanceTo(p.pos) < 3.2 && Math.random() < dt * 0.5) {
        emitNoise(p.pos.x, p.pos.y + 1, p.pos.z, 0.12, 'breath');
      }
      if (active && (consumePressed('Mouse0') || consumePressed('KeyF'))) {
        // exit hiding
        const exit = p.hidden.exit;
        p.pos.copy(exit);
        body.setNextKinematicTranslation({
          x: exit.x,
          y: exit.y + STAND_HH + RADIUS,
          z: exit.z,
        });
        p.hidden = null;
        AudioEngine.play3d('wardrobe_door', exit, { volume: 0.7 });
        emitNoise(exit.x, exit.y + 1, exit.z, 0.3, 'door');
      }
      useHud.getState().setHidden(true, p.holdingBreath);
      syncVitals(dt);
      updateFlashlight(state.clock.elapsedTime, dt, true);
      return;
    }
    useHud.getState().setHidden(false, false);
    p.holdingBreath = false;

    /* ---------- scripted ladder climb ---------- */
    if (climbT.current >= 0) {
      climbT.current += dt / 1.15;
      const t = clamp01(climbT.current);
      const e = t * t * (3 - 2 * t);
      p.pos.lerpVectors(climbFrom.current, climbTo.current, e);
      body.setNextKinematicTranslation({
        x: p.pos.x,
        y: p.pos.y + STAND_HH + RADIUS,
        z: p.pos.z,
      });
      if (t >= 1) climbT.current = -1;
      placeCamera(state.clock.elapsedTime, dt, 0);
      syncVitals(dt);
      updateFlashlight(state.clock.elapsedTime, dt, false);
      return;
    }
    if (RT.pendingClimb) {
      climbFrom.current.copy(RT.pendingClimb.from);
      climbTo.current.copy(RT.pendingClimb.to);
      climbT.current = 0;
      RT.pendingClimb = null;
      AudioEngine.play('ladder', { volume: 0.8 });
    }

    /* ---------- stance ---------- */
    const wantCrouch = active && (Input.keys.has('ControlLeft') || Input.keys.has('KeyC'));
    if (wantCrouch !== crouched.current) {
      if (wantCrouch) {
        crouched.current = true;
        collider.setHalfHeight(CROUCH_HH);
      } else {
        // Only stand if there's headroom.
        const origin = {
          x: p.pos.x,
          y: p.pos.y + CROUCH_HH * 2 + RADIUS * 2 + 0.05,
          z: p.pos.z,
        };
        const ray = new rapier.Ray(origin, { x: 0, y: 1, z: 0 });
        const hit = world.castRay(ray, 1.74 - 0.9, true, undefined, undefined, collider, body);
        if (!hit) {
          crouched.current = false;
          collider.setHalfHeight(STAND_HH);
        }
      }
    }
    p.crouched = crouched.current;

    /* ---------- movement intent ---------- */
    const keys = Input.keys;
    let ix = 0;
    let iz = 0;
    if (active) {
      if (keys.has('KeyW')) iz += 1;
      if (keys.has('KeyS')) iz -= 1;
      if (keys.has('KeyA')) ix -= 1;
      if (keys.has('KeyD')) ix += 1;
    }
    const wish = tmpV.set(0, 0, 0);
    if (ix !== 0 || iz !== 0) {
      wish.addScaledVector(fwd, iz).addScaledVector(right, ix).normalize();
    }
    const moving = wish.lengthSq() > 0;

    const wantSprint =
      active &&
      keys.has('ShiftLeft') &&
      moving &&
      iz > 0 &&
      !crouched.current &&
      !exhausted.current;
    if (wantSprint) {
      stamina.current = Math.max(0, stamina.current - 16 * dt);
      if (stamina.current <= 0.5) {
        exhausted.current = true;
        AudioEngine.play('gasp', { volume: 0.7 });
      }
    } else {
      stamina.current = Math.min(100, stamina.current + (moving ? 8 : 13) * dt);
      if (exhausted.current && stamina.current > 28) exhausted.current = false;
    }
    p.sprinting = wantSprint;

    const maxSpeed = crouched.current ? CROUCH_SPEED : wantSprint ? SPRINT : WALK;

    /* ---------- horizontal dynamics ---------- */
    const grounded = wasGrounded.current;
    const accel = grounded ? 30 : 5;
    const v = vel.current;
    if (moving) {
      v.x += wish.x * accel * dt;
      v.z += wish.z * accel * dt;
    }
    const hSpeed = Math.hypot(v.x, v.z);
    if (hSpeed > maxSpeed) {
      const f = grounded ? Math.max(maxSpeed / hSpeed, 1 - 6 * dt) : maxSpeed / hSpeed;
      v.x *= f;
      v.z *= f;
    }
    if (!moving && grounded) {
      const f = Math.max(0, 1 - 11 * dt);
      v.x *= f;
      v.z *= f;
    }

    /* ---------- jump & vault ---------- */
    if (active && consumePressed('Space') && vaultT.current < 0) {
      if (grounded && !crouched.current) {
        // Vault check: waist-high obstacle ahead, headroom clear.
        const eyeO = { x: p.pos.x, y: p.pos.y + 0.55, z: p.pos.z };
        const dir = { x: fwd.x, y: 0, z: fwd.z };
        const low = world.castRay(
          new rapier.Ray(eyeO, dir),
          1.05,
          true,
          undefined,
          undefined,
          collider,
          body
        );
        const highO = { x: p.pos.x, y: p.pos.y + 1.45, z: p.pos.z };
        const high = world.castRay(
          new rapier.Ray(highO, dir),
          1.5,
          true,
          undefined,
          undefined,
          collider,
          body
        );
        if (low && !high) {
          vaultT.current = 0;
          vaultFrom.current.copy(p.pos);
          vaultTo.current
            .copy(p.pos)
            .addScaledVector(fwd, 1.25)
            .setY(p.pos.y + 1.02);
          AudioEngine.play('cloth', { volume: 0.8 });
          emitNoise(p.pos.x, p.pos.y + 1, p.pos.z, 0.4, 'impact');
        } else {
          v.y = JUMP_VEL;
          wasGrounded.current = false;
          emitNoise(p.pos.x, p.pos.y, p.pos.z, 0.3, 'footstep');
        }
      }
    }

    if (vaultT.current >= 0) {
      vaultT.current += dt / 0.55;
      const t = clamp01(vaultT.current);
      const e = t * t * (3 - 2 * t);
      const arc = Math.sin(t * Math.PI) * 0.32;
      p.pos.lerpVectors(vaultFrom.current, vaultTo.current, e);
      p.pos.y += arc;
      body.setNextKinematicTranslation({
        x: p.pos.x,
        y: p.pos.y + (crouched.current ? CROUCH_HH : STAND_HH) + RADIUS,
        z: p.pos.z,
      });
      if (t >= 1) {
        vaultT.current = -1;
        v.set(fwd.x * 1.5, 0, fwd.z * 1.5);
      }
      placeCamera(state.clock.elapsedTime, dt, hSpeed);
      syncVitals(dt);
      updateFlashlight(state.clock.elapsedTime, dt, false);
      return;
    }

    /* ---------- gravity + character controller ---------- */
    const vyBefore = v.y;
    v.y = Math.max(v.y - GRAVITY * dt, -14); // terminal velocity
    const desired = { x: v.x * dt, y: v.y * dt, z: v.z * dt };
    controller.computeColliderMovement(collider, desired, undefined, undefined, (c) => {
      // Ignore our own capsule and any sensor volumes.
      return c !== collider && !c.isSensor();
    });
    const corrected = controller.computedMovement();
    const nowGrounded = controller.computedGrounded();
    const dbg = (window as unknown as Record<string, any>).__hmPhysics;
    if (dbg) {
      dbg.lastState = 'active';
      dbg.frame = (dbg.frame ?? 0) + 1;
      dbg.keys = Array.from(Input.keys);
      dbg.lastDesired = { ...desired };
      dbg.lastCorrected = { x: corrected.x, y: corrected.y, z: corrected.z };
      dbg.grounded = nowGrounded;
    }

    p.pos.x += corrected.x;
    p.pos.y += corrected.y;
    p.pos.z += corrected.z;
    body.setNextKinematicTranslation({
      x: p.pos.x,
      y: p.pos.y + (crouched.current ? CROUCH_HH : STAND_HH) + RADIUS,
      z: p.pos.z,
    });

    if (nowGrounded && !wasGrounded.current) {
      const impact = -vyBefore;
      if (impact > 9) {
        AudioEngine.play('land_hard', { volume: 1 });
        g.damage(Math.min(55, (impact - 9) * 11));
        AudioEngine.play('hurt', { volume: 0.8 });
        landDipVel.current = -3.2;
        emitNoise(p.pos.x, p.pos.y, p.pos.z, 1.0, 'impact');
      } else if (impact > 4.2) {
        AudioEngine.play('land_soft', { volume: 0.9 });
        landDipVel.current = -2.1;
        emitNoise(p.pos.x, p.pos.y, p.pos.z, 0.55, 'impact');
      } else if (impact > 1.5) {
        landDipVel.current = -1.0;
        emitNoise(p.pos.x, p.pos.y, p.pos.z, 0.2, 'footstep');
      }
      v.y = 0;
    }
    if (nowGrounded) v.y = Math.max(v.y, -0.5);
    wasGrounded.current = nowGrounded;
    p.onGround = nowGrounded;

    /* ---------- lean ---------- */
    const leanTarget = active ? (keys.has('KeyQ') ? -1 : keys.has('KeyE') ? 1 : 0) : 0;
    let allowedLean = leanTarget;
    if (leanTarget !== 0) {
      const o = { x: p.pos.x, y: p.pos.y + 1.4, z: p.pos.z };
      const d = { x: right.x * leanTarget, y: 0, z: right.z * leanTarget };
      const hit = world.castRay(
        new rapier.Ray(o, d),
        0.6,
        true,
        undefined,
        undefined,
        collider,
        body
      );
      if (hit) allowedLean = leanTarget * clamp01((hit.timeOfImpact - 0.18) / 0.42);
    }
    lean.current = damp(lean.current, allowedLean, 8, dt);
    RT.player.leaning = lean.current;

    /* ---------- footsteps ---------- */
    const speed2d = Math.hypot(v.x, v.z);
    p.speed2d = speed2d;
    if (nowGrounded && speed2d > 0.4) {
      strideAcc.current += speed2d * dt;
      const stride = crouched.current ? 1.15 : wantSprint ? 2.15 : 1.6;
      if (strideAcc.current >= stride) {
        strideAcc.current = 0;
        stepSound(wantSprint, crouched.current);
      }
    } else {
      strideAcc.current = Math.min(strideAcc.current, 0.6);
    }

    /* ---------- world context ---------- */
    p.floor = floorIdAtY(p.pos.y + 0.2);
    const room = roomAt(p.floor, p.pos.x, p.pos.z);
    p.roomId = room?.id ?? null;
    heatRoom(p.roomId, dt);
    const gr = EXTERIOR.garageRoof;
    p.onRoof =
      p.pos.y > 2.5 &&
      p.pos.x > gr.x0 - 0.5 &&
      p.pos.x < gr.x1 + 0.5 &&
      p.pos.z > gr.z0 - 0.5 &&
      p.pos.z < gr.z1 + 0.5;

    /* ---------- interaction ---------- */
    interactTimer.current -= dt;
    if (interactTimer.current <= 0) {
      interactTimer.current = 0.1;
      scanInteractables();
    }
    if (active && consumePressed('Mouse0')) {
      if (grabbed.current) {
        throwGrabbed();
      } else if (bestInteract.current) {
        const it = RT.interactables.get(bestInteract.current);
        it?.action();
        interactTimer.current = 0;
      }
    }
    if (active && consumePressed('KeyG') && grabbed.current) throwGrabbed();
    if (active && consumePressed('Mouse2')) {
      if (grabbed.current) {
        dropGrabbed();
      } else {
        tryGrab();
      }
    }
    updateGrabbed(dt);

    /* ---------- flashlight toggle & battery ---------- */
    if (active && consumePressed('KeyF')) {
      if (!p.flashlightOn && g.battery <= 0.5 && !g.useBattery()) {
        AudioEngine.play('switch_click', { volume: 0.6 });
        useHud.getState().toast('The flashlight is dead.');
      } else {
        p.flashlightOn = !p.flashlightOn;
        AudioEngine.play('switch_click', { volume: 0.8 });
      }
    }
    if (p.flashlightOn && active) {
      const drainScale = DIFFICULTY[g.difficulty].batteryDrainScale;
      const nb = Math.max(0, g.battery - (100 / 280) * drainScale * dt);
      if (nb <= 0) {
        if (g.useBattery()) {
          // fresh cell swapped in automatically
        } else {
          useGame.setState({ battery: 0 });
          p.flashlightOn = false;
          AudioEngine.play('switch_click', { volume: 0.7 });
          useHud.getState().toast('The flashlight dies.');
        }
      } else {
        useGame.setState({ battery: nb });
      }
    }

    /* ---------- health regen ---------- */
    regenTimer.current += dt;
    if (g.health > 0 && g.health < 35 && state.clock.elapsedTime - lastDamageAt.current > 8) {
      if (regenTimer.current > 0.5) {
        regenTimer.current = 0;
        useGame.setState({ health: Math.min(35, g.health + 0.7) });
      }
    }

    /* ---------- camera ---------- */
    placeCamera(state.clock.elapsedTime, dt, speed2d);
    updateFlashlight(state.clock.elapsedTime, dt, false);
    syncVitals(dt);

    /* ---------- fell off the world safety net ---------- */
    if (p.pos.y < -20) {
      p.pos.set(PLAYER_SPAWN[0], PLAYER_SPAWN[1], PLAYER_SPAWN[2]);
      v.set(0, 0, 0);
    }
  });

  /* =================================================================== */

  function stepSound(sprinting: boolean, crouchedNow: boolean): void {
    const p = RT.player;
    const g = useGame.getState();
    const outside = isOutside(p.pos.x, p.pos.z) && p.floor === 'ground' && !p.onRoof;
    let mat = 'wood';
    const room = p.roomId ? roomAt(p.floor, p.pos.x, p.pos.z) : null;
    if (outside) {
      const dw = EXTERIOR.driveway;
      const onDrive = p.pos.x > dw.x0 && p.pos.x < dw.x1 && p.pos.z > dw.z0 && p.pos.z < dw.z1;
      mat = onDrive ? 'asphalt' : 'grass';
      if (RT.weather.rain > 0.35) mat = 'wet';
    } else if (p.onRoof) {
      mat = 'concrete';
    } else if (room) {
      mat = room.floorMat;
    }
    const sound = mat === 'wet' ? 'step_wet' : (STEP_SOUND[mat] ?? 'step_wood');
    const vol = crouchedNow ? 0.32 : sprinting ? 1 : 0.62;
    AudioEngine.play(sound, { volume: vol, rate: 0.92 + Math.random() * 0.18 });
    const loudness = (crouchedNow ? 0.08 : sprinting ? 0.8 : 0.32) * (mat === 'carpet' ? 0.5 : 1);
    emitNoise(p.pos.x, p.pos.y, p.pos.z, loudness, 'footstep');
    // Creaky boards upstairs can betray you even when sneaking.
    if (room?.creaky && Math.random() < (crouchedNow ? 0.06 : 0.16)) {
      AudioEngine.play('creak_floor', { volume: 0.55, rate: 0.85 + Math.random() * 0.3 });
      emitNoise(p.pos.x, p.pos.y, p.pos.z, 0.42, 'creak');
    }
    if (g.phase === 'playing' && !g.flags.keeperAwake && sprinting) {
      // Sprinting indoors hastens the awakening…
      if (!isOutside(p.pos.x, p.pos.z)) emitNoise(p.pos.x, p.pos.y, p.pos.z, 0.9, 'footstep');
    }
  }

  function scanInteractables(): void {
    const p = RT.player;
    const eye = tmpV.set(p.pos.x, p.pos.y + (p.crouched ? EYE_CROUCH : EYE_STAND), p.pos.z);
    const dir = tmpV2.set(
      -Math.sin(yaw.current) * Math.cos(pitch.current),
      Math.sin(pitch.current),
      -Math.cos(yaw.current) * Math.cos(pitch.current)
    );
    let best: string | null = null;
    let bestScore = 0;
    for (const it of RT.interactables.values()) {
      if (it.enabled && !it.enabled()) continue;
      const to = it.pos.clone().sub(eye);
      const dist = to.length();
      if (dist > it.radius + 0.6) continue;
      const dot = to.normalize().dot(dir);
      if (dist > 0.85 && dot < 0.72) continue;
      const score = (dot + 0.4) / (dist + 0.4) + (it.priority ?? 0) * 0.35;
      if (score > bestScore) {
        bestScore = score;
        best = it.id;
      }
    }
    bestInteract.current = best;
    const hud = useHud.getState();
    if (grabbed.current) {
      hud.setPrompt('Throw · right-click to set down');
    } else if (best) {
      const it = RT.interactables.get(best)!;
      hud.setPrompt(typeof it.prompt === 'function' ? it.prompt() : it.prompt);
    } else {
      hud.setPrompt(null);
    }
  }

  function tryGrab(): void {
    const p = RT.player;
    const eye = tmpV.set(p.pos.x, p.pos.y + (p.crouched ? EYE_CROUCH : EYE_STAND), p.pos.z);
    const dir = tmpV2.set(
      -Math.sin(yaw.current) * Math.cos(pitch.current),
      Math.sin(pitch.current),
      -Math.cos(yaw.current) * Math.cos(pitch.current)
    );
    const hit = world.castRay(
      new rapier.Ray({ x: eye.x, y: eye.y, z: eye.z }, { x: dir.x, y: dir.y, z: dir.z }),
      2.4,
      true,
      undefined,
      undefined,
      colliderRef.current ?? undefined,
      bodyRef.current ?? undefined
    );
    if (!hit) return;
    const other = hit.collider.parent();
    if (!other) return;
    const ud = other.userData as { kind?: string; propId?: string } | undefined;
    if (ud?.kind !== 'prop') return;
    grabbed.current = other;
    RT.player.grabbedProp = ud.propId ?? 'prop';
    other.setGravityScale(0.05, true);
    AudioEngine.play('cloth', { volume: 0.6 });
  }

  function updateGrabbed(_dt: number): void {
    const b = grabbed.current;
    if (!b) return;
    const p = RT.player;
    const eye = tmpV.set(p.pos.x, p.pos.y + (p.crouched ? EYE_CROUCH : EYE_STAND), p.pos.z);
    const dir = tmpV2.set(
      -Math.sin(yaw.current) * Math.cos(pitch.current),
      Math.sin(pitch.current),
      -Math.cos(yaw.current) * Math.cos(pitch.current)
    );
    const target = eye.addScaledVector(dir, 1.35);
    const bp = b.translation();
    const dx = target.x - bp.x;
    const dy = target.y - bp.y;
    const dz = target.z - bp.z;
    const dist = Math.hypot(dx, dy, dz);
    if (dist > 3) {
      dropGrabbed();
      return;
    }
    const k = 11;
    const max = 9;
    let vx = dx * k;
    let vy = dy * k;
    let vz = dz * k;
    const sp = Math.hypot(vx, vy, vz);
    if (sp > max) {
      vx = (vx / sp) * max;
      vy = (vy / sp) * max;
      vz = (vz / sp) * max;
    }
    b.setLinvel({ x: vx, y: vy, z: vz }, true);
    b.setAngvel({ x: 0, y: 0.4, z: 0 }, true);
  }

  function dropGrabbed(): void {
    const b = grabbed.current;
    if (!b) return;
    b.setGravityScale(1, true);
    grabbed.current = null;
    RT.player.grabbedProp = null;
  }

  function throwGrabbed(): void {
    const b = grabbed.current;
    if (!b) return;
    const dir = tmpV2.set(
      -Math.sin(yaw.current) * Math.cos(pitch.current),
      Math.sin(pitch.current) + 0.12,
      -Math.cos(yaw.current) * Math.cos(pitch.current)
    );
    b.setGravityScale(1, true);
    b.setLinvel(
      { x: dir.x * 10 + vel.current.x, y: dir.y * 10, z: dir.z * 10 + vel.current.z },
      true
    );
    grabbed.current = null;
    RT.player.grabbedProp = null;
    AudioEngine.play('whoosh', { volume: 0.8 });
  }

  function placeCamera(time: number, dt: number, speed2d: number): void {
    const p = RT.player;
    const settings = useSettings.getState();
    const eyeBase = p.crouched ? EYE_CROUCH : EYE_STAND;

    // landing dip spring
    landDipVel.current += -landDip.current * 90 * dt - landDipVel.current * 10 * dt;
    landDip.current += landDipVel.current * dt;

    // head bob
    const bobAmp = settings.headBob;
    if (p.onGround && speed2d > 0.4) {
      bobPhase.current += speed2d * dt * (p.crouched ? 1.5 : 1.18);
    }
    const speedF = clamp01(speed2d / 4);
    const bobY = Math.sin(bobPhase.current * 2) * 0.042 * speedF * bobAmp;
    const bobX = Math.sin(bobPhase.current) * 0.03 * speedF * bobAmp;
    // idle breathing
    const lowStamina = stamina.current < 30 ? 1.6 : 1;
    const breath = Math.sin(time * (1.7 * lowStamina)) * 0.006 * (1 + (lowStamina - 1)) * bobAmp;

    right.set(Math.cos(yaw.current), 0, -Math.sin(yaw.current));
    const shake = RT.shake;
    RT.shake = Math.max(0, RT.shake - dt * 2.2);

    camera.position.set(
      p.pos.x + right.x * (bobX + lean.current * 0.4),
      p.pos.y + eyeBase + bobY + breath + landDip.current * 0.12 - Math.abs(lean.current) * 0.06,
      p.pos.z + right.z * (bobX + lean.current * 0.4)
    );
    if (shake > 0.01) {
      camera.position.x += (Math.random() - 0.5) * shake * 0.06;
      camera.position.y += (Math.random() - 0.5) * shake * 0.05;
      camera.position.z += (Math.random() - 0.5) * shake * 0.06;
    }
    camera.rotation.set(
      pitch.current + landDip.current * 0.05,
      yaw.current,
      -lean.current * 0.13 + rollSway.current + Math.sin(bobPhase.current) * 0.004 * speedF
    );

    // FOV: sprint stretch
    const targetFov = settings.fov + (p.sprinting ? 6 : 0);
    fovCurrent.current = damp(fovCurrent.current, targetFov, 6, dt);
    if (Math.abs(camera.fov - fovCurrent.current) > 0.01) {
      camera.fov = fovCurrent.current;
      camera.updateProjectionMatrix();
    }

    p.yaw = yaw.current;
    p.pitch = pitch.current;
  }

  function updateFlashlight(time: number, dt: number, hidden: boolean): void {
    const p = RT.player;
    const group = flGroup.current;
    const light = flLight.current;
    const target = flTarget.current;
    if (!group || !light || !target) return;
    const g = useGame.getState();

    // Lag the torch behind the camera for weight.
    group.position.lerp(
      tmpV
        .copy(camera.position)
        .addScaledVector(right, 0.22)
        .add(tmpV2.set(0, -0.22, 0)),
      1 - Math.exp(-14 * dt)
    );
    group.quaternion.slerp(camera.quaternion, 1 - Math.exp(-11 * dt));

    let on = p.flashlightOn && !hidden ? 1 : 0;
    if (on > 0) {
      // battery flicker + the Keeper's interference
      if (g.battery < 16 && Math.random() < 0.09) on *= Math.random() * 0.5;
      const keeperDist = RT.enemy.pos.distanceTo(p.pos);
      if (RT.enemy.active && keeperDist < 7 && Math.random() < 0.16) {
        on *= 0.2 + Math.random() * 0.6;
      }
    }
    flIntensity.current = damp(flIntensity.current, on, 22, dt);
    light.intensity = flIntensity.current * 34;
    light.visible = flIntensity.current > 0.02;
    coneMat.uniforms.uIntensity.value = qualityConfig().volumetrics ? flIntensity.current : 0;

    // Push the light target forward in world space.
    const dir = tmpV2.set(0, 0, -1).applyQuaternion(group.quaternion);
    target.position.copy(group.position).addScaledVector(dir, 10);
    light.target = target;
    p.flashlightDir.copy(dir);
  }

  function syncVitals(dt: number): void {
    const g = useGame.getState();
    vitalsTimer.current -= dt;
    if (vitalsTimer.current > 0) return;
    vitalsTimer.current = 0.12;
    const p = RT.player;
    const dist = RT.enemy.pos.distanceTo(p.pos);
    const dread = RT.enemy.active
      ? clamp01(RT.enemy.awareness * 0.65 + clamp01(1 - dist / 14) * 0.55)
      : 0;
    if (g.health !== Math.round(g.health)) {
      // keep store tidy
    }
    if (g.stamina !== stamina.current) useGame.setState({ stamina: stamina.current });
    useHud.getState().setVitals({
      health: g.health / 100,
      stamina: stamina.current / 100,
      battery: g.battery / 100,
      dread,
    });
  }

  // Track damage time for regen gating.
  useEffect(() => {
    const unsub = useGame.subscribe((s, prev) => {
      if (s.health < prev.health) {
        lastDamageAt.current = performance.now() / 1000;
        AudioEngine.play('hurt', { volume: 0.75 });
      }
    });
    return unsub;
  }, []);

  return (
    <>
      <RigidBody
        ref={bodyRef}
        type="kinematicPosition"
        colliders={false}
        position={[PLAYER_SPAWN[0], PLAYER_SPAWN[1] + STAND_HH + RADIUS, PLAYER_SPAWN[2]]}
        userData={{ kind: 'player' }}
      >
        <CapsuleCollider ref={colliderRef} args={[STAND_HH, RADIUS]} />
      </RigidBody>
      {/* Flashlight rig (world-space, lags the camera). */}
      <group ref={flGroup}>
        <mesh position={[0, 0, -0.18]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.035, 0.045, 0.24, 10]} />
          <meshStandardMaterial color="#2b2d30" roughness={0.5} metalness={0.6} />
        </mesh>
        <spotLight
          ref={flLight}
          angle={0.46}
          penumbra={0.55}
          distance={30}
          decay={1.6}
          color="#ffe6b8"
          castShadow={quality.shadows}
          shadow-mapSize-width={quality.shadowMapSize}
          shadow-mapSize-height={quality.shadowMapSize}
          shadow-bias={-0.002}
          shadow-camera-near={0.3}
          shadow-camera-far={30}
        />
        {/* volumetric cone */}
        <mesh
          position={[0, 0, -3.3]}
          rotation={[Math.PI / 2, 0, 0]}
          material={coneMat}
          renderOrder={50}
        >
          <coneGeometry args={[1.6, 6.4, 24, 1, true]} />
        </mesh>
      </group>
      <object3D ref={flTarget} />
    </>
  );
}
