import { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';

/* ----------------------------------------------------------------
   TYPES & CONSTANTS
   ---------------------------------------------------------------- */
type Mode = 'focus' | 'shortBreak' | 'longBreak';

interface ModeConfig {
  label: string;
  minutes: number;
  accent1: string;
  accent2: string;
  glow: string;
  shadow: string;
}

const MODES: Record<Mode, ModeConfig> = {
  focus: {
    label: 'Focus',
    minutes: 25,
    accent1: '#ff6b6b',
    accent2: '#ff8e53',
    glow: 'rgba(255, 107, 107, 0.35)',
    shadow: 'rgba(255, 107, 107, 0.18)',
  },
  shortBreak: {
    label: 'Short Break',
    minutes: 5,
    accent1: '#00d2ff',
    accent2: '#3a7bd5',
    glow: 'rgba(0, 210, 255, 0.35)',
    shadow: 'rgba(0, 210, 255, 0.18)',
  },
  longBreak: {
    label: 'Long Break',
    minutes: 15,
    accent1: '#a855f7',
    accent2: '#ec4899',
    glow: 'rgba(168, 85, 247, 0.35)',
    shadow: 'rgba(168, 85, 247, 0.18)',
  },
};

const LONG_BREAK_INTERVAL = 4; // long break after every 4 focus sessions

/* ----------------------------------------------------------------
   SOUND — Web Audio API chime
   ---------------------------------------------------------------- */
function playChime() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();

    const playTone = (freq: number, startTime: number, duration: number, gain: number) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(3000, startTime);

      g.gain.setValueAtTime(0, startTime);
      g.gain.linearRampToValueAtTime(gain, startTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(filter);
      filter.connect(g);
      g.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    const now = ctx.currentTime;
    // Pleasant three-note ascending chime
    playTone(523.25, now, 0.5, 0.25);        // C5
    playTone(659.25, now + 0.15, 0.5, 0.2);  // E5
    playTone(783.99, now + 0.3, 0.8, 0.22);  // G5
    // Soft octave
    playTone(1046.5, now + 0.5, 1.0, 0.12);  // C6

    setTimeout(() => ctx.close(), 3000);
  } catch {
    // Audio not supported — fail silently
  }
}

/* ----------------------------------------------------------------
   SPARKLE HELPERS
   ---------------------------------------------------------------- */
interface Sparkle {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  delay: number;
}

let sparkleId = 0;

function generateSparkles(accent1: string, accent2: string): Sparkle[] {
  const count = 28;
  const sparkles: Sparkle[] = [];
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
    const radius = 80 + Math.random() * 140;
    sparkles.push({
      id: ++sparkleId,
      x: cx + Math.cos(angle) * radius + (Math.random() - 0.5) * 60,
      y: cy + Math.sin(angle) * radius + (Math.random() - 0.5) * 60,
      size: 3 + Math.random() * 5,
      color: Math.random() > 0.5 ? accent1 : accent2,
      delay: Math.random() * 0.4,
    });
  }
  return sparkles;
}

/* ----------------------------------------------------------------
   APP COMPONENT
   ---------------------------------------------------------------- */
