'use client';

/**
 * Loot lying in the open: items and notes at non-container spawn points,
 * rendered as small procedural models with a faint glint so a sweeping
 * flashlight catches them.
 */

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { SPAWN_POINTS } from '@/game/levels/layout';
import { ItemId, NoteId } from '@/game/types';
import { useGame } from '@/game/state/gameStore';
import { registerInteractable } from '@/game/state/runtime';
import { AudioEngine } from '@/game/audio/engine';
import { MAT } from '@/game/graphics/materials';
import { ITEMS } from '@/game/types';

function ItemModel({ item }: { item: ItemId }) {
  switch (item) {
    case 'key_study':
    case 'key_master':
    case 'key_basement':
    case 'key_car':
      return (
        <group rotation={[Math.PI / 2, 0, 0.6]}>
          <mesh material={MAT.metal()}>
            <torusGeometry args={[0.035, 0.012, 6, 12]} />
          </mesh>
          <mesh position={[0.07, 0, 0]} material={MAT.metal()}>
            <boxGeometry args={[0.09, 0.016, 0.012]} />
          </mesh>
        </group>
      );
    case 'fuse':
      return (
        <mesh rotation={[0, 0, Math.PI / 2]} material={MAT.porcelain()}>
          <cylinderGeometry args={[0.025, 0.025, 0.12, 8]} />
        </mesh>
      );
    case 'gas_can':
      return (
        <group>
          <mesh position={[0, 0.16, 0]} material={MAT.metal()}>
            <boxGeometry args={[0.26, 0.32, 0.16]} />
          </mesh>
          <mesh position={[0.08, 0.36, 0]} material={MAT.metalDark()}>
            <cylinderGeometry args={[0.03, 0.03, 0.08, 8]} />
          </mesh>
        </group>
      );
    case 'crowbar':
      return (
        <group rotation={[0, 0.5, Math.PI / 2]}>
          <mesh material={MAT.metalDark()}>
            <cylinderGeometry args={[0.02, 0.02, 0.6, 8]} />
          </mesh>
          <mesh position={[0, 0.32, 0.03]} rotation={[0.9, 0, 0]} material={MAT.metalDark()}>
            <cylinderGeometry args={[0.02, 0.02, 0.14, 8]} />
          </mesh>
        </group>
      );
    case 'bolt_cutters':
      return (
        <group rotation={[0, 0.9, 0]}>
          <mesh position={[-0.03, 0.02, 0]} rotation={[0, 0, 0.16]} material={MAT.metalDark()}>
            <cylinderGeometry args={[0.016, 0.016, 0.5, 6]} />
          </mesh>
          <mesh position={[0.03, 0.02, 0]} rotation={[0, 0, -0.16]} material={MAT.metalDark()}>
            <cylinderGeometry args={[0.016, 0.016, 0.5, 6]} />
          </mesh>
          <mesh position={[0, 0.26, 0]} material={MAT.metal()}>
            <boxGeometry args={[0.1, 0.08, 0.03]} />
          </mesh>
        </group>
      );
    case 'wire_cutters':
      return (
        <group rotation={[Math.PI / 2, 0, 0.4]}>
          <mesh position={[-0.015, 0, 0]} rotation={[0, 0, 0.2]} material={MAT.metal()}>
            <cylinderGeometry args={[0.01, 0.01, 0.16, 6]} />
          </mesh>
          <mesh position={[0.015, 0, 0]} rotation={[0, 0, -0.2]} material={MAT.metal()}>
            <cylinderGeometry args={[0.01, 0.01, 0.16, 6]} />
          </mesh>
        </group>
      );
    case 'battery':
      return (
        <mesh material={MAT.metal()}>
          <cylinderGeometry args={[0.03, 0.03, 0.1, 10]} />
        </mesh>
      );
    case 'bandage':
      return (
        <mesh material={MAT.porcelain()}>
          <cylinderGeometry args={[0.05, 0.05, 0.06, 10]} />
        </mesh>
      );
  }
}

function SpawnEntity({ spawnId }: { spawnId: string }) {
  const spawn = useMemo(() => SPAWN_POINTS.find((s) => s.id === spawnId)!, [spawnId]);
  const run = useGame((s) => s.run);
  const taken = useGame((s) => s.takenSpawns.includes(spawnId));
  const groupRef = useRef<THREE.Group>(null);
  const pos = useMemo(() => new THREE.Vector3(spawn.pos[0], spawn.pos[1], spawn.pos[2]), [spawn]);
  const content = run?.contents[spawnId];

  useEffect(() => {
    if (!content || content.type === 'empty' || taken) return;
    return registerInteractable({
      id: `pickup_${spawnId}`,
      pos: pos.clone().add(new THREE.Vector3(0, 0.1, 0)),
      radius: 1.6,
      prompt: () =>
        content.type === 'item' ? `Take the ${ITEMS[content.id].name}` : 'Read the note',
      enabled: () => !useGame.getState().takenSpawns.includes(spawnId),
      action: () => {
        const g = useGame.getState();
        g.takeSpawn(spawnId);
        if (content.type === 'item') {
          AudioEngine.play('pickup', { volume: 0.9 });
          g.addItem(content.id as ItemId);
        } else {
          AudioEngine.play('paper', { volume: 0.9 });
          g.collectNote(content.id as NoteId);
          g.openNote(content.id as NoteId);
        }
      },
    });
  }, [content, pos, spawnId, taken]);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.6;
    }
  });

  if (!content || content.type === 'empty' || taken) return null;

  return (
    <group position={pos} ref={groupRef}>
      {content.type === 'item' ? (
        <ItemModel item={content.id as ItemId} />
      ) : (
        <mesh rotation={[-Math.PI / 2, 0, 0.4]} material={MAT.paper()}>
          <planeGeometry args={[0.21, 0.28]} />
        </mesh>
      )}
    </group>
  );
}

export default function Items() {
  const openSpawns = useMemo(() => SPAWN_POINTS.filter((s) => !s.container).map((s) => s.id), []);
  return (
    <group>
      {openSpawns.map((id) => (
        <SpawnEntity key={id} spawnId={id} />
      ))}
    </group>
  );
}
