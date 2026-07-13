'use client';

/**
 * Diegetic-leaning HUD: vitals (health pulse, stamina, battery cells),
 * crosshair that blooms near interactables, interaction prompt, objective
 * tracker, toasts, hints, blood vignette and the hidden/breath indicators.
 */

import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useHud } from '@/game/state/hudStore';
import { useGame } from '@/game/state/gameStore';
import { useSettings } from '@/game/state/settingsStore';

export default function HUD({ locked }: { locked: boolean }) {
  const hud = useHud();
  const objectives = useGame((s) => s.objectives);
  const overlay = useGame((s) => s.overlay);
  const settings = useSettings();

  // Expire toasts.
  useEffect(() => {
    if (hud.toasts.length === 0) return;
    const t = window.setTimeout(() => {
      useHud.getState().expireToast(hud.toasts[0].id);
    }, 4200);
    return () => window.clearTimeout(t);
  }, [hud.toasts]);

  const activeObjectives = objectives.filter((o) => !o.done).slice(0, 4);
  const bloodOpacity = Math.min(0.85, (1 - hud.health) * 0.8 + hud.dread * 0.12);

  return (
    <div className="hud" aria-hidden>
      {/* blood + dread vignette */}
      <div className="blood-vignette" style={{ opacity: bloodOpacity }} />
      <div
        className="dread-pulse"
        style={{ opacity: hud.dread * 0.5, animationDuration: `${1.4 - hud.dread * 0.7}s` }}
      />

      {/* crosshair */}
      {settings.crosshair && overlay === null && (
        <div className={`crosshair ${hud.prompt ? 'active' : ''}`} />
      )}

      {/* interaction prompt */}
      {overlay === null && hud.prompt && (
        <div className="prompt">
          <span className="prompt-key">LMB</span> {hud.prompt}
        </div>
      )}

      {/* click-to-resume */}
      {overlay === null && !locked && <div className="relock">Click to take control</div>}

      {/* hidden indicator */}
      {hud.hidden && (
        <div className="hidden-indicator">
          {hud.holdingBreath ? 'HOLDING BREATH' : 'HIDDEN — hold Shift to hold your breath'}
        </div>
      )}

      {/* vitals */}
      <div className="vitals">
        <div className="vital">
          <span
            className="vital-heart"
            style={{ animationDuration: `${Math.max(0.35, 1.1 - hud.dread * 0.7)}s` }}
          >
            ♥
          </span>
          <div className="bar">
            <div
              className="bar-fill health"
              style={{ width: `${Math.round(hud.health * 100)}%` }}
            />
          </div>
        </div>
        <div className="vital">
          <span className="vital-label">STA</span>
          <div className="bar">
            <div
              className="bar-fill stamina"
              style={{ width: `${Math.round(hud.stamina * 100)}%` }}
            />
          </div>
        </div>
        <div className="vital">
          <span className="vital-label">BAT</span>
          <div className="bar cells">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className={`cell ${hud.battery * 5 > i + 0.25 ? 'on' : ''}`} />
            ))}
          </div>
        </div>
      </div>

      {/* objectives */}
      <div className="objectives">
        {activeObjectives.map((o) => (
          <div key={o.id} className="objective">
            <span className="objective-dot" /> {o.text}
          </div>
        ))}
      </div>

      {/* toasts */}
      <div className="toasts">
        <AnimatePresence>
          {hud.toasts.map((t) => (
            <motion.div
              key={t.id}
              className={`toast toast-${t.kind}`}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
            >
              {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* hint */}
      <AnimatePresence>
        {hud.hint && (
          <motion.div
            className="hint"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            {hud.hint}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
