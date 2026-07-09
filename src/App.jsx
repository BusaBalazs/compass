import React, { useState, useRef, useCallback, useEffect } from "react";

/* ------------------------------------------------------------------ */
/*  Puzzle constants                                                   */
/* ------------------------------------------------------------------ */
const RING_TARGET = 45; // ringRotation at which "NW" sits at the top
const NEEDLE_TARGET = 120; // target needle bearing (atan2 convention)
const RING_THRESHOLD = 3;
const NEEDLE_THRESHOLD = 2;

// Base (pre-rotation) angles for each compass label, in the same
// atan2(dy,dx) convention used everywhere below: 0deg = East (right),
// 90deg = South (down), 180deg = West (left), 270deg = North (up).
const COMPASS_POINTS = [
  { label: "N", base: 270 },
  { label: "NE", base: 315 },
  { label: "E", base: 0 },
  { label: "SE", base: 45 },
  { label: "S", base: 90 },
  { label: "SW", base: 135 },
  { label: "W", base: 180 },
  { label: "NW", base: 225 },
];

function normalizeAngle(a) {
  return ((a % 360) + 360) % 360;
}

function angleDiff(a, b) {
  const d = Math.abs(normalizeAngle(a) - normalizeAngle(b)) % 360;
  return d > 180 ? 360 - d : d;
}

function randomScrambledAngle(target, minDist = 30) {
  let a;
  do {
    a = Math.floor(Math.random() * 360);
  } while (angleDiff(a, target) < minDist);
  return a;
}

const CENTER = 200;
const deg2rad = (d) => (d * Math.PI) / 180;
const pointOnCircle = (angleDeg, radius) => ({
  x: CENTER + radius * Math.cos(deg2rad(angleDeg)),
  y: CENTER + radius * Math.sin(deg2rad(angleDeg)),
});

/* ------------------------------------------------------------------ */
/*  App                                                                */
/* ------------------------------------------------------------------ */

