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
          className="mesh-building"
          viewBox="-400 -260 800 520"
          preserveAspectRatio="xMidYMid meet"
          aria-hidden
        >
          <defs>
            <linearGradient id="msFace" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(255,140,30,0.28)" />
              <stop offset="100%" stopColor="rgba(59,130,246,0.10)" />
            </linearGradient>
            <linearGradient id="msFaceR" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(59,130,246,0.22)" />
              <stop offset="100%" stopColor="rgba(11,30,63,0.35)" />
            </linearGradient>
            <linearGradient id="msRoof" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="rgba(255,255,255,0.25)" />
              <stop offset="100%" stopColor="rgba(255,180,80,0.35)" />
            </linearGradient>
            <filter id="msGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.6" result="b" />
              <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>

          {/* Isometric wireframe building — technical BIM sketch */}
          <g filter="url(#msGlow)" strokeLinecap="round" strokeLinejoin="round">
            {/* Ground plane hatching */}
            <g stroke="rgba(255,255,255,0.14)" strokeWidth="0.6">
              {Array.from({ length: 12 }).map((_, i) => (
                <line key={`gh${i}`} x1={-360 + i * 60} y1={180} x2={-120 + i * 60} y2={60} />
              ))}
              {Array.from({ length: 8 }).map((_, i) => (
                <line key={`gv${i}`} x1={-360 + i * 60} y1={180} x2={-360 + i * 60 + 240} y2={180 - 120} />
              ))}
            </g>

            {/* Left face (front) — floors */}
            <g>
              <polygon points="-260,140 -60,140 -60,-80 -260,-80" fill="url(#msFace)" stroke="rgba(255,140,30,0.75)" strokeWidth="1.4"/>
              {/* Floor slabs */}
              {[-40, 0, 40, 80, 120].map((y, i) => (
                <line key={`slabL${i}`} x1="-260" y1={y} x2="-60" y2={y} stroke="rgba(255,255,255,0.55)" strokeWidth="0.9" />
              ))}
              {/* Columns */}
              {[-220, -180, -140, -100].map((x, i) => (
                <line key={`colL${i}`} x1={x} y1="-80" x2={x} y2="140" stroke="rgba(255,255,255,0.45)" strokeWidth="0.7" />
              ))}
              {/* Window mullions */}
              {[-40, 0, 40, 80].map((y) =>
                [-210, -170, -130, -90].map((x) => (
                  <rect key={`wL${x}${y}`} x={x} y={y - 26} width="18" height="20" fill="rgba(147,197,253,0.20)" stroke="rgba(147,197,253,0.55)" strokeWidth="0.5" />
                )),
              )}
            </g>

            {/* Right face — receding, isometric */}
            <g>
              <polygon points="-60,140 140,60 140,-160 -60,-80" fill="url(#msFaceR)" stroke="rgba(59,130,246,0.85)" strokeWidth="1.4"/>
              {/* Depth floor lines */}
              {[-40, 0, 40, 80, 120].map((y, i) => (
                <line key={`slabR${i}`} x1="-60" y1={y} x2="140" y2={y - 80} stroke="rgba(255,255,255,0.5)" strokeWidth="0.9" />
              ))}
              {/* Depth columns */}
              {[0, 40, 80, 120].map((t, i) => (
                <line key={`colR${i}`} x1={-60 + t} y1={140 - t * 0.4} x2={-60 + t} y2={-80 - t * 0.4} stroke="rgba(255,255,255,0.4)" strokeWidth="0.7" />
              ))}
              {/* Windows on depth face */}
              {[-40, 0, 40, 80].map((y) =>
                [10, 45, 80, 115].map((t) => (
                  <rect
                    key={`wR${t}${y}`}
                    x={-60 + t}
                    y={y - 26 - t * 0.4}
                    width="15"
                    height="18"
                    fill="rgba(255,200,120,0.18)"
                    stroke="rgba(255,180,80,0.60)"
                    strokeWidth="0.5"
                  />
                )),
              )}
            </g>

            {/* Roof top */}
            <polygon points="-260,-80 -60,-80 140,-160 -60,-160" fill="url(#msRoof)" stroke="rgba(255,255,255,0.85)" strokeWidth="1.4"/>
            {/* Rooftop plant/HVAC */}
            <g stroke="rgba(255,255,255,0.7)" strokeWidth="0.7" fill="rgba(255,255,255,0.10)">
              <rect x="-200" y="-130" width="40" height="18" />
              <rect x="-140" y="-118" width="30" height="14" />
              <line x1="-120" y1="-140" x2="-120" y2="-160" />
              <circle cx="-90" cy="-138" r="6" />
            </g>

            {/* Crane */}
            <g stroke="rgba(255,140,30,0.9)" strokeWidth="1.1" fill="none">
              <line x1="160" y1="180" x2="160" y2="-220" />
              <line x1="160" y1="-220" x2="-60" y2="-210" />
              <line x1="160" y1="-220" x2="240" y2="-200" />
              <line x1="160" y1="-200" x2="-40" y2="-208" />
              <line x1="20" y1="-210" x2="20" y2="-160" />
              <line x1="14" y1="-160" x2="26" y2="-160" />
              {/* Lattice */}
              {Array.from({ length: 10 }).map((_, i) => (
                <line key={`lat${i}`} x1={160 - i * 22} y1={-220 + (i % 2) * 4} x2={160 - i * 22 - 22} y2={-220 - ((i + 1) % 2) * 4} />
              ))}
            </g>

            {/* Dimension line */}
            <g stroke="rgba(255,255,255,0.55)" strokeWidth="0.6" fill="none">
              <line x1="-260" y1="170" x2="-60" y2="170" />
              <line x1="-260" y1="165" x2="-260" y2="175" />
              <line x1="-60" y1="165" x2="-60" y2="175" />
              <text x="-180" y="188" fill="rgba(255,255,255,0.65)" fontSize="9" fontFamily="ui-monospace, monospace" letterSpacing="2">
                24.000 m
              </text>
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

