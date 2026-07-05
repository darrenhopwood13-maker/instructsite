import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  redirect,
  isRedirect,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { getGateStatus } from "../lib/gate.functions";


function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  // Preview password gate temporarily disabled — cookie persistence in preview
  // iframe was locking users out even after a successful unlock. Re-enable
  // once the session cookie is proven to round-trip.


  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "instructSite The Construction Oracle" },
      { name: "description", content: "Premium AI command surface for construction  — Complete AI interface that automates every aspect of you project DABS, IFC, safety, sequences. progress verify" },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "instructSite The Construction Oracle" },
      { property: "og:description", content: "Premium AI command surface for construction  — Complete AI interface that automates every aspect of you project DABS, IFC, safety, sequences. progress verify" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "instructSite The Construction Oracle" },
      { name: "twitter:description", content: "Premium AI command surface for construction  — Complete AI interface that automates every aspect of you project DABS, IFC, safety, sequences. progress verify" },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/38f4bf9c-66f0-43af-838f-2ddf376d10d5/id-preview-60f3bc7f--f46aeaec-b1f9-4106-adeb-6d701f0fa404.lovable.app-1783269715782.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/38f4bf9c-66f0-43af-838f-2ddf376d10d5/id-preview-60f3bc7f--f46aeaec-b1f9-4106-adeb-6d701f0fa404.lovable.app-1783269715782.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://rsms.me" },
      { rel: "stylesheet", href: "https://rsms.me/inter/inter.css" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter+Tight:wght@500;600;700;800&family=Zen+Dots&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <div className="mesh-bg" aria-hidden>
        <svg
          className="mesh-blueprint"
          viewBox="0 0 1600 900"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden
        >
          <defs>
            <pattern id="bpHatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(255,255,255,0.18)" strokeWidth="0.6" />
            </pattern>
          </defs>

          <g fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.1" strokeLinecap="square" strokeLinejoin="miter">
            {/* Outer building envelope */}
            <rect x="220" y="180" width="1160" height="540" />
            <rect x="232" y="192" width="1136" height="516" stroke="rgba(255,255,255,0.32)" strokeWidth="0.6" />

            {/* Internal partition walls */}
            <line x1="560" y1="180" x2="560" y2="720" />
            <line x1="880" y1="180" x2="880" y2="720" />
            <line x1="1120" y1="180" x2="1120" y2="720" />
            <line x1="220" y1="440" x2="880" y2="440" />
            <line x1="880" y1="360" x2="1380" y2="360" />
            <line x1="880" y1="560" x2="1380" y2="560" />

            {/* Door swings */}
            <path d="M 560 500 A 60 60 0 0 1 620 440" />
            <line x1="560" y1="500" x2="620" y2="440" strokeDasharray="3 3" />
            <path d="M 880 260 A 60 60 0 0 0 820 320" />
            <line x1="880" y1="260" x2="820" y2="320" strokeDasharray="3 3" />
            <path d="M 1120 480 A 55 55 0 0 1 1175 425" />
            <line x1="1120" y1="480" x2="1175" y2="425" strokeDasharray="3 3" />

            {/* Window breaks (double lines on facade) */}
            {[300, 380, 460, 700, 780, 960, 1040, 1220, 1300].map((x) => (
              <g key={`w${x}`}>
                <line x1={x} y1="178" x2={x + 40} y2="178" stroke="rgba(255,255,255,0.15)" strokeWidth="6" />
                <line x1={x} y1="182" x2={x + 40} y2="182" stroke="rgba(147,197,253,0.9)" strokeWidth="0.8" />
                <line x1={x} y1="722" x2={x + 40} y2="722" stroke="rgba(255,255,255,0.15)" strokeWidth="6" />
                <line x1={x} y1="718" x2={x + 40} y2="718" stroke="rgba(147,197,253,0.9)" strokeWidth="0.8" />
              </g>
            ))}

            {/* Staircase */}
            <g stroke="rgba(255,255,255,0.7)" strokeWidth="0.8">
              <rect x="590" y="470" width="120" height="220" />
              {Array.from({ length: 10 }).map((_, i) => (
                <line key={`st${i}`} x1="590" y1={490 + i * 20} x2="710" y2={490 + i * 20} />
              ))}
              <line x1="650" y1="470" x2="650" y2="690" strokeWidth="1.1" />
            </g>

            {/* Structural columns */}
            {[300, 480, 680, 820, 960, 1120, 1280].map((x) =>
              [220, 400, 580].map((y) => (
                <g key={`c${x}-${y}`}>
                  <rect x={x - 6} y={y - 6} width="12" height="12" fill="rgba(255,255,255,0.35)" stroke="rgba(255,255,255,0.8)" />
                  <line x1={x - 10} y1={y} x2={x + 10} y2={y} />
                  <line x1={x} y1={y - 10} x2={x} y2={y + 10} />
                </g>
              )),
            )}

            {/* Hatched foundation zone (bottom-right room) */}
            <rect x="1120" y="560" width="260" height="160" fill="url(#bpHatch)" stroke="rgba(255,255,255,0.5)" />

            {/* Dimension lines — top */}
            <g stroke="rgba(255,255,255,0.55)" strokeWidth="0.6">
              <line x1="220" y1="130" x2="560" y2="130" />
              <line x1="560" y1="130" x2="880" y2="130" />
              <line x1="880" y1="130" x2="1120" y2="130" />
              <line x1="1120" y1="130" x2="1380" y2="130" />
              {[220, 560, 880, 1120, 1380].map((x) => (
                <line key={`tk${x}`} x1={x} y1="122" x2={x} y2="138" />
              ))}
            </g>
            <g fill="rgba(255,255,255,0.7)" fontFamily="ui-monospace, monospace" fontSize="12" letterSpacing="1.5">
              <text x="370" y="120">6800</text>
              <text x="700" y="120">6400</text>
              <text x="980" y="120">4800</text>
              <text x="1230" y="120">5200</text>
            </g>

            {/* Dimension lines — left */}
            <g stroke="rgba(255,255,255,0.55)" strokeWidth="0.6">
              <line x1="170" y1="180" x2="170" y2="440" />
              <line x1="170" y1="440" x2="170" y2="720" />
              {[180, 440, 720].map((y) => (
                <line key={`lk${y}`} x1="162" y1={y} x2="178" y2={y} />
              ))}
            </g>
            <g fill="rgba(255,255,255,0.7)" fontFamily="ui-monospace, monospace" fontSize="12" letterSpacing="1.5" transform="rotate(-90)">
              <text x="-330" y="160">5200</text>
              <text x="-600" y="160">5600</text>
            </g>

            {/* Grid bubbles */}
            <g fontFamily="ui-monospace, monospace" fontSize="11" fill="rgba(255,255,255,0.8)">
              {[
                { x: 220, l: "A" }, { x: 560, l: "B" }, { x: 880, l: "C" }, { x: 1120, l: "D" }, { x: 1380, l: "E" },
              ].map((g) => (
                <g key={`gh-${g.l}`}>
                  <line x1={g.x} y1="90" x2={g.x} y2="180" stroke="rgba(255,255,255,0.35)" strokeWidth="0.5" strokeDasharray="4 4" />
                  <circle cx={g.x} cy="82" r="12" fill="rgba(11,30,63,0.6)" stroke="rgba(255,255,255,0.7)" strokeWidth="0.7" />
                  <text x={g.x - 3.5} y="86">{g.l}</text>
                </g>
              ))}
              {[{ y: 180, l: "1" }, { y: 440, l: "2" }, { y: 720, l: "3" }].map((g) => (
                <g key={`gv-${g.l}`}>
                  <line x1="140" y1={g.y} x2="220" y2={g.y} stroke="rgba(255,255,255,0.35)" strokeWidth="0.5" strokeDasharray="4 4" />
                  <circle cx="128" cy={g.y} r="12" fill="rgba(11,30,63,0.6)" stroke="rgba(255,255,255,0.7)" strokeWidth="0.7" />
                  <text x="124" y={g.y + 4}>{g.l}</text>
                </g>
              ))}
            </g>

            {/* North arrow */}
            <g transform="translate(1450 210)" stroke="rgba(255,255,255,0.7)" strokeWidth="0.8" fill="rgba(255,255,255,0.15)">
              <circle r="28" />
              <polygon points="0,-22 8,10 0,4 -8,10" fill="rgba(255,255,255,0.9)" stroke="none" />
              <text x="-4" y="-30" fontFamily="ui-monospace, monospace" fontSize="10" fill="rgba(255,255,255,0.9)">N</text>
            </g>

            {/* Title block */}
            <g transform="translate(220 760)" fontFamily="ui-monospace, monospace" fill="rgba(255,255,255,0.75)">
              <rect x="0" y="0" width="1160" height="60" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.7" />
              <line x1="360" y1="0" x2="360" y2="60" stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" />
              <line x1="760" y1="0" x2="760" y2="60" stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" />
              <text x="12" y="22" fontSize="11" letterSpacing="2">DRAWING · GA-PLAN-L01</text>
              <text x="12" y="42" fontSize="9" letterSpacing="1.5" opacity="0.7">GROUND FLOOR — 1:100</text>
              <text x="372" y="22" fontSize="11" letterSpacing="2">PROJECT · STANLEY ROAD</text>
              <text x="372" y="42" fontSize="9" letterSpacing="1.5" opacity="0.7">REV C · ISSUED FOR CONSTRUCTION</text>
              <text x="772" y="22" fontSize="11" letterSpacing="2">instructSite</text>
              <text x="772" y="42" fontSize="9" letterSpacing="1.5" opacity="0.7">CHK: DH · DATE: 07/26</text>
            </g>
          </g>
        </svg>
      </div>
      <div className="relative z-10">
        <header className="border-b border-white/10 bg-background/70 backdrop-blur">
          <nav className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
            <Link to="/" className="flex items-baseline gap-0.5 text-lg font-extrabold tracking-tight">
              <span style={{ color: "#ff7a00" }}>instruct</span>
              <span className="text-white">Site</span>
            </Link>
            <AuthNav />
          </nav>
        </header>
        <main>
          <Outlet />
        </main>
      </div>
    </QueryClientProvider>
  );
}

