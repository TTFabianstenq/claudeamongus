'use client';

/**
 * Hinged doors: kinematic Rapier bodies swung by a damped angle, so a closed
 * door genuinely blocks movement, vision raycasts and sound-lines. The
 * Keeper interacts through the same store the player does — it opens
 * unlocked doors, hammers locked breakable ones and eventually splinters
 * them. Crouch-interacting opens a door only slightly (peeking).
 */

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, RapierRigidBody, RigidBody } from '@react-three/rapier';
import { DOORS, EXTERIOR } from '@/game/levels/layout';
import { DoorDef, FLOOR_Y, ITEMS, ItemId } from '@/game/types';
import { useGame, worldActive } from '@/game/state/gameStore';
import { emitNoise, registerInteractable, RT } from '@/game/state/runtime';
import { useHud } from '@/game/state/hudStore';
import { AudioEngine } from '@/game/audio/engine';
import { damp } from '@/game/utils/math';
import { MAT } from '@/game/graphics/materials';
import { worldUvBox } from '@/game/graphics/geometry';

const OPEN_ANGLE = 1.85;
const PEEK_ANGLE = 0.42;

function DoorEntity({ def }: { def: DoorDef }) {
  const bodyRef = useRef<RapierRigidBody>(null);
  const angle = useRef(0);
  const targetAngle = useRef(0);
  const tilt = useRef(0);
  const baseY = FLOOR_Y[def.floor];
  const width = def.width ?? 0.92;
  const height = def.height ?? 2.06;

  // Hinge sits at one end of the doorway; panel extends along the wall.
  const wallDir = useMemo(
    () => new THREE.Vector3(Math.cos(def.rotY), 0, -Math.sin(def.rotY)),
    [def.rotY]
  );
  const hinge = useMemo(
    () => new THREE.Vector3(def.pos[0], baseY, def.pos[1]).addScaledVector(wallDir, -width / 2),
    [def.pos, baseY, wallDir, width]
  );

  const geometry = useMemo(() => {
    const g = worldUvBox({
      x: 0,
      y: 0,
      z: 0,
      w: width - 0.04,
      h: height - 0.04,
      d: 0.055,
      uvScale: 0.6,
    });
    g.translate((width - 0.04) / 2, (height - 0.04) / 2 + 0.02, 0);
    return g;
  }, [width, height]);

  const knobGeo = useMemo(() => {
    const g = new THREE.SphereGeometry(0.045, 8, 6);
    g.translate(width - 0.16, 1.02, 0.07);
    return g;
  }, [width]);

  // ---- interaction ----
  useEffect(() => {
    const doorId = def.id;
    const center = new THREE.Vector3(def.pos[0], baseY + 1.1, def.pos[1]);
    const unregister = registerInteractable({
      id: `door_${doorId}`,
      pos: center,
      radius: 1.5,
      priority: 1,
      prompt: () => {
        const g = useGame.getState();
        const d = g.doors[doorId];
        if (!d) return '';
        if (d.locked) {
          if (def.lockId === 'PRY') {
            return g.hasItem('crowbar') ? 'Pry the boards loose' : 'Boarded shut — needs prying';
          }
          const key = def.lockId as ItemId | undefined;
          if (key && g.hasItem(key)) return `Unlock (${ITEMS[key].name})`;
          return 'Locked';
        }
        if (d.open) return 'Close';
        return RT.player.crouched ? 'Peek open' : 'Open';
      },
      action: () => {
        const g = useGame.getState();
        const d = g.doors[doorId];
        if (!d) return;
        if (d.locked) {
          if (def.lockId === 'PRY') {
            if (g.hasItem('crowbar')) {
              g.setDoor(doorId, { locked: false });
              g.setFlag('backDoorPried');
              AudioEngine.play3d('pry', center);
              emitNoise(center.x, center.y, center.z, 0.9, 'impact');
              useHud.getState().toast('The boards splinter away.');
            } else {
              AudioEngine.play3d('door_locked', center, { volume: 0.8 });
              useHud.getState().toast('Boarded shut. You need something to pry with.');
            }
            return;
          }
          const key = def.lockId as ItemId | undefined;
          if (key && g.hasItem(key)) {
            g.setDoor(doorId, { locked: false });
            AudioEngine.play3d('door_unlock', center);
            useHud.getState().toast(`Unlocked with the ${ITEMS[key].name.toLowerCase()}.`);
          } else {
            AudioEngine.play3d('door_locked', center, { volume: 0.9 });
            emitNoise(center.x, center.y, center.z, 0.3, 'door');
            useHud.getState().toast('Locked.');
          }
          return;
        }
        if (d.open) {
          g.setDoor(doorId, { open: false });
          AudioEngine.play3d('door_close', center, { volume: 0.9 });
          emitNoise(center.x, center.y, center.z, 0.45, 'door');
        } else {
          g.setDoor(doorId, { open: true });
          targetAngle.current = RT.player.crouched ? PEEK_ANGLE : OPEN_ANGLE;
          AudioEngine.play3d('door_creak', center, {
            volume: RT.player.crouched ? 0.35 : 0.8,
            rate: 0.9 + Math.random() * 0.25,
          });
          emitNoise(center.x, center.y, center.z, RT.player.crouched ? 0.12 : 0.35, 'door');
        }
      },
    });
    return unregister;
  }, [def, baseY]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const body = bodyRef.current;
    if (!body) return;
    const g = useGame.getState();
    const d = g.doors[def.id];
    if (!d) return;

    // Process Keeper door requests addressed to this door.
    if (worldActive()) {
      for (let i = RT.enemy.doorRequests.length - 1; i >= 0; i--) {
        const req = RT.enemy.doorRequests[i];
        if (req.id !== def.id) continue;
        RT.enemy.doorRequests.splice(i, 1);
        const center = new THREE.Vector3(def.pos[0], baseY + 1.1, def.pos[1]);
        if (req.action === 'open' && !d.locked && !d.open) {
          g.setDoor(def.id, { open: true });
          targetAngle.current = OPEN_ANGLE;
          AudioEngine.play3d('door_creak', center, { volume: 0.8, rate: 0.85 });
        } else if (req.action === 'bang') {
          AudioEngine.play3d('door_bang', center, { volume: 1 });
          RT.shake = Math.min(1.2, RT.shake + 0.35);
          tilt.current = 0.04;
        } else if (req.action === 'break') {
          g.setDoor(def.id, { open: true, locked: false, broken: true });
          AudioEngine.play3d('door_break', center, { volume: 1 });
          RT.shake = Math.min(1.4, RT.shake + 0.6);
          emitNoise(center.x, center.y, center.z, 1.1, 'doorSlam', false);
        }
      }
    }

    if (d.broken) {
      targetAngle.current = OPEN_ANGLE + 0.25;
      tilt.current = damp(tilt.current, 0.1, 3, dt);
    } else if (d.open) {
      if (targetAngle.current < PEEK_ANGLE - 0.01) targetAngle.current = OPEN_ANGLE;
      tilt.current = damp(tilt.current, 0, 6, dt);
    } else {
      targetAngle.current = 0;
      tilt.current = damp(tilt.current, 0, 6, dt);
    }

    angle.current = damp(angle.current, targetAngle.current, 6.5, dt);
    RT.doorAngles.set(def.id, angle.current);

    const q = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(0, def.rotY + angle.current, tilt.current)
    );
    body.setNextKinematicTranslation({ x: hinge.x, y: hinge.y, z: hinge.z });
    body.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
  });

  return (
    <RigidBody
      ref={bodyRef}
      type="kinematicPosition"
      colliders={false}
      position={[hinge.x, hinge.y, hinge.z]}
      rotation={[0, def.rotY, 0]}
      userData={{ kind: 'door', doorId: def.id }}
    >
      <CuboidCollider
        args={[(width - 0.04) / 2, (height - 0.04) / 2, 0.03]}
        position={[(width - 0.04) / 2, (height - 0.04) / 2 + 0.02, 0]}
      />
      <mesh
        geometry={geometry}
        material={def.kind === 'metal' ? MAT.metalDark() : MAT.darkWood()}
        castShadow
        receiveShadow
      />
      <mesh geometry={knobGeo} material={MAT.metal()} />
    </RigidBody>
  );
}

