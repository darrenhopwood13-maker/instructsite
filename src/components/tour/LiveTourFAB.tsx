import { useCallback, useState } from "react";
import { useFabVisibility } from "@/hooks/use-fab-visibility";
import { useRouterState } from "@tanstack/react-router";
import { Compass } from "lucide-react";
import { LiveTourOverlay } from "./LiveTourOverlay";
import { buildTourSteps, DEMO_PROJECT_ID } from "./tour-steps";

/**
 * Floating "Start Tour" trigger + the live tour itself.
 * Mirrors the OracleFAB corner-anchored FAB language so it feels native.
 */
const HIDE_PREFIXES = [
  "/auth",
  "/reset-password",
  "/unlock",
  "/pricing",
  "/experience",
  "/invite",
  "/join-org",
  "/trial-ended",
  "/.lovable",
  "/.mcp",
  "/.well-known",
  "/api",
];

export function LiveTourFAB() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const fabVisible = useFabVisibility();

  const start = useCallback(() => {
    setIndex(0);
    setOpen(true);
  }, []);

  const hidden = pathname === "/" || HIDE_PREFIXES.some((p) => pathname.startsWith(p));

  // Prefer the project already being viewed; otherwise the demo project.
  const match = /\/(?:projects_?|programme|dabs)\/([0-9a-f-]{36})/.exec(pathname);
  const projectId = match?.[1] ?? DEMO_PROJECT_ID;
  const steps = buildTourSteps(projectId);

  if (hidden && !open) return null;

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={start}
          aria-label="Start guided tour"
          className={`fixed z-[60] inline-flex h-12 w-12 items-center justify-center gap-2 rounded-full text-white shadow-[0_16px_36px_-8px_rgba(234,88,12,0.6)] transition duration-200 hover:scale-105 active:scale-95 sm:w-auto sm:px-4 ${
            fabVisible
              ? "pointer-events-auto translate-y-0 opacity-100"
              : "pointer-events-none translate-y-6 opacity-0"
          }`}
          style={{
            right: "max(1rem, env(safe-area-inset-right))",
            bottom: "max(5.5rem, calc(env(safe-area-inset-bottom) + 5.25rem))",
            background:
              "radial-gradient(circle at 30% 30%, hsl(28 100% 62%) 0%, hsl(22 100% 54%) 55%, hsl(16 90% 44%) 100%)",
            border: "2px solid rgba(255,255,255,0.18)",
          }}
        >
          <Compass size={18} strokeWidth={2.2} />
          <span className="hidden text-[0.6rem] font-bold uppercase tracking-[0.2em] sm:inline">
            Start Tour
          </span>
        </button>
      )}

      {open && (
        <LiveTourOverlay
          steps={steps}
          index={index}
          onIndex={setIndex}
          onExit={() => setOpen(false)}
        />
      )}
    </>
  );
}
