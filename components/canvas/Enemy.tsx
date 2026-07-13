'use client';

/**
 * The Keeper — the thing that walks Hollowmoor's rounds.
 *
 * This component is the body: a gaunt procedurally-built figure with a
 * procedural walk cycle, driven by the KeeperBrain (see game/ai/brain.ts).
 * The body supplies the brain's senses — a vision cone with occlusion
 * raycasts through Rapier (closed doors genuinely block sight), light-level
 * modifiers, crouch concealment — and carries out its outputs: pathfinding
 * walks (never teleports), door opening/breaking, hide-spot checks, drag-outs
 * and attacks.
 */

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { CapsuleCollider, RapierRigidBody, RigidBody, useRapier } from '@react-three/rapier';
import { KeeperBrain } from '@/game/ai/brain';
import { getNavGrid } from '@/game/ai/navgrid';
import { ENEMY_SPAWN, HIDE_SPOTS, isOutside } from '@/game/levels/layout';
import { useGame, worldActive } from '@/game/state/gameStore';
import { DIFFICULTY } from '@/game/state/settingsStore';
import { RT } from '@/game/state/runtime';
import { AudioEngine } from '@/game/audio/engine';
import { RNG } from '@/game/utils/rng';
import { clamp01, damp, dampAngle } from '@/game/utils/math';
import { FLOOR_Y, FloorId } from '@/game/types';
import { MAT } from '@/game/graphics/materials';
import { useHud } from '@/game/state/hudStore';
import { DOOR_BY_ID } from '@/game/levels/layout';

const CAP_HH = 0.72;
const CAP_R = 0.32;

