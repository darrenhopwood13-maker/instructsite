import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { z } from "zod";
import { unlockGate } from "@/lib/gate.functions";

const searchSchema = z.object({
  redirect: z.string().optional(),
  scope: z.enum(["site", "invite"]).optional(),
});

export const Route = createFileRoute("/unlock")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Preview Access — instructSite" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: UnlockPage,
});

function UnlockPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/unlock" });
  const unlockFn = useServerFn(unlockGate);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scope = search.scope ?? "site";
  const redirectTo = search.redirect && search.redirect.startsWith("/") ? search.redirect : "/";

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await unlockFn({ data: { password, scope } });
      if (!res.ok) {
        setError("Incorrect password.");
        setBusy(false);
        return;
      }
      // Hard reload so the root beforeLoad sees the fresh cookie without stale cache
      window.location.assign(redirectTo);
    } catch (err: any) {
      setError(err?.message ?? "Unlock failed.");
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center bg-background p-6">
      <div className="aurora-bg" />
      <div className="grain-overlay" />
      <form
        onSubmit={onSubmit}
        className="relative w-full max-w-md rounded-2xl border-2 border-alert bg-black/85 p-8 text-center shadow-[0_0_60px_rgba(255,80,0,0.35)]"
      >
        <ShieldCheck className="mx-auto text-alert" size={38} />
        <p className="mt-4 font-mono text-[0.6rem] font-bold uppercase tracking-[0.4em] text-alert">
          {scope === "invite" ? "Invite Verification" : "Preview Access"}
        </p>
        <h1
          className="mt-2 text-2xl font-black uppercase tracking-tight text-foreground"
          style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
        >
          {scope === "invite" ? "Confirm Site Password" : "Restricted Preview"}
        </h1>
        <p className="mt-3 text-sm text-foreground/70">
          {scope === "invite"
            ? "Enter the site password to unlock this subcontractor invite."
            : "This build is private. Enter the shared preview password to continue."}
        </p>

        <div className="mt-6 text-left">
          <label className="mb-1 block font-mono text-[0.55rem] uppercase tracking-widest text-foreground/60">
            Shared Password
          </label>
          <div className="flex items-center gap-2 rounded-md border border-alert/40 bg-black/60 px-3 py-2">
            <KeyRound size={14} className="text-alert" />
            <input
              type="password"
              autoFocus
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-transparent font-mono text-sm text-foreground outline-none"
              placeholder="••••••••"
            />
          </div>
          {error && (
            <p className="mt-2 font-mono text-[0.65rem] uppercase tracking-widest text-alert">
              {error}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={busy || !password.trim()}
          className="glass-orange shimmer-btn mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm uppercase tracking-[0.3em] disabled:opacity-40"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
          Enter
        </button>

        <p className="mt-4 font-mono text-[0.55rem] uppercase tracking-widest text-foreground/40">
          Session-scoped · 7 day cookie · not searchable
        </p>
      </form>
    </div>
  );
}
