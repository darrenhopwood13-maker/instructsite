import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getMyRoles } from "@/lib/projects.functions";
import { getMyProfile, initMyProfile } from "@/lib/profiles.functions";
import { routeForRoles } from "@/lib/ensure-oracle-session";
import {
  Loader2, ShieldAlert, ArrowRight, Eye, EyeOff, MailCheck,
  HardHat, Wrench, GraduationCap, Calculator, Sparkles, PhoneCall,
  Smartphone,
} from "lucide-react";
import { z } from "zod";

const searchSchema = z.object({
  redirect: z.string().optional(),
  trial: z.enum(["start"]).optional(),
});

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — instructSite" },
      { name: "description", content: "Secure access to the instructSite command portal." },
    ],
  }),
  validateSearch: (s) => searchSchema.parse(s),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "forgot";
type RoleChoice = "site_manager" | "subcontractor" | "apprentice" | "qs";

const ROLE_OPTIONS: { value: RoleChoice; label: string; icon: any; desc: string }[] = [
  { value: "site_manager",  label: "Site Manager",  icon: HardHat,        desc: "Zones, DABS, permits" },
  { value: "subcontractor", label: "Subcontractor", icon: Wrench,         desc: "Trade packages & sign-in" },
  { value: "apprentice",    label: "Apprentice",    icon: GraduationCap,  desc: "Guided plain-English briefs" },
  { value: "qs",            label: "QS",            icon: Calculator,     desc: "Verified progress & photo QA" },
];

const BANNER_ITEMS = [
  "✨ NEW · Randall AI auto-allocates 10,000+ BIM elements in seconds",
  "🧠 Turn 2D drawings into plain-English sequences instantly",
  "🛰️ Live IFC — zones flip green on QS approval",
  "🚨 High-risk auto-flagging with digital permit sign-off",
  "📸 Photo-verified daily diaries with force-checkout",
  "🎯 Role-tailored dashboards for Managers, QS, Subs & Apprentices",
];


