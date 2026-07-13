'use client';

/**
 * The game is fully client-side (WebGL, WebAudio, pointer lock, Rapier
 * WASM), so it loads dynamically with SSR disabled.
 */

import dynamic from 'next/dynamic';

const GameApp = dynamic(() => import('@/components/GameApp'), {
  ssr: false,
  loading: () => (
    <div className="boot-screen">
      <h1 className="boot-title">HOLLOWMOOR</h1>
      <p className="boot-sub">waking the house…</p>
    </div>
  ),
});

export default function Page() {
  return <GameApp />;
}
