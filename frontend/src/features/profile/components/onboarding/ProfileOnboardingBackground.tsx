import { Box } from "@mui/material";
import { WorkspacesOutlined } from "@mui/icons-material";
import { keyframes } from "@mui/system";

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
        background: "linear-gradient(150deg, #EEF2FF 0%, #F0F5FF 48%, #F5F0FF 100%)",
      }}
    >
      {/* Subtle grid */}
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(37,99,235,0.045) 1px, transparent 1px), " +
            "linear-gradient(90deg, rgba(37,99,235,0.045) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Blue radial orb — top-right */}
      <Box
        sx={{
          position: "absolute",
          top: "-15%",
          right: "-8%",
          width: 520,
          height: 520,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(37,99,235,0.13) 0%, transparent 70%)",
          filter: "blur(40px)",
          "@media (prefers-reduced-motion: no-preference)": {
            animation: `${floatBlob1} 9s ease-in-out infinite`,
          },
        }}
      />

      {/* Violet radial orb — bottom-left */}
      <Box
        sx={{
          position: "absolute",
          bottom: "-12%",
          left: "-8%",
          width: 480,
          height: 480,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(124,58,237,0.10) 0%, transparent 70%)",
          filter: "blur(48px)",
          "@media (prefers-reduced-motion: no-preference)": {
            animation: `${floatBlob2} 12s ease-in-out infinite`,
          },
        }}
      />

      {/* Small indigo accent — center-right */}
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

      {/* Floating WorkspaceCanvas logo marks */}
      {LOGO_MARKS.map(({ top, left, right, size, rotate, delay, duration }, i) => (
        <Box
          key={i}
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