export default function App() {
  const [ringRotation, setRingRotation] = useState(() =>
    randomScrambledAngle(RING_TARGET),
  );
  const [ringLocked, setRingLocked] = useState(false);
  const [booting, setBooting] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [needleActive, setNeedleActive] = useState(false);
  const [needleAngle, setNeedleAngle] = useState(() =>
    randomScrambledAngle(NEEDLE_TARGET),
  );
  const [won, setWon] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const svgRef = useRef(null);
  const draggingRef = useRef(null); // 'ring' | 'needle' | null

  const getAngleFromEvent = useCallback((e) => {
    const svg = svgRef.current;
    if (!svg) return 0;
    const rect = svg.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    return normalizeAngle((Math.atan2(dy, dx) * 180) / Math.PI);
  }, []);

  const handleStartDrag = (e) => {
    if (won) return;
    let mode = null;
    if (!ringLocked) mode = "ring";
    else if (needleActive) mode = "needle";
    if (!mode) return;
    draggingRef.current = mode;
    e.target.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  };

  const handlePointerMove = (e) => {
    const mode = draggingRef.current;
    if (!mode) return;
    const angle = getAngleFromEvent(e);

    if (mode === "ring" && !ringLocked) {
      setRingRotation(angle);
      if (angleDiff(angle, RING_TARGET) <= RING_THRESHOLD) {
        draggingRef.current = null;
        setRingRotation(RING_TARGET);
        setRingLocked(true);
        setBooting(true);
      }
    } else if (mode === "needle" && needleActive && !won) {
      setNeedleAngle(angle);
      if (angleDiff(angle, NEEDLE_TARGET) <= NEEDLE_THRESHOLD) {
        draggingRef.current = null;
        setNeedleAngle(NEEDLE_TARGET);
        setWon(true);
      }
    }
  };

  const handlePointerUp = () => {
    draggingRef.current = null;
  };

  // Boot-up sequence: reveal the degree markings, then arm the needle.
  useEffect(() => {
    if (!booting) return;
    const t1 = setTimeout(() => setRevealed(true), 260);
    const t2 = setTimeout(() => {
      setBooting(false);
      setNeedleActive(true);
    }, 1100);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [booting]);

  // A short beat of "target localized" animation before the modal appears.
  useEffect(() => {
    if (!won) return;
    const t = setTimeout(() => setShowModal(true), 1300);
    return () => clearTimeout(t);
  }, [won]);

  const handleReset = () => {
    setShowModal(false);
    setWon(false);
    setNeedleActive(false);
    setRevealed(false);
    setBooting(false);
    setRingLocked(false);
    setRingRotation(randomScrambledAngle(RING_TARGET));
    setNeedleAngle(randomScrambledAngle(NEEDLE_TARGET));
  };

  const NEEDLE_LEN = 106;
  const tip = pointOnCircle(needleAngle, NEEDLE_LEN);
  const tailBack = pointOnCircle(needleAngle + 180, NEEDLE_LEN * 0.22);

  const accent = won ? "#39ff8f" : "#22e5ff";
  const accentDim = won ? "rgba(57,255,143,0.35)" : "rgba(34,229,255,0.35)";

  const statusText = won
    ? "FREKVENCIA ZÁROLVA"
    : ringLocked
      ? needleActive
        ? "ÁLLÍTSD BE A JELVEKTOR SZÖGÉT"
        : "KALIBRÁCIÓ FOLYAMATBAN..."
      : "FORGASD A VEKTORGYŰRŰT: Észak-Nyugati (NW) Irányba!";

  return (
    <div
      className="relative w-screen h-screen overflow-hidden select-none font-mono"
      style={{ touchAction: "none" }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Background photo */}
      <div
        className="absolute inset-0 bg-cover bg-no-repeat"
        style={{
          backgroundImage: "url('/bg.png')",
          backgroundPosition: "center 32%",
        }}
      />
      {/* Cinematic dark overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900/85 via-zinc-950/88 to-black/95" />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 50% 45%, transparent 38%, rgba(0,0,0,0.7) 100%)",
        }}
      />
      <div className="absolute inset-0 pointer-events-none scanline-faint" />
      {won && (
        <div className="absolute inset-0 pointer-events-none scanline-overlay z-20" />
      )}

      {/* HUD header */}
      <div className="absolute top-0 inset-x-0 z-30 px-4 pt-3 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="w-1.5 h-1.5 rounded-full hud-blink bg-[#22e5ff]"
            style={{ boxShadow: `0 0 8px 2px white` }}
          />
          <span className="text-[10px] sm:text-xs tracking-[0.25em] text-[#ffae00]">
            TACTICAL&nbsp;UPLINK
          </span>
        </div>
        <span className="text-[9px] sm:text-[10px] tracking-widest text-slate-500">
          SYS//v2.7.1
        </span>
      </div>

      {/* Title + live status */}
      <div className="absolute top-11 sm:top-14 inset-x-0 z-30 text-center px-6">
        <h1
          className="text-base sm:text-2xl tracking-[0.16em] font-semibold text-[#e8dcb8]"
          style={{
          
            textShadow: `0 0 16px ${accentDim}, 0 0 30px ${accentDim}`,
          }}
        >
          DIGITAL VECTOR DECRYPTER
        </h1>
        <p
          className="mt-1.5 text-[12px] sm:text-xs tracking-[0.14em] font-medium text-white"
         
        >
          {statusText}
        </p>
      </div>

      {/* ---------------- Compass rig ---------------- */}
      <div className="absolute inset-0 flex items-center justify-center z-10 px-4">
        <div
          className={`relative w-[84vw] max-w-[380px] aspect-square ${won ? "rig-win-pulse" : ""}`}
        >
          <svg
            ref={svgRef}
            viewBox="0 0 400 400"
            className="w-full h-full"
            style={{ touchAction: "none", overflow: "visible" }}
          >
            <defs>
              <pattern
                id="gridPattern"
                width="14"
                height="14"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M14 0 L0 0 0 14"
                  fill="none"
                  stroke="rgba(120,190,255,0.10)"
                  strokeWidth="0.6"
                />
              </pattern>
              <radialGradient id="faceGlow" cx="50%" cy="50%" r="50%">
                <stop
                  offset="0%"
                  stopColor={
                    won ? "rgba(57,255,143,0.12)" : "rgba(34,229,255,0.10)"
                  }
                />
                <stop offset="100%" stopColor="rgba(0,0,0,0)" />
              </radialGradient>
            </defs>

            {/* a) Outer matte-black bezel, static */}
            <circle
              cx="200"
              cy="200"
              r="196"
              fill="#0a0d12"
              stroke="#1a2530"
              strokeWidth="3"
            />
            <circle
              cx="200"
              cy="200"
              r="188"
              fill="none"
              stroke={accentDim}
              strokeWidth="1"
            />
            {Array.from({ length: 72 }).map((_, i) => {
              const a = i * 5;
              const isMajor = a % 45 === 0;
              const p1 = pointOnCircle(a, 196);
              const p2 = pointOnCircle(a, isMajor ? 183 : 190);
              return (
                <line
                  key={i}
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke={isMajor ? accentDim : "rgba(120,190,255,0.18)"}
                  strokeWidth={isMajor ? 1.4 : 0.7}
                />
              );
            })}

            {/* b) Rotatable outer vector ring */}
            <g
              style={{
                transformBox: "view-box",
                transformOrigin: "200px 200px",
                transform: `rotate(${ringRotation}deg)`,
                transition: ringLocked
                  ? "transform 0.45s cubic-bezier(0.34,1.56,0.64,1)"
                  : "none",
              }}
              className={ringLocked ? "ring-lock-pulse" : ""}
            >
              <circle
                cx="200"
                cy="200"
                r="168"
                fill="none"
                stroke={ringLocked ? accent : "#2b3d47"}
                strokeWidth="2"
              />
              <circle
                cx="200"
                cy="200"
                r="176"
                fill="none"
                stroke={ringLocked ? accent : "#2b3d47"}
                strokeWidth="1"
                opacity="0.6"
              />
              {COMPASS_POINTS.map((p) => {
                const tickOuter = pointOnCircle(p.base, 176);
                const tickInner = pointOnCircle(p.base, 160);
                const labelPos = pointOnCircle(p.base, 145);
                const isNW = p.label === "NW";
                return (
                  <g key={p.label}>
                    <line
                      x1={tickOuter.x}
                      y1={tickOuter.y}
                      x2={tickInner.x}
                      y2={tickInner.y}
                      stroke={
                        ringLocked ? accent : isNW ? "#7fd6ff" : "#4a6270"
                      }
                      strokeWidth="2"
                    />
                    <text
                      x={labelPos.x}
                      y={labelPos.y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize="15"
                      fontWeight="700"
                      fontFamily="'JetBrains Mono', monospace"
                      fill={ringLocked ? accent : isNW ? "#bdeeff" : "#8aa0ac"}
                      style={{ letterSpacing: "0.5px" }}
                    >
                      {p.label}
                    </text>
                  </g>
                );
              })}
              {/* minor ticks between cardinal points */}
              {Array.from({ length: 32 }).map((_, i) => {
                const a = i * 11.25;
                if (a % 45 < 1) return null;
                const p1 = pointOnCircle(a, 168);
                const p2 = pointOnCircle(a, 160);
                return (
                  <line
                    key={i}
                    x1={p1.x}
                    y1={p1.y}
                    x2={p2.x}
                    y2={p2.y}
                    stroke="#33474f"
                    strokeWidth="0.8"
                  />
                );
              })}
            </g>

            {/* Not-yet-locked grab hint */}
            {!ringLocked && (
              <circle
                cx="200"
                cy="200"
                r="168"
                fill="none"
                stroke="#22e5ff"
                strokeWidth="10"
                opacity="0.06"
                className="soft-pulse"
              />
            )}

            {/* d) Inner screen face */}
            <circle
              cx="200"
              cy="200"
              r="132"
              fill="#070a0e"
              stroke="#182229"
              strokeWidth="1.5"
            />
            <circle cx="200" cy="200" r="132" fill="url(#gridPattern)" />
            <circle cx="200" cy="200" r="132" fill="url(#faceGlow)" />

            {/* Degree sweep markings — hidden until revealed */}
            <g
              style={{
                opacity: revealed ? 1 : 0,
                transform: revealed ? "scale(1)" : "scale(0.7)",
                transformBox: "view-box",
                transformOrigin: "200px 200px",
                transition:
                  "opacity 0.85s cubic-bezier(0.16,1,0.3,1), transform 0.85s cubic-bezier(0.16,1,0.3,1)",
              }}
            >
              <circle
                cx="200"
                cy="200"
                r="122"
                fill="none"
                stroke={accentDim}
                strokeWidth="1"
              />
              <circle
                cx="200"
                cy="200"
                r="108"
                fill="none"
                stroke={accentDim}
                strokeWidth="0.6"
                opacity="0.6"
              />
              {Array.from({ length: 36 }).map((_, i) => {
                const a = i * 10;
                const isMajor = a % 30 === 0;
                const p1 = pointOnCircle(a, 122);
                const p2 = pointOnCircle(a, isMajor ? 108 : 115);
                return (
                  <line
                    key={i}
                    x1={p1.x}
                    y1={p1.y}
                    x2={p2.x}
                    y2={p2.y}
                    stroke={accent}
                    strokeWidth={isMajor ? 1.3 : 0.6}
                    opacity={isMajor ? 0.9 : 0.45}
                  />
                );
              })}
              {Array.from({ length: 12 }).map((_, i) => {
                const a = i * 30;
                const pos = pointOnCircle(a, 96);
                return (
                  <text
                    key={i}
                    x={pos.x}
                    y={pos.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="9.5"
                    fontFamily="'JetBrains Mono', monospace"
                    fill={accent}
                    opacity="0.85"
                  >
                    {a}°
                  </text>
                );
              })}
              {/* faint target tick, visible once the needle is armed */}
              {needleActive && !won && (
                <line
                  {...(() => {
                    const p1 = pointOnCircle(NEEDLE_TARGET, 122);
                    const p2 = pointOnCircle(NEEDLE_TARGET, 96);
                    return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
                  })()}
                  stroke="#ffb020"
                  strokeWidth="2"
                  opacity="0.55"
                  strokeDasharray="2 3"
                />
              )}
            </g>

            {/* Boot scanline sweep during calibration */}
            {booting && (
              <rect
                x="70"
                y="70"
                width="260"
                height="6"
                fill={accent}
                opacity="0.5"
                className="boot-scan"
              />
            )}

            {/* c) Needle */}
            <g
              style={{
                opacity: needleActive || won ? 1 : 0.25,
                transition: "opacity 0.4s",
              }}
            >
              <line
                x1={tailBack.x}
                y1={tailBack.y}
                x2={tip.x}
                y2={tip.y}
                stroke={accent}
                strokeWidth="3.2"
                strokeLinecap="round"
                style={{
                  filter:
                    needleActive || won
                      ? `drop-shadow(0 0 6px ${accent})`
                      : "none",
                }}
              />
              <circle
                cx={tip.x}
                cy={tip.y}
                r="5"
                fill={accent}
                style={{ filter: `drop-shadow(0 0 6px ${accent})` }}
              />
              <circle
                cx="200"
                cy="200"
                r="10"
                fill="#0d1319"
                stroke={accent}
                strokeWidth="2"
              />
              <circle cx="200" cy="200" r="3.5" fill={accent} />
            </g>

            {/* Single invisible hit-target for whichever control is currently active */}
            <circle
              cx="200"
              cy="200"
              r="196"
              fill="transparent"
              onPointerDown={handleStartDrag}
              style={{ cursor: won ? "default" : "grab" }}
            />
          </svg>
        </div>
      </div>

      {/* Bottom HUD panel — the clue / mission text */}
      <div className="absolute top-[125px] sm:bottom-8 inset-x-0 z-30 px-5 flex justify-center">
        <div
          className="max-w-md w-full rounded-xl border px-4 py-3 backdrop-blur-md"
          style={{
            padding: "11px 30px",
            border: "1px solid rgba(212,175,55,0.35)",
            borderRadius: 999,
            background: "rgba(10,13,20,0.65)",
            letterSpacing: "0.12em",
            fontSize: "0.1rem",
            backdropFilter: "blur(4px)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          }}
        >
          <p
            className="text-[.8rem] sm:text-xs leading-relaxed tracking-wide"
            style={{ color: "white" }}
          >
            <span
              className="font-bold text-[#e8dcb8]"
              
            >
              [SYSTEM OVERRIDE]
            </span>{" "}
            Állítsd a fővektort Észak-Nyugatra (NW), majd zárd le a frekvenciát
            a délután 4 órás időkódnak megfelelő fokon!
          </p>
        </div>
      </div>

      {/* ---------------- Win modal ---------------- */}
      {won && showModal && (
        <div
          className="absolute inset-0 z-40 flex items-center justify-center px-6 fade-in"
          style={{ background: "rgba(2,6,4,0.72)" }}
        >
          <div
            className="modal-in w-full max-w-sm rounded-2xl border px-7 py-8 text-center"
            style={{
              borderColor: "rgba(57,255,143,0.5)",
              background:
                "linear-gradient(160deg, #0b1a12 0%, #071009 60%, #050c07 100%)",
              boxShadow:
                "0 30px 80px rgba(0,0,0,0.7), 0 0 60px rgba(57,255,143,0.18)",
            }}
          >
            <svg
              width="34"
              height="34"
              viewBox="0 0 24 24"
              fill="none"
              className="mx-auto mb-4"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="#39ff8f"
                strokeWidth="1.3"
                opacity="0.85"
              />
              <path
                d="M8 12.5l2.5 2.5L16 9"
                stroke="#39ff8f"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <h2
              className="text-lg sm:text-xl font-bold tracking-wide mb-2"
              style={{
                color: "#c7ffe0",
                textShadow: "0 0 18px rgba(57,255,143,0.5)",
              }}
            >
              SIGNAL LOCKED.
              <br />
              TARGET LOCALIZED.
            </h2>
            <p
              className="text-[11px] sm:text-xs tracking-widest mb-7"
              style={{ color: "#6fe8a8" }}
            >
              VECTOR: NW &nbsp;//&nbsp; FREQ: 120° &nbsp;//&nbsp; STATUS:
              CONFIRMED
            </p>
            <button
              onClick={handleReset}
              className="w-full py-3 rounded-lg font-bold tracking-widest text-sm"
              style={{
                background:
                  "linear-gradient(160deg, #6dffb0 0%, #22c97a 55%, #159457 100%)",
                color: "#04170c",
                boxShadow: "0 8px 22px rgba(57,255,143,0.35)",
              }}
            >
              SYSTEM REBOOT (RESTART)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