function InstallPwaButton() {
  const [deferred, setDeferred] = useState<any>(null);
  const [installed, setInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const iOS = /iPhone|iPad|iPod/i.test(ua) && !/CriOS|FxiOS/i.test(ua);
    setIsIos(iOS);
    const isStandalone =
      typeof window !== "undefined" &&
      (window.matchMedia?.("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true);
    setInstalled(isStandalone);
    const handler = (e: any) => {
      e.preventDefault();
      setDeferred(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setInstalled(true));
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (installed) return null;

  const onClick = async () => {
    if (isIos) {
      setShowIosHint(true);
      return;
    }
    if (!deferred) {
      setShowIosHint(true);
      return;
    }
    deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  };

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        className="fixed left-4 top-4 z-50 flex items-center gap-2 rounded-full border border-alert/60 bg-alert/15 px-3 py-1.5 text-[0.6rem] font-bold uppercase tracking-[0.28em] text-alert shadow-lg backdrop-blur"
      >
        <Smartphone size={12} /> Add to Home Screen
      </button>
      {showIosHint && (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 backdrop-blur"
          onClick={() => setShowIosHint(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="cockpit-sheet w-full max-w-md rounded-t-2xl border-2 border-alert/60 bg-background p-5 text-sm text-foreground"
          >
            <p className="text-[0.6rem] font-bold uppercase tracking-[0.32em] text-alert">
              Install instructSite
            </p>
            <p className="mt-2">
              {isIos
                ? "In Safari, tap the Share icon, then choose \"Add to Home Screen\"."
                : "Open the browser menu and choose \"Install app\" or \"Add to Home screen\"."}
            </p>
            <button
              type="button"
              onClick={() => setShowIosHint(false)}
              className="mt-4 w-full rounded-lg border border-white/20 bg-white/5 py-2 text-[0.7rem] font-bold uppercase tracking-widest"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function ScrollingBannerReal() {
  const items = [...BANNER_ITEMS, ...BANNER_ITEMS];
  return (
    <div className="relative overflow-hidden border-y-2 border-alert bg-gradient-to-r from-[#ff7a00] via-[#ffb057] to-[#ff7a00] py-3 shadow-[0_10px_30px_-10px_rgba(255,122,0,0.6)]"
         style={{ boxShadow: "inset 0 2px 0 rgba(255,255,255,0.4), inset 0 -2px 0 rgba(0,0,0,0.25), 0 12px 32px -10px rgba(255,122,0,0.55)" }}>
      <div className="marquee-track text-sm font-black uppercase tracking-[0.25em] text-[#0b1e3f]">
        {items.map((t, i) => (
          <span key={i} className="inline-flex items-center gap-3">
            <Sparkles size={14} className="text-[#0b1e3f]" />
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

function BookDemoFAB() {
  return (
    <a
      href="mailto:info@instructsite.com?subject=Book%20a%20demo%20—%20instructSite"
      className="btn-3d-orange float-y fixed bottom-6 right-6 z-50 inline-flex items-center gap-2 rounded-full px-5 py-3 text-xs uppercase tracking-[0.3em]"
    >
      <PhoneCall size={14} /> Book a demo
    </a>
  );
}

function AuthPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth" });
  const [mode, setMode] = useState<Mode>(search.trial === "start" ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<RoleChoice | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user?.id) await routeSignedIn();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const routeSignedIn = async () => {
    try {
      // Trial gate
      try {
        const profile = await getMyProfile();
        if (profile?.trial_ends_at) {
          const expired = new Date(profile.trial_ends_at).getTime() < Date.now();
          if (expired) {
            const roles = await getMyRoles();
            if (!roles.roles.includes("master_admin") && !roles.roles.includes("project_admin")) {
              await supabase.auth.signOut();
              navigate({ to: "/trial-ended", replace: true });
              return;
            }
          }
        }
      } catch { /* profile check best-effort */ }

      const roles = await getMyRoles();
      const target = search.redirect && search.redirect.startsWith("/")
        ? search.redirect
        : routeForRoles(roles.roles);
      navigate({ to: target, replace: true });
    } catch {
      navigate({ to: "/projects", replace: true });
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (mode === "signup" && !role) {
      setError("Please select your role to tailor your experience.");
      return;
    }

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

        // Initialise profile + role selection (trial_ends_at auto-set by DB default)
        try {
          await initMyProfile({ data: { fullName: fullName || undefined, selectedRole: role! } });
        } catch (err) {
          console.warn("initMyProfile failed", err);
        }
      }
      await routeSignedIn();
    } catch (e: any) {
      const msg = e?.message ?? "Authentication failed.";
      if (/invalid login credentials/i.test(msg)) setError("Invalid email or password.");
      else if (/user already registered/i.test(msg)) setError("An account with this email already exists. Try signing in.");
      else setError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden">
      <BookDemoFAB />
      <ScrollingBanner />

      <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-start gap-12 px-6 py-12 lg:grid-cols-2">
        {/* Left column — trial pitch */}
        <div className="hidden flex-col justify-between border-r border-white/10 pr-12 lg:flex" style={{ minHeight: 560 }}>
          <div>
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.5em] text-alert">
              7-Day Free Trial · No card required
            </p>
            <h1 className="mt-6 text-4xl sm:text-5xl md:text-6xl font-extrabold leading-[0.9] tracking-tight text-foreground"
                style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}>
              <span className="block sm:inline">instruct</span><span className="block sm:inline" style={{ color: "#ff7a00" }}>Site</span>
            </h1>

            <div className="mt-8 h-px w-24 bg-alert" />
            <p className="mt-6 max-w-md text-sm leading-relaxed text-foreground/80">
              Start free — explore Randall AI auto-allocation, live IFC zone tracking, permit
              sign-off and QS verification. After 7 days, contact us to continue:
              <br />
              <a href="mailto:info@instructsite.com" className="text-alert underline">info@instructsite.com</a>
            </p>
          </div>
          <div className="mt-10 grid grid-cols-2 gap-3">
            {ROLE_OPTIONS.map((r) => {
              const Icon = r.icon;
              return (
                <div key={r.value} className="rounded-md border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center gap-2 text-alert">
                    <Icon size={14} />
                    <span className="text-[0.6rem] font-bold uppercase tracking-[0.3em]">{r.label}</span>
                  </div>
                  <p className="mt-1 text-xs text-foreground/70">{r.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Auth card */}
        <div className="mx-auto w-full max-w-md">
          <div className="glass-panel border border-white/10 p-8">
            <div className="flex items-center gap-2 text-alert">
              {mode === "forgot" ? <MailCheck size={16} /> : <ShieldAlert size={16} />}
              <span className="text-[0.65rem] font-bold uppercase tracking-[0.4em]">
                {mode === "signin" ? "Secure Sign In" : mode === "signup" ? "Start Free Trial" : "Password Recovery"}
              </span>
            </div>
            <h2 className="mt-4 text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground break-words"
                style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}>
              {mode === "signin" ? "Enter the portal" : mode === "signup" ? "Create your account" : "Reset password"}
            </h2>

            <p className="mt-2 text-sm text-foreground/60">
              {mode === "signin"
                ? "Sign in with your workspace credentials."
                : mode === "signup"
                  ? "7 days free — no payment details required."
                  : "Enter your email and we’ll send a secure link."}
            </p>

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              {mode === "signup" && (
                <>
                  <label className="block">
                    <span className="text-[0.6rem] font-bold uppercase tracking-[0.3em] text-foreground/60">Full name</span>
                    <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
                           autoComplete="name"
                           className="mt-1.5 w-full rounded-md border border-white/15 bg-black/50 px-3 py-2.5 text-sm text-foreground outline-none focus:border-alert" />
                  </label>

                  <div>
                    <span className="text-[0.6rem] font-bold uppercase tracking-[0.3em] text-foreground/60">Your role</span>
                    <div className="mt-1.5 grid grid-cols-2 gap-2">
                      {ROLE_OPTIONS.map((r) => {
                        const Icon = r.icon;
                        const selected = role === r.value;
                        return (
                          <button type="button" key={r.value} onClick={() => setRole(r.value)}
                                  className={`flex flex-col items-start gap-1 rounded-md border p-2.5 text-left transition ${
                                    selected
                                      ? "border-alert bg-alert/15 shadow-[0_0_0_1px_rgba(255,122,0,0.5)]"
                                      : "border-white/15 bg-black/40 hover:border-alert/60"
                                  }`}>
                            <div className="flex items-center gap-2 text-alert">
                              <Icon size={14} />
                              <span className="text-[0.6rem] font-bold uppercase tracking-[0.25em] text-foreground">{r.label}</span>
                            </div>
                            <span className="text-[0.65rem] text-foreground/60">{r.desc}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              <label className="block">
                <span className="text-[0.6rem] font-bold uppercase tracking-[0.3em] text-foreground/60">Email</span>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email"
                       className="mt-1.5 w-full rounded-md border border-white/15 bg-black/50 px-3 py-2.5 text-sm text-foreground outline-none focus:border-alert" />
              </label>

              {mode !== "forgot" && (
                <label className="block">
                  <span className="text-[0.6rem] font-bold uppercase tracking-[0.3em] text-foreground/60">Password</span>
                  <div className="relative mt-1.5">
                    <input type={showPassword ? "text" : "password"} required minLength={8}
                           value={password} onChange={(e) => setPassword(e.target.value)}
                           autoComplete={mode === "signin" ? "current-password" : "new-password"}
                           className="w-full rounded-md border border-white/15 bg-black/50 px-3 py-2.5 pr-11 text-sm text-foreground outline-none focus:border-alert" />
                    <button type="button" aria-label={showPassword ? "Hide password" : "Show password"}
                            onClick={() => setShowPassword((v) => !v)}
                            className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center text-foreground/55 hover:text-foreground">
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </label>
              )}

              {error && <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground">{error}</div>}
              {notice && <div className="rounded-md border border-alert/45 bg-alert/10 px-3 py-2 text-xs text-foreground">{notice}</div>}

              <button type="submit" disabled={busy}
                      className="glass-orange shimmer-btn inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm uppercase tracking-wider disabled:opacity-50">
                {busy ? <Loader2 className="animate-spin" size={14} /> : <ArrowRight size={14} />}
                {mode === "signin" ? "Sign in" : mode === "signup" ? "Start 7-day free trial" : "Send reset email"}
              </button>
            </form>

            {mode === "signin" && (
              <button type="button"
                      onClick={() => { setMode("forgot"); setError(null); setNotice(null); }}
                      className="mt-4 w-full text-center text-[0.65rem] font-bold uppercase tracking-[0.3em] text-alert hover:text-foreground">
                Forgot password?
              </button>
            )}

            <button type="button"
                    onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); setNotice(null); }}
                    className="mt-6 w-full text-center text-[0.65rem] font-bold uppercase tracking-[0.3em] text-foreground/60 hover:text-foreground">
              {mode === "signin"
                ? "No account? Start free trial →"
                : mode === "signup"
                  ? "Already registered? Sign in →"
                  : "Back to sign in →"}
            </button>
          </div>

          <p className="mt-4 text-center text-[0.6rem] uppercase tracking-[0.3em] text-foreground/40">
            7-day free trial · No card · <Link to="/auth" className="text-alert">info@instructsite.com</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
