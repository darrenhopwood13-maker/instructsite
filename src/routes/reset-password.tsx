import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  validateSearch: (s: Record<string, unknown>) => ({
    next: typeof s.next === "string" && s.next.startsWith("/") ? s.next : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Reset password — instructSite" },
      { name: "description", content: "Choose a new password for your instructSite account." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/reset-password" });
  const nextPath = search.next;
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);
  const [ready, setReady] = useState(false);

  // Supabase auto-processes the recovery hash on load and creates a temporary session.
  // Poll for session presence rather than gating on hash tokens (PKCE flows omit them).
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted && data.session) setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY" || session) setReady(true);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const hasRecoveryLink = useMemo(() => {
    if (typeof window === "undefined") return false;
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const searchParams = new URLSearchParams(window.location.search);
    return (
      hashParams.get("type") === "recovery" ||
      searchParams.get("type") === "recovery" ||
      !!searchParams.get("code") ||
      ready
    );
  }, [ready]);


  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setComplete(true);
      if (nextPath) {
        setTimeout(() => navigate({ to: nextPath, replace: true }), 800);
      }
    } catch (e: any) {
      setError(e?.message ?? "Password reset failed. Please request a fresh reset email.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-background">
      <div className="aurora-bg opacity-40" />
      <div className="grain-overlay" />

      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center justify-center px-6 py-16">
        <div className="w-full max-w-md glass-panel border border-white/10 p-8">
          <div className="flex items-center gap-2 text-alert">
            <KeyRound size={16} />
            <span className="text-[0.65rem] font-bold uppercase tracking-[0.4em]">
              Password Reset
            </span>
          </div>

          <h1
            className="mt-4 text-3xl font-extrabold tracking-tight text-foreground"
            style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
          >
            Choose a new password
          </h1>

          {complete ? (
            <div className="mt-6 space-y-4">
              <div className="rounded-md border border-alert/45 bg-alert/10 px-3 py-2 text-sm text-foreground">
                Password updated. You can now sign in with the new password.
              </div>
              <button
                type="button"
                onClick={() => navigate({ to: "/auth", replace: true })}
                className="glass-orange shimmer-btn inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm uppercase tracking-wider"
              >
                <ArrowRight size={14} />
                Back to sign in
              </button>
            </div>
          ) : (
            <>
              <p className="mt-2 text-sm text-foreground/60">
                {hasRecoveryLink
                  ? "Enter and confirm the new password for this account."
                  : "Open the password reset link from your email before setting a new password."}
              </p>

              <form onSubmit={onSubmit} className="mt-6 space-y-4">
                <label className="block">
                  <span className="text-[0.6rem] font-bold uppercase tracking-[0.3em] text-foreground/60">
                    New password
                  </span>
                  <PasswordInput
                    value={password}
                    onChange={setPassword}
                    showPassword={showPassword}
                    onToggle={() => setShowPassword((value) => !value)}
                    autoComplete="new-password"
                  />
                </label>

                <label className="block">
                  <span className="text-[0.6rem] font-bold uppercase tracking-[0.3em] text-foreground/60">
                    Confirm password
                  </span>
                  <PasswordInput
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    showPassword={showPassword}
                    onToggle={() => setShowPassword((value) => !value)}
                    autoComplete="new-password"
                  />
                </label>

                {error && (
                  <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={busy || !hasRecoveryLink}
                  className="glass-orange shimmer-btn inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm uppercase tracking-wider disabled:opacity-50"
                >
                  {busy ? <Loader2 className="animate-spin" size={14} /> : <ArrowRight size={14} />}
                  Update password
                </button>
              </form>

              <button
                type="button"
                onClick={() => navigate({ to: "/auth", replace: true })}
                className="mt-6 w-full text-center text-[0.65rem] font-bold uppercase tracking-[0.3em] text-foreground/60 hover:text-foreground"
              >
                Back to sign in →
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PasswordInput({
  value,
  onChange,
  showPassword,
  onToggle,
  autoComplete,
}: {
  value: string;
  onChange: (value: string) => void;
  showPassword: boolean;
  onToggle: () => void;
  autoComplete: string;
}) {
  return (
    <div className="relative mt-1.5">
      <input
        type={showPassword ? "text" : "password"}
        required
        minLength={8}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        className="w-full rounded-md border border-white/15 bg-black/50 px-3 py-2.5 pr-11 text-sm text-foreground outline-none focus:border-alert"
      />
      <button
        type="button"
        aria-label={showPassword ? "Hide password" : "Show password"}
        onClick={onToggle}
        className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center text-foreground/55 hover:text-foreground"
      >
        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}