export default function Enemy() {
  const bodyRef = useRef<RapierRigidBody>(null);
  const modelRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const eyeMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#1a0c08',
        emissive: new THREE.Color('#ff8840'),
        emissiveIntensity: 0.3,
      }),
    []
  );
  const { world, rapier } = useRapier();

  const yawRef = useRef(0);
  const walkPhase = useRef(0);
  const strideAcc = useRef(0);
  const tickAcc = useRef(0);
  const graceLeft = useRef(0);
  const lastOut = useRef<ReturnType<KeeperBrain['tick']> | null>(null);
  const eyeGlow = useRef(0.3);

  const brain = useMemo(() => {
    const g = useGame.getState();
    const rng = new RNG(g.seed).fork('keeper');
    const b = new KeeperBrain(getNavGrid(), rng, g.difficulty, {
      doorInfo: (id) => {
        const st = useGame.getState().doors[id];
        const def = DOOR_BY_ID[id];
        if (!st || !def)
          return { exists: false, open: true, locked: false, broken: false, breakable: false };
        return {
          exists: true,
          open: st.open,
          locked: st.locked,
          broken: st.broken,
          breakable: !!def.breakable,
        };
      },
      secretOpen: (id) => {
        const f = useGame.getState().flags;
        return id === 'secret_bookcase'
          ? f.bookcaseOpen
          : id === 'secret_shelf'
            ? f.shelfMoved
            : false;
      },
      requestDoor: (id, action) => {
        RT.enemy.doorRequests.push({ id, action });
      },
      cue: (sound) => {
        const pos = RT.enemy.pos;
        if (sound === 'scream') {
          AudioEngine.play3d('keeper_scream', pos, { volume: 1, refDistance: 4, maxDistance: 70 });
          AudioEngine.play('stinger', { volume: 0.8 });
        } else if (sound === 'alert') {
          AudioEngine.play3d('keeper_alert', pos, { volume: 0.9, refDistance: 3 });
        } else {
          AudioEngine.play3d('keeper_alert', pos, { volume: 0.6, rate: 0.7, refDistance: 3 });
        }
      },
      dragOut: (spotId) => {
        const spot = HIDE_SPOTS.find((h) => h.id === spotId);
        const p = RT.player;
        if (!spot || !p.hidden || p.hidden.id !== spotId) return;
        p.hidden = null;
        p.pos.set(spot.checkFrom[0], FLOOR_Y[spot.floor], spot.checkFrom[2]);
        useGame.getState().damage(18);
        useHud.getState().toast('It found you. RUN.');
        AudioEngine.play('jumpscare', { volume: 0.9 });
        RT.shake = 1.4;
      },
    });
    const save = g.pendingLoad;
    if (save) b.restore(save.enemy.state);
    return b;
  }, []);

  // Spawn / restore.
  useEffect(() => {
    const g = useGame.getState();
    const save = g.pendingLoad;
    const pos = save ? save.enemy.pos : ENEMY_SPAWN.pos;
    RT.enemy.pos.set(pos[0], pos[1], pos[2]);
    RT.enemy.floor = save ? save.enemy.floor : ENEMY_SPAWN.floor;
    RT.enemy.active = save ? save.enemy.state !== 'dormant' : false;
    graceLeft.current = DIFFICULTY[g.difficulty].graceTime;
    bodyRef.current?.setNextKinematicTranslation({
      x: pos[0],
      y: pos[1] + CAP_HH + CAP_R,
      z: pos[2],
    });
  }, []);

  const tmp = useMemo(() => new THREE.Vector3(), []);
  const tmp2 = useMemo(() => new THREE.Vector3(), []);

  /** How clearly the Keeper can see the player right now (0..1). */
  function computeVisibility(): number {
    const p = RT.player;
    const g = useGame.getState();
    if (p.dead || p.hidden) return 0;
    const eye = tmp.copy(RT.enemy.pos).add(tmp2.set(0, 1.95, 0));
    const targetY = p.pos.y + (p.crouched ? 0.6 : 1.5);
    const dx = p.pos.x - eye.x;
    const dy = targetY - eye.y;
    const dz = p.pos.z - eye.z;
    const dist = Math.hypot(dx, dy, dz);
    if (dist < 1.7) return 1; // presence — it feels you beside it

    const diff = DIFFICULTY[g.difficulty];
    // Light conditions at the player.
    const room = p.roomId;
    const roomLit = !!(room && g.flags.powerOn && g.litRooms[room]);
    const outside = isOutside(p.pos.x, p.pos.z);
    let light = 0.42; // baseline darkness
    if (roomLit) light = 1;
    else if (outside) light = 0.55 + RT.weather.lightning * 0.6;
    if (p.flashlightOn) {
      // A lit torch makes you visible from much further, especially if the
      // beam points toward the Keeper.
      const beamDot = p.flashlightDir.dot(tmp2.set(-dx, -dy, -dz).normalize());
      light = Math.max(light, 0.75 + (beamDot > 0.6 ? 0.35 : 0));
    }
    let maxRange = 16 * diff.perception * light;
    if (p.crouched && !roomLit) maxRange *= 0.72;
    if (dist > maxRange) return 0;

    // Facing cone: 55° full vision, 100° peripheral at half strength.
    const facing = tmp2.set(-Math.sin(yawRef.current), 0, -Math.cos(yawRef.current));
    const toP = tmp.set(dx, 0, dz).normalize();
    const dot = facing.dot(toP);
    let cone = 0;
    if (dot > 0.57) cone = 1;
    else if (dot > -0.1) cone = 0.35;
    else return 0;

    // Occlusion: raycast from eye to the player's chest.
    const origin = { x: eye.x, y: eye.y, z: eye.z };
    const dir = { x: dx / dist, y: dy / dist, z: dz / dist };
    const hit = world.castRay(
      new rapier.Ray(origin, dir),
      dist - 0.4,
      true,
      undefined,
      undefined,
      undefined,
      bodyRef.current ?? undefined,
      (c) => {
        const ud = c.parent()?.userData as { kind?: string } | undefined;
        return (
          ud?.kind !== 'player' && ud?.kind !== 'glass' && ud?.kind !== 'prop' && !c.isSensor()
        );
      }
    );
    if (hit) return 0;

    const closeness = clamp01(1 - dist / maxRange);
    const motion = clamp01(p.speed2d / 4) * 0.35;
    return clamp01((0.3 + closeness * 0.7 + motion) * cone * (p.crouched ? 0.8 : 1));
  }

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    const g = useGame.getState();
    const body = bodyRef.current;
    const model = modelRef.current;
    if (!body || !model) return;
    if (!worldActive() && g.phase !== 'dead') {
      return;
    }

    const e = RT.enemy;

    // Grace period, then the house wakes its warden.
    if (!g.flags.keeperAwake) {
      graceLeft.current -= dt;
      if (graceLeft.current <= 0 || brain.state !== 'dormant') {
        g.setFlag('keeperAwake');
        brain.wake();
        useHud.getState().toast('Somewhere below, something begins to move.');
      }
    } else if (brain.state === 'dormant') {
      brain.wake();
    }

    // --- brain tick at 12 Hz ---
    tickAcc.current += dt;
    const p = RT.player;
    if (tickAcc.current >= 1 / 12) {
      const tickDt = tickAcc.current;
      tickAcc.current = 0;
      const visibility = g.phase === 'playing' ? computeVisibility() : 0;
      lastOut.current = brain.tick(tickDt, e.pos, {
        visibility,
        playerPos: p.pos,
        playerFloor: p.floor,
        playerHiddenId: p.hidden?.id ?? null,
        playerHiddenSeen: p.hidden?.enteredSeen ?? false,
        playerSpeed: p.speed2d,
      });
      e.state = lastOut.current.state;
      e.awareness = lastOut.current.awareness;
      e.active = lastOut.current.state !== 'dormant';

      // Attack resolution.
      if (lastOut.current.attack && g.phase === 'playing') {
        const dist = e.pos.distanceTo(p.pos);
        if (dist < 2.0 && !p.hidden) {
          const dmg = DIFFICULTY[g.difficulty].attackDamage + Math.random() * 6;
          AudioEngine.play3d('keeper_attack', e.pos, { volume: 1 });
          g.damage(dmg);
          // Knockback through the shared velocity.
          tmp.copy(p.pos).sub(e.pos).setY(0).normalize();
          p.vel.x += tmp.x * 5.5;
          p.vel.z += tmp.z * 5.5;
          if (g.health <= 0) AudioEngine.play('jumpscare', { volume: 1 });
        }
      }
    }

    const out = lastOut.current;

    // --- movement (never teleports; walks its path) ---
    let speed = 0;
    if (out && out.moveTarget && g.phase === 'playing') {
      const t = out.moveTarget;
      tmp.set(t.x - e.pos.x, 0, t.z - e.pos.z);
      const d = tmp.length();
      speed = out.speed;
      if (d > 0.001) {
        const step = Math.min(d, speed * dt);
        tmp.normalize();
        e.pos.x += tmp.x * step;
        e.pos.z += tmp.z * step;
        const targetYaw = Math.atan2(-tmp.x, -tmp.z);
        yawRef.current = dampAngle(yawRef.current, targetYaw, 9, dt);
      }
      // Vertical follows the nav waypoints (stairs are interpolated points).
      e.pos.y = damp(e.pos.y, t.y, 11, dt);
    } else if (out?.faceYaw != null) {
      yawRef.current = dampAngle(yawRef.current, out.faceYaw, 5, dt);
    }
    e.floor = (
      e.pos.y < FLOOR_Y.ground - 0.8
        ? 'basement'
        : e.pos.y < FLOOR_Y.upper - 0.8
          ? 'ground'
          : 'upper'
    ) as FloorId;

    body.setNextKinematicTranslation({
      x: e.pos.x,
      y: e.pos.y + CAP_HH + CAP_R,
      z: e.pos.z,
    });

    // --- model pose ---
    model.position.copy(e.pos);
    model.rotation.y = yawRef.current;
    const isChasing = e.state === 'chase' || e.state === 'track' || e.state === 'attack';
    model.rotation.x = damp(model.rotation.x, isChasing ? 0.16 : 0.02, 4, dt);

    walkPhase.current += speed * dt * 1.35;
    const swing = Math.sin(walkPhase.current);
    const swing2 = Math.sin(walkPhase.current + Math.PI);
    const amp = clamp01(speed / 3) * 0.65 + 0.04;
    if (legL.current) legL.current.rotation.x = swing * amp;
    if (legR.current) legR.current.rotation.x = swing2 * amp;
    if (armL.current) {
      armL.current.rotation.x = swing2 * amp * 0.7 + (isChasing ? -0.9 : 0.06);
      armL.current.rotation.z = 0.08 + (isChasing ? 0.25 : 0);
    }
    if (armR.current) {
      armR.current.rotation.x = swing * amp * 0.7 + (isChasing ? -0.9 : 0.06);
      armR.current.rotation.z = -0.08 - (isChasing ? 0.25 : 0);
    }
    // Idle sway + breathing.
    model.position.y += Math.abs(Math.sin(walkPhase.current * 2)) * 0.03 * clamp01(speed);
    if (headRef.current) {
      // The head tracks the player when it knows where you are.
      if (e.awareness > 0.5 && !p.hidden) {
        tmp
          .copy(p.pos)
          .setY(p.pos.y + 1.5)
          .sub(e.pos.clone().setY(e.pos.y + 1.95));
        const localYaw = Math.atan2(-tmp.x, -tmp.z) - yawRef.current;
        let ly = localYaw;
        while (ly > Math.PI) ly -= Math.PI * 2;
        while (ly < -Math.PI) ly += Math.PI * 2;
        headRef.current.rotation.y = damp(
          headRef.current.rotation.y,
          Math.max(-1.1, Math.min(1.1, ly)),
          6,
          dt
        );
      } else {
        headRef.current.rotation.y = damp(
          headRef.current.rotation.y,
          Math.sin(state.clock.elapsedTime * 0.4) * 0.4,
          2,
          dt
        );
      }
    }

    // Eyes: dim ember → blazing when hunting.
    const glowTarget =
      e.state === 'chase' || e.state === 'attack'
        ? 3.2
        : e.state === 'track' || e.state === 'search' || e.state === 'investigate'
          ? 1.6
          : e.active
            ? 0.55
            : 0.12;
    eyeGlow.current = damp(eyeGlow.current, glowTarget, 4, dt);
    eyeMat.emissiveIntensity = eyeGlow.current;
    eyeMat.emissive.setRGB(1, isChasing ? 0.12 : 0.55, isChasing ? 0.05 : 0.25);

    // --- sound ---
    const distToPlayer = e.pos.distanceTo(p.pos);
    // Occlusion for its sounds: same floor + LOS → clear, else muffled.
    const sameFloor = e.floor === p.floor;
    const occl = sameFloor ? 1 : 0.4;
    if (e.active) {
      AudioEngine.setLoop('keeper_breath', 'keeper_breath', distToPlayer < 16 ? occl : 0, {
        pos: e.pos,
        bus: 'sfx',
        rate: isChasing ? 1.3 : 1,
      });
    }
    strideAcc.current += speed * dt;
    if (strideAcc.current > 0.92) {
      strideAcc.current = 0;
      AudioEngine.play3d('keeper_step', e.pos, {
        volume: 0.9,
        occlusion: occl,
        refDistance: 2.2,
        maxDistance: 34,
        rate: 0.92 + Math.random() * 0.14,
      });
      // Its steps rattle the boards above/below.
      if (!sameFloor && distToPlayer < 9) RT.shake = Math.min(0.35, RT.shake + 0.05);
    }
  });

  const skin = MAT.keeperSkin();
  const coat = MAT.keeperCoat();

  return (
    <>
      <RigidBody
        ref={bodyRef}
        type="kinematicPosition"
        colliders={false}
        position={[ENEMY_SPAWN.pos[0], ENEMY_SPAWN.pos[1] + CAP_HH + CAP_R, ENEMY_SPAWN.pos[2]]}
        userData={{ kind: 'enemy' }}
      >
        <CapsuleCollider args={[CAP_HH, CAP_R]} />
      </RigidBody>
      {/* The Keeper's body (visual only; collider above). */}
      <group ref={modelRef}>
        {/* legs */}
        <group ref={legL} position={[-0.13, 1.12, 0]}>
          <mesh position={[0, -0.56, 0]} castShadow material={coat}>
            <cylinderGeometry args={[0.075, 0.055, 1.12, 8]} />
          </mesh>
        </group>
        <group ref={legR} position={[0.13, 1.12, 0]}>
          <mesh position={[0, -0.56, 0]} castShadow material={coat}>
            <cylinderGeometry args={[0.075, 0.055, 1.12, 8]} />
          </mesh>
        </group>
        {/* torso — long coat */}
        <mesh position={[0, 1.55, 0]} castShadow material={coat}>
          <cylinderGeometry args={[0.19, 0.27, 0.95, 10]} />
        </mesh>
        <mesh position={[0, 2.0, 0]} castShadow material={coat}>
          <cylinderGeometry args={[0.13, 0.2, 0.22, 8]} />
        </mesh>
        {/* arms — too long */}
        <group ref={armL} position={[-0.26, 1.98, 0]}>
          <mesh position={[0, -0.5, 0]} castShadow material={coat}>
            <cylinderGeometry args={[0.05, 0.038, 1.0, 7]} />
          </mesh>
          <mesh position={[0, -1.06, 0]} castShadow material={skin}>
            <sphereGeometry args={[0.062, 7, 6]} />
          </mesh>
        </group>
        <group ref={armR} position={[0.26, 1.98, 0]}>
          <mesh position={[0, -0.5, 0]} castShadow material={coat}>
            <cylinderGeometry args={[0.05, 0.038, 1.0, 7]} />
          </mesh>
          <mesh position={[0, -1.06, 0]} castShadow material={skin}>
            <sphereGeometry args={[0.062, 7, 6]} />
          </mesh>
        </group>
        {/* head */}
        <group ref={headRef} position={[0, 2.14, 0]}>
          <mesh castShadow material={skin} scale={[0.82, 1.25, 0.9]}>
            <sphereGeometry args={[0.13, 10, 8]} />
          </mesh>
          {/* eyes */}
          <mesh position={[-0.045, 0.03, -0.105]} material={eyeMat}>
            <sphereGeometry args={[0.018, 6, 5]} />
          </mesh>
          <mesh position={[0.045, 0.03, -0.105]} material={eyeMat}>
            <sphereGeometry args={[0.018, 6, 5]} />
          </mesh>
        </group>
      </group>
    </>
  );
}