export default function App() {
  const [mode, setMode] = useState<Mode>('focus');
  const [secondsLeft, setSecondsLeft] = useState(MODES.focus.minutes * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionsCompleted, setSessionsCompleted] = useState(0);
  const [sparkles, setSparkles] = useState<Sparkle[]>([]);
  const [showFlash, setShowFlash] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const totalSeconds = MODES[mode].minutes * 60;
  const config = MODES[mode];

  /* ---- Apply CSS custom properties ---- */
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--accent-1', config.accent1);
    root.style.setProperty('--accent-2', config.accent2);
    root.style.setProperty('--accent-glow', config.glow);
    root.style.setProperty('--ring-shadow', config.shadow);
  }, [config]);

  /* ---- Timer tick ---- */
  useEffect(() => {
    if (!isRunning) return;

    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning]);

  /* ---- Handle timer completion ---- */
  useEffect(() => {
    if (secondsLeft !== 0 || !isRunning) return;

    setIsRunning(false);
    playChime();

    // Sparkle burst
    setSparkles(generateSparkles(config.accent1, config.accent2));
    setShowFlash(true);
    setTimeout(() => setSparkles([]), 1800);
    setTimeout(() => setShowFlash(false), 900);

    if (mode === 'focus') {
      const newCount = sessionsCompleted + 1;
      setSessionsCompleted(newCount);
      // Auto-switch to break
      const nextMode: Mode = newCount % LONG_BREAK_INTERVAL === 0 ? 'longBreak' : 'shortBreak';
      setTimeout(() => switchMode(nextMode), 1200);
    } else {
      // Break finished — back to focus
      setTimeout(() => switchMode('focus'), 1200);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  /* ---- Switch mode ---- */
  const switchMode = useCallback(
    (newMode: Mode) => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setIsRunning(false);
      setMode(newMode);
      setSecondsLeft(MODES[newMode].minutes * 60);
    },
    [],
  );

  /* ---- Start / Pause / Reset ---- */
  const toggleRunning = useCallback(() => setIsRunning((r) => !r), []);

  const reset = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsRunning(false);
    setSecondsLeft(MODES[mode].minutes * 60);
  }, [mode]);

  /* ---- Keyboard shortcuts ---- */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space') {
        e.preventDefault();
        toggleRunning();
      }
      if (e.code === 'KeyR' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        reset();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleRunning, reset]);

  /* ---- Update document title ---- */
  useEffect(() => {
    const mins = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
    const secs = String(secondsLeft % 60).padStart(2, '0');
    document.title = `${mins}:${secs} — ${config.label} | Pomodoro`;
  }, [secondsLeft, config.label]);

  /* ---- Derived values ---- */
  const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const seconds = String(secondsLeft % 60).padStart(2, '0');
  const progress = 1 - secondsLeft / totalSeconds;

  // SVG ring calculations
  const ringSize = 300;
  const strokeWidth = 6;
  const radius = (ringSize - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  // Session dots (show up to LONG_BREAK_INTERVAL dots, fill completed ones)
  const currentCycleSessions = sessionsCompleted % LONG_BREAK_INTERVAL;
  const dots = Array.from({ length: LONG_BREAK_INTERVAL }, (_, i) => i < currentCycleSessions);

  return (
    <>
      {/* Animated background orbs */}
      <div className="bg-orbs" aria-hidden="true">
        <div className="orb orb--1" />
        <div className="orb orb--2" />
        <div className="orb orb--3" />
        <div className="orb orb--4" />
      </div>

      {/* Sparkle particles */}
      {sparkles.length > 0 && (
        <div className="sparkle-container" aria-hidden="true">
          {sparkles.map((s) => (
            <div
              key={s.id}
              className="sparkle"
              style={{
                left: s.x,
                top: s.y,
                width: s.size,
                height: s.size,
                background: s.color,
                boxShadow: `0 0 ${s.size * 2}px ${s.color}`,
                animationDelay: `${s.delay}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Completion flash */}
      {showFlash && <div className="completion-flash" />}

      <div className="app">
        {/* Header */}
        <header className="header">
          <span className="header__icon" role="img" aria-label="tomato">
            🍅
          </span>
          <h1 className="header__title">Pomodoro Timer</h1>
          <p className="header__subtitle">Stay focused, take breaks</p>
        </header>

        {/* Mode Tabs */}
        <nav className="mode-tabs" role="tablist" aria-label="Timer mode">
          {(Object.keys(MODES) as Mode[]).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={m === mode}
              className={`mode-tab${m === mode ? ' mode-tab--active' : ''}`}
              onClick={() => switchMode(m)}
            >
              {MODES[m].label}
            </button>
          ))}
        </nav>

        {/* Timer Card */}
        <main className="timer-card">
          {/* SVG Ring */}
          <div className="timer-ring-wrapper">
            <svg
              className={`timer-ring-svg${isRunning ? ' timer-ring-svg--active' : ''}`}
              viewBox={`0 0 ${ringSize} ${ringSize}`}
            >
              <defs>
                <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={config.accent1} />
                  <stop offset="100%" stopColor={config.accent2} />
                </linearGradient>
              </defs>
              <circle
                className="timer-ring__track"
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={radius}
              />
              <circle
                className="timer-ring__progress"
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={radius}
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
              />
            </svg>

            {/* Time Display */}
            <div className="timer-display">
              <span className={`timer-time${isRunning ? ' timer-time--active' : ''}`}>
                {minutes}:{seconds}
              </span>
              <span className="timer-label">{config.label}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="controls">
            <button className="btn btn--secondary" onClick={reset} aria-label="Reset timer">
              ↻
            </button>
            <button className="btn btn--primary" onClick={toggleRunning}>
              {isRunning ? 'Pause' : 'Start'}
            </button>
          </div>
        </main>

        {/* Sessions */}
        <section className="sessions" aria-label="Session progress">
          <div className="sessions__block">
            <span className="sessions__value">{sessionsCompleted}</span>
            <span className="sessions__label">Sessions</span>
          </div>
          <div className="sessions__divider" />
          <div className="sessions__block">
            <div className="sessions__dots" aria-label={`${currentCycleSessions} of ${LONG_BREAK_INTERVAL} until long break`}>
              {dots.map((filled, i) => (
                <div
                  key={i}
                  className={`sessions__dot${filled ? ' sessions__dot--filled' : ''}`}
                />
              ))}
            </div>
            <span className="sessions__label">Until long break</span>
          </div>
        </section>

        {/* Keyboard hints */}
        <div className="keyboard-hints" aria-hidden="true">
          <div className="kbd-hint">
            <span className="kbd">Space</span> Start / Pause
          </div>
          <div className="kbd-hint">
            <span className="kbd">R</span> Reset
          </div>
        </div>
      </div>
    </>
  );
}
