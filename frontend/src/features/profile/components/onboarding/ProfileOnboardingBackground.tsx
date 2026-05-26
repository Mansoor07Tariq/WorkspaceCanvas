import { Box } from "@mui/material";
import { WorkspacesOutlined } from "@mui/icons-material";
import { keyframes } from "@mui/system";

// ─── Keyframes ───────────────────────────────────────────────────────────────

const gradientShift = keyframes({
  "0%, 100%": { backgroundPosition: "0% 50%" },
  "50%": { backgroundPosition: "100% 50%" },
});

const floatBlob1 = keyframes({
  "0%, 100%": { transform: "translate(0, 0)" },
  "50%": { transform: "translate(-20px, 24px)" },
});

const floatBlob2 = keyframes({
  "0%, 100%": { transform: "translate(0, 0)" },
  "50%": { transform: "translate(18px, -18px)" },
});

const floatMark = keyframes({
  "0%, 100%": { transform: "translateY(0)" },
  "50%": { transform: "translateY(-7px)" },
});

const sweepBeam = keyframes({
  "0%": { transform: "translateX(-120%) skewX(-20deg)" },
  "100%": { transform: "translateX(220%) skewX(-20deg)" },
});

const pulseRing = keyframes({
  "0%": { transform: "scale(0.1)", opacity: 0.6 },
  "70%": { opacity: 0.08 },
  "100%": { transform: "scale(2.4)", opacity: 0 },
});

const driftA = keyframes({
  "0%, 100%": { transform: "translate(0, 0)" },
  "33%": { transform: "translate(8px, -14px)" },
  "66%": { transform: "translate(-7px, 9px)" },
});

const driftB = keyframes({
  "0%, 100%": { transform: "translate(0, 0)" },
  "33%": { transform: "translate(-11px, 12px)" },
  "66%": { transform: "translate(13px, -7px)" },
});

// ─── Brand color helpers ─────────────────────────────────────────────────────

const blobBlue = (a: number) => `rgba(37,99,235,${a})`;
const blobViolet = (a: number) => `rgba(124,58,237,${a})`;
const blobTeal = (a: number) => `rgba(6,182,212,${a})`;

// ─── Static data ─────────────────────────────────────────────────────────────

interface LogoMark {
  top: string;
  left?: string;
  right?: string;
  size: number;
  rotate: number;
  delay: string;
  duration: string;
}

const LOGO_MARKS: LogoMark[] = [
  { top: "6%", left: "4%", size: 64, rotate: -20, delay: "0s", duration: "9s" },
  { top: "58%", left: "2%", size: 44, rotate: 14, delay: "2.2s", duration: "11s" },
  { top: "14%", right: "5%", size: 52, rotate: 18, delay: "3.5s", duration: "8s" },
  { top: "72%", right: "4%", size: 72, rotate: -9, delay: "1.4s", duration: "13s" },
  { top: "44%", left: "50%", size: 36, rotate: 6, delay: "4.1s", duration: "10s" },
];

interface Particle {
  top: string;
  left?: string;
  right?: string;
  size: number;
  color: string;
  delay: string;
  duration: string;
  drift: "A" | "B";
}

const PARTICLES: Particle[] = [
  {
    top: "12%",
    left: "18%",
    size: 5,
    color: blobBlue(0.28),
    delay: "0s",
    duration: "8s",
    drift: "A",
  },
  {
    top: "38%",
    left: "7%",
    size: 4,
    color: blobViolet(0.22),
    delay: "1.8s",
    duration: "10s",
    drift: "B",
  },
  {
    top: "58%",
    left: "28%",
    size: 6,
    color: blobBlue(0.2),
    delay: "3.5s",
    duration: "9s",
    drift: "A",
  },
  {
    top: "82%",
    left: "16%",
    size: 3,
    color: blobTeal(0.25),
    delay: "2s",
    duration: "12s",
    drift: "B",
  },
  {
    top: "8%",
    right: "22%",
    size: 5,
    color: blobViolet(0.22),
    delay: "4s",
    duration: "8s",
    drift: "A",
  },
  {
    top: "48%",
    right: "12%",
    size: 4,
    color: blobBlue(0.24),
    delay: "0.5s",
    duration: "11s",
    drift: "B",
  },
  {
    top: "76%",
    right: "28%",
    size: 5,
    color: blobTeal(0.2),
    delay: "5s",
    duration: "9s",
    drift: "A",
  },
];

interface PulseRingDef {
  top: string;
  left?: string;
  right?: string;
  size: number;
  color: string;
  delay: string;
  duration: string;
}

