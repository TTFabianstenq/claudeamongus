'use client';

/**
 * Settings: mouse, camera, audio buses, graphics quality, difficulty
 * default, hints. Persisted to localStorage independently of saves.
 */

import { motion } from 'framer-motion';
import { useGame } from '@/game/state/gameStore';
import { useSettings } from '@/game/state/settingsStore';
import { AudioEngine } from '@/game/audio/engine';
import { Quality } from '@/game/types';

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  return (
    <label className="setting-row">
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      <em>{format ? format(value) : value.toFixed(2)}</em>
    </label>
  );
}

export default function SettingsPanel() {
  const s = useSettings();
  const phase = useGame((st) => st.phase);

  const close = () => {
    AudioEngine.play('ui_click', { volume: 0.6 });
    const g = useGame.getState();
    if (g.phase === 'playing') {
      g.setOverlay('pause');
    } else {
      g.setOverlay(null);
    }
  };

  return (
    <motion.div
      className="screen overlay-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="panel wide">
        <h2 className="panel-title">Settings</h2>

        <h3 className="setting-group">Mouse & Camera</h3>
        <Slider
          label="Sensitivity"
          value={s.sensitivity}
          min={0.3}
          max={2.5}
          step={0.05}
          onChange={(v) => s.set({ sensitivity: v })}
        />
        <Slider
          label="Field of view"
          value={s.fov}
          min={60}
          max={95}
          step={1}
          onChange={(v) => s.set({ fov: v })}
          format={(v) => `${Math.round(v)}°`}
        />
        <Slider
          label="Head bob"
          value={s.headBob}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) => s.set({ headBob: v })}
        />
        <label className="setting-row">
          <span>Invert Y</span>
          <input
            type="checkbox"
            checked={s.invertY}
            onChange={(e) => s.set({ invertY: e.target.checked })}
          />
          <em>{s.invertY ? 'on' : 'off'}</em>
        </label>

        <h3 className="setting-group">Audio</h3>
        <Slider
          label="Master"
          value={s.masterVolume}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) => s.set({ masterVolume: v })}
        />
        <Slider
          label="Music"
          value={s.musicVolume}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) => s.set({ musicVolume: v })}
        />
        <Slider
          label="Effects"
          value={s.sfxVolume}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) => s.set({ sfxVolume: v })}
        />
        <Slider
          label="Ambience"
          value={s.ambienceVolume}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) => s.set({ ambienceVolume: v })}
        />

        <h3 className="setting-group">Graphics</h3>
        <div className="setting-row">
          <span>Quality</span>
          <div className="quality-btns">
            {(['low', 'medium', 'high', 'ultra'] as Quality[]).map((q) => (
              <button
                key={q}
                className={`chip ${s.quality === q ? 'active' : ''}`}
                onClick={() => s.set({ quality: q })}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
        {phase !== 'menu' && (
          <p className="setting-note">Quality changes fully apply on the next run.</p>
        )}

        <h3 className="setting-group">Gameplay</h3>
        <label className="setting-row">
          <span>Hints</span>
          <input
            type="checkbox"
            checked={s.showHints}
            onChange={(e) => s.set({ showHints: e.target.checked })}
          />
          <em>{s.showHints ? 'on' : 'off'}</em>
        </label>
        <label className="setting-row">
          <span>Crosshair</span>
          <input
            type="checkbox"
            checked={s.crosshair}
            onChange={(e) => s.set({ crosshair: e.target.checked })}
          />
          <em>{s.crosshair ? 'on' : 'off'}</em>
        </label>

        <div className="menu-nav">
          <button className="menu-btn" onClick={close}>
            Done
          </button>
        </div>
      </div>
    </motion.div>
  );
}
