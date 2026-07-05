import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getMyRoles } from "@/lib/projects.functions";
import { routeForRoles } from "@/lib/ensure-oracle-session";
import { Loader2, ShieldAlert, ArrowRight, Eye, EyeOff, MailCheck } from "lucide-react";
import { z } from "zod";

const searchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — instructSite" },
      { name: "description", content: "Secure access to the Oracle command portal." },
    ],
  }),
  validateSearch: (s) => searchSchema.parse(s),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "forgot";

function AuthPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth" });
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // If already signed in, route by role
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user?.id) await routeSignedIn();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const routeSignedIn = async () => {
    try {
      const roles = await getMyRoles();
      const target = search.redirect && search.redirect.startsWith("/") ? search.redirect : routeForRoles(roles.roles);
      navigate({ to: target, replace: true });
    } catch {
      navigate({ to: "/projects", replace: true });
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setNotice("Password reset email sent. Open the link in that email, then set a new password.");
        return;
      }

      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth`,
            data: fullName ? { full_name: fullName } : undefined,
          },
        });
        if (error) throw error;
      }
      await routeSignedIn();
    } catch (e: any) {
      const msg = e?.message ?? "Authentication failed.";
      if (/invalid login credentials/i.test(msg)) {
        setError("Invalid email or password.");
      } else if (/user already registered/i.test(msg)) {
        setError("An account with this email already exists. Try signing in.");
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-background">
      <div className="aurora-bg opacity-40" />
      <div className="grain-overlay" />

      <div className="relative mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl grid-cols-1 items-center gap-16 px-6 py-16 lg:grid-cols-2">
        {/* Editorial left column */}
        <div className="hidden flex-col justify-between border-r border-white/10 pr-16 lg:flex" style={{ minHeight: 560 }}>
          <div>
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.5em] text-alert">
              Restricted Portal
            </p>
            <h1
              className="mt-6 text-6xl font-extrabold leading-[0.95] tracking-tight text-foreground"
              style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
            >
              Site
              <br />
              Operations
              <br />
              Oracle.
            </h1>
            <div className="mt-8 h-px w-24 bg-alert" />
            <p className="mt-6 max-w-md text-sm leading-relaxed text-foreground/70">
              Command surface for site managers, quantity surveyors, and trade partners.
              Every action is audited. Every zone is watched. Access is strictly
              role-scoped — no anonymous entry.
            </p>
          </div>
          <div className="mt-10 grid grid-cols-3 gap-6 border-t border-white/10 pt-6 text-[0.6rem] uppercase tracking-[0.3em] text-foreground/50">
            <div>
              <p className="text-foreground/90">DABS</p>
              <p className="mt-1">Daily briefings</p>
            </div>
            <div>
              <p className="text-foreground/90">IFC</p>
              <p className="mt-1">Live 3D model</p>
            </div>
            <div>
              <p className="text-foreground/90">QS</p>
              <p className="mt-1">Verified progress</p>
            </div>
          </div>
        </div>

        {/* Auth card */}
        <div className="mx-auto w-full max-w-md">
          <div className="glass-panel border border-white/10 p-8">
            <div className="flex items-center gap-2 text-alert">
              {mode === "forgot" ? <MailCheck size={16} /> : <ShieldAlert size={16} />}
              <span className="text-[0.65rem] font-bold uppercase tracking-[0.4em]">
                {mode === "signin" ? "Secure Sign In" : mode === "signup" ? "Create Access" : "Password Recovery"}
              </span>
            </div>
            <h2
              className="mt-4 text-3xl font-extrabold tracking-tight text-foreground"
              style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
            >
              {mode === "signin" ? "Enter the portal" : mode === "signup" ? "Request access" : "Reset password"}
            </h2>
            <p className="mt-2 text-sm text-foreground/60">
              {mode === "signin"
                ? "Sign in with your workspace credentials to route into your role."
                : mode === "signup"
                  ? "New workspace account. Existing invites will be redeemed automatically."
                  : "Enter your email and we’ll send a secure link to choose a new password."}
            </p>

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              {mode === "signup" && (
                <label className="block">
                  <span className="text-[0.6rem] font-bold uppercase tracking-[0.3em] text-foreground/60">
                    Full name
                  </span>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    autoComplete="name"
                    className="mt-1.5 w-full rounded-md border border-white/15 bg-black/50 px-3 py-2.5 text-sm text-foreground outline-none focus:border-alert"
                  />
                </label>
              )}

              <label className="block">
                <span className="text-[0.6rem] font-bold uppercase tracking-[0.3em] text-foreground/60">
                  Email
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className="mt-1.5 w-full rounded-md border border-white/15 bg-black/50 px-3 py-2.5 text-sm text-foreground outline-none focus:border-alert"
                />
              </label>

              {mode !== "forgot" && (
                <label className="block">
                  <span className="text-[0.6rem] font-bold uppercase tracking-[0.3em] text-foreground/60">
                    Password
                  </span>
                  <div className="relative mt-1.5">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete={mode === "signin" ? "current-password" : "new-password"}
                      className="w-full rounded-md border border-white/15 bg-black/50 px-3 py-2.5 pr-11 text-sm text-foreground outline-none focus:border-alert"
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center text-foreground/55 hover:text-foreground"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </label>
              )}

              {error && (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground">
                  {error}
                </div>
              )}

              {notice && (
                <div className="rounded-md border border-alert/45 bg-alert/10 px-3 py-2 text-xs text-foreground">
                  {notice}
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="glass-orange shimmer-btn inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm uppercase tracking-wider disabled:opacity-50"
              >
                {busy ? <Loader2 className="animate-spin" size={14} /> : <ArrowRight size={14} />}
                {mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset email"}
              </button>
            </form>

            {mode === "signin" && (
              <button
                type="button"
                onClick={() => {
                  setMode("forgot");
                  setError(null);
                  setNotice(null);
                }}
                className="mt-4 w-full text-center text-[0.65rem] font-bold uppercase tracking-[0.3em] text-alert hover:text-foreground"
              >
                Forgot password?
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setError(null);
                setNotice(null);
              }}
              className="mt-6 w-full text-center text-[0.65rem] font-bold uppercase tracking-[0.3em] text-foreground/60 hover:text-foreground"
            >
              {mode === "signin"
                ? "No account? Request access →"
                : mode === "signup"
                  ? "Already registered? Sign in →"
                  : "Back to sign in →"}
            </button>
          </div>

          <p className="mt-4 text-center text-[0.6rem] uppercase tracking-[0.3em] text-foreground/40">
            Anonymous access disabled · Enterprise policy
          </p>
        </div>
      </div>
    </div>
  );
}