const PULSE_RINGS: PulseRingDef[] = [
  { top: "28%", left: "14%", size: 140, color: blobBlue(0.18), delay: "0s", duration: "6s" },
  { top: "60%", right: "16%", size: 120, color: blobViolet(0.15), delay: "3s", duration: "7s" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function ProfileOnboardingBackground() {
  return (
    <Box
      aria-hidden="true"
      sx={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: 0,
        background:
          "linear-gradient(150deg, #EEF2FF 0%, #E8EEFF 25%, #F0F5FF 50%, #EDE9FE 75%, #F5F0FF 100%)",
        backgroundSize: "300% 300%",
        "@media (prefers-reduced-motion: no-preference)": {
          animation: `${gradientShift} 18s ease infinite`,
        },
      }}
    >
      {/* ── Grid ── */}
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            `linear-gradient(${blobBlue(0.045)} 1px, transparent 1px), ` +
            `linear-gradient(90deg, ${blobBlue(0.045)} 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
        }}
      />

      {/* ── Radial orbs ── */}

      {/* Blue — top-right */}
      <Box
        sx={{
          position: "absolute",
          top: "-15%",
          right: "-8%",
          width: 520,
          height: 520,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${blobBlue(0.13)} 0%, transparent 70%)`,
          filter: "blur(40px)",
          "@media (prefers-reduced-motion: no-preference)": {
            animation: `${floatBlob1} 9s ease-in-out infinite`,
          },
        }}
      />

      {/* Violet — bottom-left */}
      <Box
        sx={{
          position: "absolute",
          bottom: "-12%",
          left: "-8%",
          width: 480,
          height: 480,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${blobViolet(0.1)} 0%, transparent 70%)`,
          filter: "blur(48px)",
          "@media (prefers-reduced-motion: no-preference)": {
            animation: `${floatBlob2} 12s ease-in-out infinite`,
          },
        }}
      />

      {/* Teal — top-left */}
      <Box
        sx={{
          position: "absolute",
          top: "-10%",
          left: "-6%",
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${blobTeal(0.09)} 0%, transparent 70%)`,
          filter: "blur(40px)",
          "@media (prefers-reduced-motion: no-preference)": {
            animation: `${floatBlob1} 14s ease-in-out infinite`,
            animationDelay: "5s",
          },
        }}
      />

      {/* Indigo — center-right (static accent) */}
      <Box
        sx={{
          position: "absolute",
          top: "40%",
          right: "-4%",
          width: 260,
          height: 260,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)",
          filter: "blur(32px)",
        }}
      />

      {/* ── Diagonal shimmer beam ── */}
      <Box
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "35%",
          height: "100%",
          background:
            "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.07) 50%, transparent 100%)",
          "@media (prefers-reduced-motion: no-preference)": {
            animation: `${sweepBeam} 14s linear infinite`,
            animationDelay: "2s",
          },
        }}
      />

      {/* ── Pulsing sonar rings ── */}
      {PULSE_RINGS.map(({ top, left, right, size, color, delay, duration }) => (
        <Box
          key={`ring-${top}-${left ?? right}`}
          sx={{
            position: "absolute",
            top,
            ...(left !== undefined ? { left } : {}),
            ...(right !== undefined ? { right } : {}),
            width: size,
            height: size,
            borderRadius: "50%",
            border: `2px solid ${color}`,
            "@media (prefers-reduced-motion: no-preference)": {
              animation: `${pulseRing} ${duration} ease-out infinite`,
              animationDelay: delay,
            },
          }}
        />
      ))}

      {/* ── Floating particles ── */}
      {PARTICLES.map(({ top, left, right, size, color, delay, duration, drift }) => (
        <Box
          key={`dot-${top}-${left ?? right}`}
          sx={{
            position: "absolute",
            top,
            ...(left !== undefined ? { left } : {}),
            ...(right !== undefined ? { right } : {}),
            width: size,
            height: size,
            borderRadius: "50%",
            background: color,
            boxShadow: `0 0 ${size * 3}px ${color}`,
            "@media (prefers-reduced-motion: no-preference)": {
              animation: `${drift === "A" ? driftA : driftB} ${duration} ease-in-out infinite`,
              animationDelay: delay,
            },
          }}
        />
      ))}

      {/* ── Floating WorkspaceCanvas logo marks ── */}
      {LOGO_MARKS.map(({ top, left, right, size, rotate, delay, duration }) => (
        <Box
          key={`mark-${top}-${left ?? right}`}
          sx={{
            position: "absolute",
            top,
            ...(left !== undefined ? { left } : {}),
            ...(right !== undefined ? { right } : {}),
            transform: `rotate(${rotate}deg)`,
            color: "primary.main",
            opacity: 0.038,
          }}
        >
          <Box
            sx={{
              "@media (prefers-reduced-motion: no-preference)": {
                animation: `${floatMark} ${duration} ease-in-out infinite`,
                animationDelay: delay,
              },
            }}
          >
            <WorkspacesOutlined sx={{ fontSize: size }} />
          </Box>
        </Box>
      ))}
    </Box>
  );
}
