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
  { hu: "É", en: "N", base: 270 },
  { hu: "ÉK", en: "NE", base: 315 },
  { hu: "K", en: "E", base: 0 },
  { hu: "DK", en: "SE", base: 45 },
  { hu: "D", en: "S", base: 90 },
  { hu: "DNY", en: "SW", base: 135 },
  { hu: "NY", en: "W", base: 180 },
  { hu: "ÉNY", en: "NW", base: 225 },
];

/* ------------------------------------------------------------------ */
/*  Bilingual copy                                                     */
/* ------------------------------------------------------------------ */
const COPY = {
  hu: {
    hudLabel: "KAPCSOLAT",
    overrideTag: "[RENDSZER FELÜLBÍRÁLÁS]",
    clue:
      "Tekerd a fővektort Észak-Nyugati irányba (ÉNY). Ezután zárd le a frekvenciát, forgasd a mutatót a délután 4 órás időkódnak megfelelő fokra. Figyeld a fok kiosztást!",
    statusWon: "FREKVENCIA ZÁROLVA",
    statusNeedle: "ÁLLÍTSD BE A JELVEKTOR SZÖGÉT",
    statusCalibrating: "KALIBRÁCIÓ FOLYAMATBAN...",
    statusRing: "FORGASD A VEKTORGYŰRŰT: Észak-Nyugati (ÉNY) Irányba!",
    modalTitle: (
      <>
        JEL ZÁROLVA.
        <br />
        CÉLPONT BEMÉRVE.
      </>
    ),
    modalSubtitle: "VEKTOR: ÉNY // FREKV: 120° // STÁTUSZ: MEGERŐSÍTVE",
    reset: "RENDSZER ÚJRAINDÍTÁS",
    back: "Vissza",
  },
  en: {
    hudLabel: "UPLINK",
    overrideTag: "[SYSTEM OVERRIDE]",
    clue:
      "Turn the main vector to North-West (NW). Then lock the frequency — rotate the needle to the degree matching the 4 PM time code. Watch the degree markings!",
    statusWon: "FREQUENCY LOCKED",
    statusNeedle: "SET THE SIGNAL VECTOR ANGLE",
    statusCalibrating: "CALIBRATION IN PROGRESS...",
    statusRing: "ROTATE THE VECTOR RING: North-West (NW) Direction!",
    modalTitle: (
      <>
        SIGNAL LOCKED.
        <br />
        TARGET LOCALIZED.
      </>
    ),
    modalSubtitle: "VECTOR: NW // FREQ: 120° // STATUS: CONFIRMED",
    reset: "SYSTEM REBOOT",
    back: "Back",
  },
};

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
const [lang, setLang] = useState("hu");
const t = COPY[lang];

const svgRef = useRef(null);
const draggingRef = useRef(null); // 'ring' | 'needle' | null

/* ------------------------------------------------------------------ */
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

/* ------------------------------------------------------------------ */
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

/* ------------------------------------------------------------------ */
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

/* ------------------------------------------------------------------ */
const handlePointerUp = () => {
  draggingRef.current = null;
};

/* ------------------------------------------------------------------ */
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

/* ------------------------------------------------------------------ */
// A short beat of "target localized" animation before the modal appears.
useEffect(() => {
  if (!won) return;
  const t = setTimeout(() => setShowModal(true), 1300);
  return () => clearTimeout(t);
}, [won]);

/* ------------------------------------------------------------------ */
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

const accent = won ? "#f7d976" : "#d9c17e";
const accentDim = won ? "rgba(247,217,118,0.35)" : "rgba(217,193,126,0.35)";

const statusText = won
? t.statusWon
: ringLocked
? needleActive
? t.statusNeedle
: t.statusCalibrating
: t.statusRing;

