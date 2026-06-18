'use client';

import { useSimStore } from '@/store/useSimStore';
import { formatClock, SIM_DURATION_MIN } from '@/lib/sim/engine';

const SPEEDS = [
  { label: '1×', value: 0.5 },
  { label: '2×', value: 2 },
  { label: '4×', value: 4 },
];

export default function SimClock() {
  const simMin = useSimStore((s) => s.simMin);
  const playing = useSimStore((s) => s.playing);
  const speed = useSimStore((s) => s.speed);
  const togglePlay = useSimStore((s) => s.togglePlay);
  const setSimMin = useSimStore((s) => s.setSimMin);
  const setSpeed = useSimStore((s) => s.setSpeed);
  const reset = useSimStore((s) => s.reset);

  const ended = simMin >= SIM_DURATION_MIN;

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-1.5 ring-1 ring-line">
        <span className="flex items-center gap-1.5">
          <span
            className={`live-dot h-1.5 w-1.5 rounded-full ${playing ? 'bg-heat-high' : 'bg-faint'}`}
          />
          <span className="eyebrow !text-muted">Fri</span>
        </span>
        <span
          className="tnum text-[15px] font-semibold text-ink"
          style={{ minWidth: 74 }}
        >
          {formatClock(simMin)}
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          onClick={reset}
          title="Restart"
          aria-label="Restart simulation"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted ring-1 ring-line transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
            <path
              d="M5 10a5 5 0 1 0 1.6-3.7M5 4v3h3"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <button
          onClick={togglePlay}
          aria-label={playing ? 'Pause' : 'Play'}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm font-semibold text-white shadow-[0_6px_16px_-8px_rgba(27,95,176,0.9)] transition-[transform,background] hover:bg-primary-ink active:scale-[0.97]"
        >
          {ended ? (
            <>Replay</>
          ) : playing ? (
            <>
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="currentColor"
              >
                <rect x="2" y="1.5" width="2.6" height="9" rx="1" />
                <rect x="7.4" y="1.5" width="2.6" height="9" rx="1" />
              </svg>
              Pause
            </>
          ) : (
            <>
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="currentColor"
              >
                <path d="M2.5 1.6 10 6l-7.5 4.4z" />
              </svg>
              Play
            </>
          )}
        </button>
      </div>

      <input
        type="range"
        min={0}
        max={SIM_DURATION_MIN}
        step={1}
        value={Math.round(simMin)}
        onChange={(e) => setSimMin(Number(e.target.value))}
        aria-label="Scrub time"
        className="parkiq-range h-1.5 w-36 cursor-pointer"
      />

      <div className="flex items-center gap-0.5 rounded-lg bg-surface-2 p-0.5 ring-1 ring-line">
        {SPEEDS.map((s) => (
          <button
            key={s.label}
            onClick={() => setSpeed(s.value)}
            className={`tnum h-7 w-8 rounded-md text-xs font-semibold transition-colors ${
              speed === s.value
                ? 'bg-white text-primary shadow-sm ring-1 ring-line'
                : 'text-muted hover:text-ink'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