/** Vertical roll door on the garage — needs power to move. */
function GarageDoor() {
  const bodyRef = useRef<RapierRigidBody>(null);
  const lift = useRef(0);
  const pos = useMemo(() => new THREE.Vector3(7, 0, 8), []);

  useEffect(() => {
    const unregisterSwitch = registerInteractable({
      id: 'garage_switch',
      pos: new THREE.Vector3(5.7, 1.25, 7.8),
      radius: 1.4,
      prompt: () => {
        const g = useGame.getState();
        if (!g.flags.garagePower) return 'Garage door switch — dead, no power';
        return g.flags.garageOpen ? 'Close the garage door' : 'Open the garage door';
      },
      action: () => {
        const g = useGame.getState();
        AudioEngine.play3d('switch_click', [5.7, 1.25, 7.8]);
        if (!g.flags.garagePower) {
          useHud.getState().toast('The switch clicks uselessly. No power.');
          if (!g.flags.sawPanel)
            useHud
              .getState()
              .toast('Something must feed this circuit — a panel, or the generator.');
          return;
        }
        g.setFlag('garageOpen', !g.flags.garageOpen);
        emitNoise(7, 1.5, 8, 0.8, 'machine');
      },
    });
    return unregisterSwitch;
  }, []);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const body = bodyRef.current;
    if (!body) return;
    const open = useGame.getState().flags.garageOpen;
    const before = lift.current;
    lift.current = damp(lift.current, open ? 2.1 : 0, 1.6, dt);
    if (Math.abs(lift.current - before) > 0.0004) {
      AudioEngine.setLoop('garage_door', 'boiler_loop', 0.5, { pos: [7, 1.5, 8], bus: 'sfx' });
    } else {
      AudioEngine.setLoop('garage_door', 'boiler_loop', 0, { pos: [7, 1.5, 8], bus: 'sfx' });
    }
    body.setNextKinematicTranslation({ x: pos.x, y: lift.current, z: pos.z });
  });

  return (
    <RigidBody
      ref={bodyRef}
      type="kinematicPosition"
      colliders={false}
      position={[7, 0, 8]}
      userData={{ kind: 'door', doorId: 'garage_roll' }}
    >
      <CuboidCollider args={[1.6, 1.16, 0.05]} position={[0, 1.18, 0]} />
      <group position={[0, 1.18, 0]}>
        <mesh material={MAT.metal()} castShadow receiveShadow>
          <boxGeometry args={[3.2, 2.32, 0.08]} />
        </mesh>
        {/* roll door ribs */}
        {[-0.8, -0.3, 0.2, 0.7].map((y) => (
          <mesh key={y} position={[0, y, 0.05]} material={MAT.metalDark()}>
            <boxGeometry args={[3.2, 0.05, 0.02]} />
          </mesh>
        ))}
      </group>
    </RigidBody>
  );
}

export default function Doors() {
  return (
    <group>
      {DOORS.map((d) => (
        <DoorEntity key={d.id} def={d} />
      ))}
      <GarageDoor />
    </group>
  );
}

export { EXTERIOR };
