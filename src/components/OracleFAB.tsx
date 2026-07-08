import { Link, useLocation } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

/**
 * Sticky bottom-right Oracle floating action button.
 * One-handed operation on mobile; respects safe-area insets.
 * Hidden on marketing / auth / onboarding surfaces where Oracle isn't relevant.
 */
const HIDE_PREFIXES = [
  "/auth",
  "/reset-password",
  "/unlock",
  "/pricing",
  "/experience",
  "/invite",
  "/trial-ended",
  "/.lovable",
  "/.mcp",
  "/.well-known",
  "/api",
];

export function OracleFAB() {
  const location = useLocation();
  const path = location.pathname;

  // Hide on marketing/auth surfaces AND on the home page — user is
  // signed-out landing, not inside a project.
  if (path === "/" || HIDE_PREFIXES.some((p) => path.startsWith(p))) return null;
  // Hide on Oracle itself — button navigates there.
  if (path === "/oracle") return null;

  return (
    <Link
      to="/oracle"
      aria-label="Open Oracle AI"
      className="oracle-fab fixed z-[60] grid place-items-center rounded-full text-white shadow-[0_16px_36px_-8px_rgba(139,92,246,0.65)] transition hover:scale-105 active:scale-95"
      style={{
        right: "max(1rem, env(safe-area-inset-right))",
        bottom: "max(1.25rem, calc(env(safe-area-inset-bottom) + 1rem))",
        width: "3.5rem",
        height: "3.5rem",
        background:
          "radial-gradient(circle at 30% 30%, #A78BFA 0%, #8B5CF6 55%, #6D28D9 100%)",
        border: "2px solid rgba(255,255,255,0.18)",
      }}
    >
      <Sparkles size={20} strokeWidth={2.2} />
      <span
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{
          background:
            "radial-gradient(circle at 70% 70%, rgba(251,146,60,0.18) 0%, transparent 60%)",
        }}
        aria-hidden
      />
    </Link>
  );
}