function AuthNav() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => {
    let mounted = true;
    let unsub: (() => void) | undefined;
    import("@/integrations/supabase/client").then(({ supabase }) => {
      supabase.auth.getUser().then(({ data }) => {
        if (mounted) setSignedIn(!!data?.user?.id);
      });
      const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
        if (mounted) setSignedIn(!!session?.user?.id);
      });
      unsub = () => sub.subscription.unsubscribe();
    });
    return () => {
      mounted = false;
      unsub?.();
    };
  }, []);

  const signOut = async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    await supabase.auth.signOut();
    window.location.assign("/");
  };

  return (
    <div className="flex items-center gap-3">
      {signedIn ? (
        <>
          <Link to="/projects" className="glass-btn rounded-lg px-3 py-2 text-xs uppercase tracking-widest">
            Projects
          </Link>
          <Link to="/oracle" className="glass-orange rounded-lg px-4 py-2 text-sm">
            AI Tooling
          </Link>
          <button
            type="button"
            onClick={signOut}
            className="rounded-lg border border-white/15 px-3 py-2 text-xs uppercase tracking-widest text-foreground/70 hover:border-white/40 hover:text-foreground"
          >
            Sign out
          </button>
        </>
      ) : (
        <Link to="/auth" className="glass-orange rounded-lg px-4 py-2 text-sm uppercase tracking-widest">
          Sign in
        </Link>
      )}
    </div>
  );
}

