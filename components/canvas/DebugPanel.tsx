'use client';

/**
 * Developer panel (Leva) — only mounted when the URL contains `?debug`.
 * Live monitors for the Keeper's state machine plus tuning knobs.
 */

import { useEffect } from 'react';
import { useControls, monitor } from 'leva';
import { StatsGl } from '@react-three/drei';
import { RT } from '@/game/state/runtime';
import { useGame } from '@/game/state/gameStore';

export default function DebugPanel() {
  useControls('Keeper', {
    state: monitor(() => RT.enemy.state, { interval: 250 }),
    awareness: monitor(() => RT.enemy.awareness.toFixed(2), { interval: 250 }),
    aggression: monitor(() => RT.enemy.aggression.toFixed(2), { interval: 500 }),
    floor: monitor(() => RT.enemy.floor, { interval: 500 }),
  });
  useControls('Player', {
    room: monitor(() => RT.player.roomId ?? 'outside', { interval: 400 }),
    floor: monitor(() => RT.player.floor, { interval: 400 }),
    hidden: monitor(() => (RT.player.hidden ? RT.player.hidden.id : 'no'), { interval: 400 }),
  });
  const { rain, wind } = useControls('Weather', {
    rain: { value: 0.7, min: 0, max: 1 },
    wind: { value: 0.4, min: 0, max: 1 },
  });
  useControls('Cheats', {
    'give all keys': {
      value: false,
      onChange: (v: boolean) => {
        if (!v) return;
        const g = useGame.getState();
        (['key_study', 'key_master', 'key_basement', 'key_car'] as const).forEach((k) => {
          if (!g.hasItem(k)) g.addItem(k, true);
        });
      },
    },
  });

  useEffect(() => {
    RT.weather.rain = rain;
    RT.weather.wind = wind;
  }, [rain, wind]);

  // Leva auto-mounts its DOM panel when useControls is active.
  return <StatsGl />;
}