/* ------------------------------------------------------------------ */
return (
  <div
  className="relative min-h-[100dvh] w-full overflow-x-hidden overflow-y-auto pb-20 select-none font-serif"
  style={{ touchAction: "pan-y", overscrollBehavior: "auto" }}
  onPointerMove={handlePointerMove}
  onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Background photo */}
      <div
        className="absolute inset-0 bg-cover bg-no-repeat"
        style={{
          backgroundImage: "url('/compass/bg_blur_comp.png')",
          backgroundPosition: "center 32%",
        }}
      />
      {/* Cinematic dark overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#1b232b]/25 via-[#11161c]/55 to-black/78" />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 50% 45%, transparent 45%, rgba(5,8,10,0.55) 100%)",
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
            className="w-1.5 h-1.5 rounded-full hud-blink bg-[#d9c17e]"
            style={{ boxShadow: `0 0 8px 2px white` }}
          />
          <span className="font-display text-[10px] sm:text-xs tracking-[0.25em] text-[#e2cf8f]">
            {t.hudLabel}
          </span>
        </div>
        <button
          onClick={() => setLang((l) => (l === "hu" ? "en" : "hu"))}
          className="font-display text-[10px] sm:text-[11px] tracking-[0.2em] px-3 py-1 rounded-full border"
          style={{
            borderColor: "rgba(217,193,126,0.5)",
            background: "rgba(16,20,26,0.45)",
            color: "#f0dfa8",
          }}
        >
          {lang.toUpperCase()}
        </button>
      </div>

      {/* Bottom HUD panel — the clue / mission text */}
      <div className=" sm:bottom-8 inset-x-0 px-5 mt-12">
        <div
          className="max-w-md w-full rounded-xl border backdrop-blur-md"
          style={{
            border: "1px solid rgba(212,175,55,0.35)",
            background: "rgba(14,18,23,0.48)",
            letterSpacing: "0.03em",
            fontSize: "0.1rem",
            backdropFilter: "blur(4px)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          }}
        >
          <p
            className="font-serif italic text-[1.05rem] sm:text-sm leading-relaxed tracking-wide p-5"
            style={{ color: "#eceae0" }}
          >
            <span className="font-display not-italic font-semibold text-[0.85em] tracking-[0.1em] text-[#f0dfa0]">
              {t.overrideTag}
            </span>{" "}
            {t.clue}
          </p>
        </div>
      </div>

      {/* Title + live status */}
      <div className="relative  inset-x-0 z-30 text-center px-6">
        <p className="font-display mt-6 text-[12px] sm:text-xs tracking-[0.14em] font-medium text-[#eceae0]">
          {statusText}
        </p>
      </div>

      {/* ---------------- Compass rig ---------------- */}
      <div
        className="mt-6 flex w-full items-center justify-center px-4 pb-6"
        style={{ touchAction: "none" }}
      >
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
                  stroke="rgba(150,175,190,0.10)"
                  strokeWidth="0.6"
                />
              </pattern>
              <radialGradient id="faceGlow" cx="50%" cy="50%" r="50%">
                <stop
                  offset="0%"
                  stopColor={
                    won ? "rgba(244,209,107,0.14)" : "rgba(203,178,106,0.10)"
                  }
                />
                <stop offset="100%" stopColor="rgba(0,0,0,0)" />
              </radialGradient>
            </defs>

            {/* a) Outer matte bezel, static */}
            <circle
              cx="200"
              cy="200"
              r="196"
              fill="#141a20"
              stroke="#2c3a44"
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
                  stroke={isMajor ? accentDim : "rgba(150,175,190,0.16)"}
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
                stroke={ringLocked ? accent : "#33424c"}
                strokeWidth="2"
              />
              <circle
                cx="200"
                cy="200"
                r="176"
                fill="none"
                stroke={ringLocked ? accent : "#33424c"}
                strokeWidth="1"
                opacity="0.6"
              />
              {COMPASS_POINTS.map((p) => {
                const tickOuter = pointOnCircle(p.base, 176);
                const tickInner = pointOnCircle(p.base, 160);
                const labelPos = pointOnCircle(p.base, 145);
                const isNW = p.base === 225;
                const label = lang === "hu" ? p.hu : p.en;
                return (
                  <g key={label}>
                    <line
                      x1={tickOuter.x}
                      y1={tickOuter.y}
                      x2={tickInner.x}
                      y2={tickInner.y}
                      stroke={
                        ringLocked ? accent : isNW ? "#e8c874" : "#5a6b78"
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
                      fontFamily="'Cinzel', serif"
                      fill={ringLocked ? accent : isNW ? "#f3dfa0" : "#93a3ad"}
                      style={{ letterSpacing: "0.5px" }}
                    >
                      {label}
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
                    stroke="#33424c"
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
                stroke="#d9c17e"
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
              fill="#11161c"
              stroke="#28323b"
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
                fill="#12171d"
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
              onPointerDown={(e) => {
                e.preventDefault();
                handleStartDrag(e);
              }}
              style={{ cursor: won ? "default" : "grab" }}
            />
          </svg>
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
              borderColor: "rgba(244,209,107,0.5)",
              background:
                "linear-gradient(160deg, #141a20 0%, #0d1216 60%, #090c0f 100%)",
              boxShadow:
                "0 30px 80px rgba(0,0,0,0.7), 0 0 60px rgba(244,209,107,0.18)",
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
                stroke="#f4d16b"
                strokeWidth="1.3"
                opacity="0.85"
              />
              <path
                d="M8 12.5l2.5 2.5L16 9"
                stroke="#f4d16b"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <h2
              className="font-display text-lg sm:text-xl font-bold tracking-wide mb-2"
              style={{
                color: "#f7ecc9",
                textShadow: "0 0 18px rgba(244,209,107,0.5)",
              }}
            >
              {t.modalTitle}
            </h2>
            <p
              className="text-[11px] sm:text-xs tracking-widest mb-7"
              style={{ color: "#e8d9a8" }}
            >
              {t.modalSubtitle}
            </p>
            <button
              onClick={handleReset}
              className="font-display w-full py-3 rounded-lg font-bold tracking-widest text-sm"
              style={{
                background:
                  "linear-gradient(160deg, #f5dfa0 0%, #cf9d3e 55%, #9c7222 100%)",
                color: "#241a08",
                boxShadow: "0 8px 22px rgba(203,151,50,0.35)",
              }}
            >
              {t.reset}
            </button>

            <div className="relative z-20 mt-6 flex justify-center px-5">
              <button className="font-display w-full max-w-xs rounded-lg border border-amber-400/40 bg-black/70 px-4 py-3 text-sm font-semibold tracking-[0.25em] text-amber-200 shadow-[0_0_18px_rgba(203,178,106,0.16)]">
                <a href="https://leprimore-demo.netlify.app/">{t.back}</a>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
