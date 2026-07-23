import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useMatches,
  HeadContent,
  Scripts,
  redirect,
  isRedirect,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Camera, BookOpen, LifeBuoy, ExternalLink } from "lucide-react";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { Button } from "@/components/ui/button";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { getGateStatus } from "../lib/gate.functions";
import { OracleFAB } from "@/components/OracleFAB";


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
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" },
      { name: "theme-color", content: "#0b1220" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "instructSite" },
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
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/favicon.ico" },
      { rel: "preconnect", href: "https://rsms.me" },
      { rel: "stylesheet", href: "https://rsms.me/inter/inter.css" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter+Tight:wght@500;600;700;800&family=Zen+Dots&family=Space+Grotesk:wght@500;600;700&display=swap",
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
          viewBox="0 0 1800 1000"
          preserveAspectRatio="xMidYMid meet"
          aria-hidden
        >
          <defs>
            <pattern id="bpHatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(200,230,255,0.55)" strokeWidth="0.7" />
            </pattern>
            <pattern id="bpConcrete" width="12" height="12" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="3" r="0.6" fill="rgba(200,230,255,0.45)" />
              <circle cx="7" cy="8" r="0.5" fill="rgba(200,230,255,0.35)" />
              <circle cx="10" cy="2" r="0.4" fill="rgba(200,230,255,0.3)" />
            </pattern>
            <pattern id="bpEarth" width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M0 10 L10 0 M-2 2 L2 -2 M8 12 L12 8" stroke="rgba(200,230,255,0.35)" strokeWidth="0.5" />
            </pattern>
          </defs>

          <g
            fill="none"
            stroke="rgba(220,235,255,0.85)"
            strokeWidth="1.2"
            strokeLinecap="square"
            strokeLinejoin="miter"
            fontFamily="ui-monospace, 'JetBrains Mono', monospace"
          >
            {/* ================= SHEET BORDER ================= */}
            <rect x="40" y="40" width="1720" height="920" stroke="rgba(220,235,255,0.65)" strokeWidth="1.4" />
            <rect x="52" y="52" width="1696" height="896" stroke="rgba(220,235,255,0.25)" strokeWidth="0.5" />

            {/* ================= LEFT: GA FLOOR PLAN ================= */}
            <g transform="translate(80 80)">
              <text x="0" y="0" fontSize="11" letterSpacing="3" fill="rgba(220,235,255,0.85)">
                01 · GENERAL ARRANGEMENT · GROUND FLOOR · 1:100
              </text>

              {/* Outer walls (double line) */}
              <rect x="0" y="30" width="820" height="520" strokeWidth="1.8" />
              <rect x="12" y="42" width="796" height="496" stroke="rgba(220,235,255,0.35)" strokeWidth="0.6" />

              {/* Internal partitions */}
              <line x1="260" y1="30" x2="260" y2="550" strokeWidth="1.4" />
              <line x1="520" y1="30" x2="520" y2="550" strokeWidth="1.4" />
              <line x1="680" y1="30" x2="680" y2="550" strokeWidth="1.4" />
              <line x1="0"   y1="280" x2="520" y2="280" strokeWidth="1.4" />
              <line x1="520" y1="200" x2="820" y2="200" strokeWidth="1.4" />
              <line x1="520" y1="410" x2="820" y2="410" strokeWidth="1.4" />

              {/* Door swings */}
              <g strokeWidth="1">
                <path d="M 260 330 A 50 50 0 0 1 310 280" />
                <line x1="260" y1="330" x2="310" y2="280" strokeDasharray="3 3" opacity="0.7" />
                <path d="M 520 100 A 50 50 0 0 0 470 150" />
                <line x1="520" y1="100" x2="470" y2="150" strokeDasharray="3 3" opacity="0.7" />
                <path d="M 680 320 A 46 46 0 0 1 726 274" />
                <line x1="680" y1="320" x2="726" y2="274" strokeDasharray="3 3" opacity="0.7" />
              </g>

              {/* Windows (double line breaks in walls) */}
              {[60, 130, 200, 340, 410, 570, 640, 740].map((x) => (
                <g key={`win${x}`}>
                  <line x1={x} y1="30" x2={x + 40} y2="30" stroke="rgba(11,30,63,0.85)" strokeWidth="6" />
                  <line x1={x} y1="27" x2={x + 40} y2="27" stroke="rgba(147,197,253,1)" strokeWidth="0.9" />
                  <line x1={x} y1="33" x2={x + 40} y2="33" stroke="rgba(147,197,253,1)" strokeWidth="0.9" />
                  <line x1={x} y1="550" x2={x + 40} y2="550" stroke="rgba(11,30,63,0.85)" strokeWidth="6" />
                  <line x1={x} y1="547" x2={x + 40} y2="547" stroke="rgba(147,197,253,1)" strokeWidth="0.9" />
                  <line x1={x} y1="553" x2={x + 40} y2="553" stroke="rgba(147,197,253,1)" strokeWidth="0.9" />
                </g>
              ))}

              {/* Stair core */}
              <g strokeWidth="0.9">
                <rect x="290" y="310" width="120" height="220" />
                {Array.from({ length: 11 }).map((_, i) => (
                  <line key={`st${i}`} x1="290" y1={330 + i * 18} x2="410" y2={330 + i * 18} />
                ))}
                <line x1="350" y1="310" x2="350" y2="530" strokeWidth="1.2" />
                <polygon points="345,320 355,320 350,308" fill="rgba(220,235,255,0.8)" stroke="none" />
                <text x="298" y="546" fontSize="8" letterSpacing="1.5" fill="rgba(220,235,255,0.75)">UP · 11R</text>
              </g>

              {/* Foundation hatch (services zone) */}
              <rect x="680" y="410" width="140" height="140" fill="url(#bpConcrete)" stroke="rgba(220,235,255,0.6)" />
              <text x="690" y="500" fontSize="9" letterSpacing="2" fill="rgba(220,235,255,0.7)">M&amp;E</text>

              {/* Structural columns (grid intersections) */}
              {[0, 260, 520, 680, 820].map((x) =>
                [30, 280, 550].map((y) => (
                  <g key={`col${x}-${y}`}>
                    <rect x={x - 7} y={y - 7} width="14" height="14" fill="rgba(220,235,255,0.65)" stroke="rgba(220,235,255,1)" strokeWidth="0.8" />
                    <line x1={x - 12} y1={y} x2={x + 12} y2={y} strokeWidth="0.5" />
                    <line x1={x} y1={y - 12} x2={x} y2={y + 12} strokeWidth="0.5" />
                  </g>
                )),
              )}

              {/* Furniture / fittings (kitchen block, WC, desks) */}
              <g strokeWidth="0.6" stroke="rgba(220,235,255,0.55)">
                <rect x="20" y="50" width="220" height="30" />
                <line x1="80"  y1="50" x2="80"  y2="80" />
                <line x1="140" y1="50" x2="140" y2="80" />
                <line x1="200" y1="50" x2="200" y2="80" />
                <circle cx="60"  cy="65" r="8" />
                <circle cx="120" cy="65" r="8" />
                <rect x="540" y="220" width="120" height="20" />
                <rect x="540" y="250" width="120" height="20" />
                <circle cx="750" cy="230" r="10" />
                <rect x="710" y="260" width="80" height="30" />
                <rect x="20" y="440" width="60" height="90" />
                <rect x="90" y="440" width="60" height="90" />
                <rect x="160" y="440" width="60" height="90" />
              </g>

              {/* Room labels */}
              <g fontSize="10" letterSpacing="2" fill="rgba(220,235,255,0.85)">
                <text x="70"  y="180">OFFICE 01</text>
                <text x="70"  y="420">CANTEEN</text>
                <text x="440" y="180">LOBBY</text>
                <text x="440" y="450">RECEPTION</text>
                <text x="720" y="120">WC</text>
                <text x="720" y="360">STORE</text>
              </g>

              {/* Dimension string — top */}
              <g strokeWidth="0.6" stroke="rgba(220,235,255,0.75)">
                <line x1="0"   y1="-20" x2="260" y2="-20" />
                <line x1="260" y1="-20" x2="520" y2="-20" />
                <line x1="520" y1="-20" x2="680" y2="-20" />
                <line x1="680" y1="-20" x2="820" y2="-20" />
                {[0, 260, 520, 680, 820].map((x) => (
                  <line key={`dt${x}`} x1={x} y1="-26" x2={x} y2="-14" />
                ))}
              </g>
              <g fontSize="9" letterSpacing="1.5" fill="rgba(220,235,255,0.85)">
                <text x="112" y="-24">5200</text>
                <text x="372" y="-24">5200</text>
                <text x="580" y="-24">3200</text>
                <text x="732" y="-24">2800</text>
              </g>

              {/* Dimension string — left */}
              <g strokeWidth="0.6" stroke="rgba(220,235,255,0.75)">
                <line x1="-24" y1="30"  x2="-24" y2="280" />
                <line x1="-24" y1="280" x2="-24" y2="550" />
                {[30, 280, 550].map((y) => (
                  <line key={`dl${y}`} x1="-30" y1={y} x2="-18" y2={y} />
                ))}
              </g>
              <g fontSize="9" letterSpacing="1.5" fill="rgba(220,235,255,0.85)" transform="rotate(-90)">
                <text x="-170" y="-30">5000</text>
                <text x="-430" y="-30">5400</text>
              </g>

              {/* Grid bubbles */}
              <g fontSize="10" fill="rgba(220,235,255,0.95)">
                {[{ x: 0, l: "A" }, { x: 260, l: "B" }, { x: 520, l: "C" }, { x: 680, l: "D" }, { x: 820, l: "E" }].map((g) => (
                  <g key={`gh${g.l}`}>
                    <line x1={g.x} y1="-60" x2={g.x} y2="30" strokeDasharray="4 4" stroke="rgba(220,235,255,0.35)" strokeWidth="0.5" />
                    <circle cx={g.x} cy="-70" r="13" fill="rgba(11,30,63,0.7)" stroke="rgba(220,235,255,0.9)" strokeWidth="0.9" />
                    <text x={g.x - 3.5} y="-66">{g.l}</text>
                  </g>
                ))}
                {[{ y: 30, l: "1" }, { y: 280, l: "2" }, { y: 550, l: "3" }].map((g) => (
                  <g key={`gv${g.l}`}>
                    <line x1="-60" y1={g.y} x2="0" y2={g.y} strokeDasharray="4 4" stroke="rgba(220,235,255,0.35)" strokeWidth="0.5" />
                    <circle cx="-70" cy={g.y} r="13" fill="rgba(11,30,63,0.7)" stroke="rgba(220,235,255,0.9)" strokeWidth="0.9" />
                    <text x="-73.5" y={g.y + 4}>{g.l}</text>
                  </g>
                ))}
              </g>

              {/* Section marker A-A */}
              <g stroke="rgba(255,140,30,0.95)" strokeWidth="1">
                <line x1="-20" y1="200" x2="840" y2="200" strokeDasharray="10 4 2 4" />
                <circle cx="-40" cy="200" r="14" fill="rgba(11,30,63,0.75)" />
                <text x="-49" y="204" fontSize="11" fill="rgba(255,180,80,1)">A</text>
                <polygon points="-30,190 -20,200 -30,210" fill="rgba(255,140,30,0.95)" stroke="none" />
                <circle cx="860" cy="200" r="14" fill="rgba(11,30,63,0.75)" />
                <text x="852" y="204" fontSize="11" fill="rgba(255,180,80,1)">A</text>
                <polygon points="850,190 840,200 850,210" fill="rgba(255,140,30,0.95)" stroke="none" />
              </g>
            </g>

            {/* ================= RIGHT-TOP: CROSS SECTION A-A ================= */}
            <g transform="translate(1000 100)">
              <text x="0" y="0" fontSize="11" letterSpacing="3" fill="rgba(220,235,255,0.85)">
                02 · CROSS SECTION A-A · 1:100
              </text>

              {/* Ground line */}
              <line x1="-10" y1="280" x2="720" y2="280" strokeWidth="1.6" stroke="rgba(220,235,255,0.9)" />
              <rect x="-10" y="280" width="730" height="70" fill="url(#bpEarth)" stroke="none" />

              {/* Foundation strip */}
              <rect x="20" y="260" width="680" height="20" fill="url(#bpConcrete)" stroke="rgba(220,235,255,0.7)" strokeWidth="0.9" />

              {/* Three storeys */}
              {[0, 1, 2].map((i) => {
                const y = 260 - (i + 1) * 70;
                return (
                  <g key={`fl${i}`}>
                    <line x1="20" y1={y} x2="700" y2={y} strokeWidth="1.4" />
                    <line x1="20" y1={y + 8} x2="700" y2={y + 8} stroke="rgba(220,235,255,0.35)" strokeWidth="0.6" />
                    <text x="710" y={y + 4} fontSize="9" fill="rgba(220,235,255,0.8)" letterSpacing="1.5">
                      +{(i + 1) * 3.2}m
                    </text>
                  </g>
                );
              })}

              {/* Vertical structure — columns */}
              {[40, 200, 360, 520, 680].map((x) => (
                <line key={`vcol${x}`} x1={x} y1="50" x2={x} y2="260" strokeWidth="1.1" />
              ))}

              {/* Roof */}
              <line x1="20" y1="50" x2="700" y2="50" strokeWidth="1.6" />
              <polygon points="20,50 360,10 700,50" fill="none" stroke="rgba(220,235,255,0.85)" strokeWidth="1.2" />
              <line x1="360" y1="10" x2="360" y2="50" strokeWidth="0.6" strokeDasharray="3 3" />

              {/* Window openings on section */}
              {[70, 240, 410, 570].map((x) =>
                [0, 1, 2].map((i) => {
                  const y = 260 - (i + 1) * 70 + 25;
                  return (
                    <rect key={`swin${x}${i}`} x={x} y={y} width="80" height="30" fill="rgba(147,197,253,0.18)" stroke="rgba(147,197,253,0.9)" strokeWidth="0.7" />
                  );
                }),
              )}

              {/* Level labels */}
              <g fontSize="9" letterSpacing="2" fill="rgba(220,235,255,0.85)">
                <text x="-6" y="264">±0.00 GL</text>
                <text x="-6" y="194">L01</text>
                <text x="-6" y="124">L02</text>
                <text x="-6" y="54">L03</text>
              </g>

              {/* Overall height dim */}
              <g strokeWidth="0.6" stroke="rgba(220,235,255,0.75)">
                <line x1="740" y1="10" x2="740" y2="280" />
                <line x1="734" y1="10" x2="746" y2="10" />
                <line x1="734" y1="280" x2="746" y2="280" />
              </g>
              <text x="748" y="150" fontSize="9" fill="rgba(220,235,255,0.85)" letterSpacing="1.5">10.400</text>
            </g>

            {/* ================= RIGHT-BOTTOM: DETAIL & CALLOUTS ================= */}
            <g transform="translate(1000 480)">
              <text x="0" y="0" fontSize="11" letterSpacing="3" fill="rgba(220,235,255,0.85)">
                03 · DETAIL · SLAB/WALL JUNCTION · 1:20
              </text>

              {/* Slab */}
              <rect x="20" y="60" width="360" height="26" fill="url(#bpConcrete)" stroke="rgba(220,235,255,0.85)" strokeWidth="1.2" />
              {/* Rebar */}
              <g stroke="rgba(255,180,80,0.9)" strokeWidth="0.7">
                {[40, 80, 120, 160, 200, 240, 280, 320, 360].map((x) => (
                  <circle key={`rb${x}`} cx={x} cy="72" r="2.4" fill="none" />
                ))}
                <line x1="24" y1="80" x2="376" y2="80" strokeDasharray="3 2" />
              </g>
              {/* Wall */}
              <rect x="180" y="86" width="40" height="120" fill="url(#bpHatch)" stroke="rgba(220,235,255,0.85)" strokeWidth="1.2" />
              {/* Insulation zig-zag */}
              <path
                d="M 220 90 l 8 6 l -8 6 l 8 6 l -8 6 l 8 6 l -8 6 l 8 6 l -8 6 l 8 6 l -8 6 l 8 6 l -8 6 l 8 6 l -8 6 l 8 6 l -8 6"
                stroke="rgba(220,235,255,0.7)"
                strokeWidth="0.7"
                fill="none"
              />
              {/* Membrane */}
              <line x1="20" y1="58" x2="380" y2="58" stroke="rgba(147,197,253,0.9)" strokeWidth="0.9" strokeDasharray="6 3" />

              {/* Leader callouts */}
              <g stroke="rgba(255,180,80,0.9)" strokeWidth="0.7" fill="rgba(255,180,80,0.95)" fontSize="9" letterSpacing="1.5">
                <line x1="360" y1="72" x2="440" y2="40" />
                <circle cx="440" cy="40" r="2.4" />
                <text x="446" y="43" fill="rgba(255,180,80,1)" stroke="none">01 · REBAR Ø12 @ 200 c/c</text>
                <line x1="200" y1="150" x2="440" y2="120" />
                <circle cx="440" cy="120" r="2.4" />
                <text x="446" y="123" fill="rgba(255,180,80,1)" stroke="none">02 · CAVITY INSULATION 100mm</text>
                <line x1="200" y1="58" x2="440" y2="80" />
                <circle cx="440" cy="80" r="2.4" />
                <text x="446" y="83" fill="rgba(255,180,80,1)" stroke="none">03 · DPM VAPOUR BARRIER</text>
                <line x1="90"  y1="86" x2="440" y2="160" />
                <circle cx="440" cy="160" r="2.4" />
                <text x="446" y="163" fill="rgba(255,180,80,1)" stroke="none">04 · SLAB C32/40 · 200mm</text>
              </g>

              {/* Revision cloud */}
              <g stroke="rgba(255,80,80,0.95)" strokeWidth="0.9" fill="none">
                <path d="M 20 240 q 10 -14 24 -6 q 8 -14 22 -6 q 8 -14 24 -6 q 6 -14 22 -6 q 8 -14 22 -4 q 4 12 -8 12 q 6 14 -12 10 q 4 12 -14 8 q 6 12 -14 8 q -2 16 -22 6 q -14 8 -20 -8 q -14 4 -12 -10 q -14 -2 -6 -14 Z" />
                <text x="150" y="252" fontSize="9" fill="rgba(255,120,120,1)" stroke="none" letterSpacing="1.5">REV C — 04.07.26</text>
              </g>
            </g>

            {/* ================= NORTH ARROW ================= */}
            <g transform="translate(1660 130)" stroke="rgba(220,235,255,0.9)" strokeWidth="1" fill="rgba(220,235,255,0.12)">
              <circle r="34" />
              <circle r="26" fill="none" stroke="rgba(220,235,255,0.35)" strokeWidth="0.5" />
              <polygon points="0,-26 10,14 0,6 -10,14" fill="rgba(255,180,80,1)" stroke="none" />
              <polygon points="0,26 10,-14 0,-6 -10,-14" fill="rgba(220,235,255,0.35)" stroke="none" />
              <text x="-5" y="-36" fontSize="11" fill="rgba(220,235,255,1)" stroke="none">N</text>
            </g>

            {/* ================= SCALE BAR ================= */}
            <g transform="translate(80 900)">
              <text x="0" y="-6" fontSize="9" letterSpacing="2" fill="rgba(220,235,255,0.85)">SCALE 1:100 (m)</text>
              {Array.from({ length: 10 }).map((_, i) => (
                <rect
                  key={`sc${i}`}
                  x={i * 22}
                  y="0"
                  width="22"
                  height="8"
                  fill={i % 2 === 0 ? "rgba(220,235,255,0.9)" : "rgba(11,30,63,0.9)"}
                  stroke="rgba(220,235,255,0.9)"
                  strokeWidth="0.5"
                />
              ))}
              {[0, 2, 4, 6, 8, 10].map((n) => (
                <text key={`scl${n}`} x={n * 22 - 3} y="22" fontSize="8" fill="rgba(220,235,255,0.85)">
                  {n}
                </text>
              ))}
            </g>

            {/* ================= TITLE BLOCK ================= */}
            <g transform="translate(1180 860)" fill="rgba(220,235,255,0.9)">
              <rect x="0" y="0" width="540" height="80" fill="rgba(11,30,63,0.55)" stroke="rgba(220,235,255,0.7)" strokeWidth="0.9" />
              <line x1="200" y1="0" x2="200" y2="80" stroke="rgba(220,235,255,0.5)" strokeWidth="0.5" />
              <line x1="380" y1="0" x2="380" y2="80" stroke="rgba(220,235,255,0.5)" strokeWidth="0.5" />
              <line x1="0"   y1="26" x2="540" y2="26" stroke="rgba(220,235,255,0.3)" strokeWidth="0.4" />

              <text x="10" y="18" fontSize="10" letterSpacing="3">DRAWING</text>
              <text x="10" y="46" fontSize="14" letterSpacing="3" fill="rgba(255,180,80,1)">GA-100 · REV C</text>
              <text x="10" y="66" fontSize="8" letterSpacing="2" opacity="0.75">ISSUED FOR CONSTRUCTION</text>

              <text x="210" y="18" fontSize="10" letterSpacing="3">PROJECT</text>
              <text x="210" y="46" fontSize="12" letterSpacing="2">STANLEY ROAD</text>
              <text x="210" y="66" fontSize="8" letterSpacing="2" opacity="0.75">RIVERSIDE · LONDON</text>

              <text x="390" y="18" fontSize="10" letterSpacing="3">instructSite</text>
              <text x="390" y="46" fontSize="9" letterSpacing="1.5" opacity="0.85">CHK · DH</text>
              <text x="390" y="60" fontSize="9" letterSpacing="1.5" opacity="0.85">DATE · 04.07.26</text>
              <text x="390" y="74" fontSize="9" letterSpacing="1.5" opacity="0.85">SCALE · 1:100 @ A1</text>
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
      <OracleFAB />
    </QueryClientProvider>
  );
}

function AuthNav() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  useEffect(() => {
    let mounted = true;
    let unsub: (() => void) | undefined;
    const OWNER = "darrenhopwood13@gmail.com";
    const apply = (email: string | null | undefined) => {
      if (!mounted) return;
      setSignedIn(!!email);
      setIsOwner((email ?? "").trim().toLowerCase() === OWNER);
    };
    import("@/integrations/supabase/client").then(({ supabase }) => {
      supabase.auth.getUser().then(({ data }) => apply(data?.user?.email));
      const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
        apply(session?.user?.email);
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
          {isOwner ? (
            <Link to="/org" className="glass-btn rounded-lg px-3 py-2 text-xs uppercase tracking-widest">
              Organisation
            </Link>
          ) : (
            <Link to="/projects" className="glass-btn rounded-lg px-3 py-2 text-xs uppercase tracking-widest">
              Projects
            </Link>
          )}

          <ProjectBibleNavLink />
          <Link to="/manual" className="glass-btn inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs uppercase tracking-widest">
            <LifeBuoy className="h-3.5 w-3.5" />
            Manual
          </Link>
          <NotificationBell />

          <Link to="/snags" className="glass-btn inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs uppercase tracking-widest">
            <Camera className="h-3.5 w-3.5" />
            Snag Master
          </Link>
          <Link to="/tooling" className="glass-orange rounded-lg px-4 py-2 text-sm">
            AI Tooling
          </Link>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <a
              href="https://www.instructsite.ai"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open instructSite in a new tab"
            >
              <ExternalLink className="h-4 w-4" />
              Open instructSite
            </a>
          </Button>
          <UserContextChip />
        </>
      ) : (
        <>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <a
              href="https://www.instructsite.ai"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open instructSite in a new tab"
            >
              <ExternalLink className="h-4 w-4" />
              Open instructSite
            </a>
          </Button>
          <Link to="/auth" className="glass-orange rounded-lg px-4 py-2 text-sm uppercase tracking-widest">
            Sign in
          </Link>
        </>
      )}
    </div>
  );
}

function ProjectBibleNavLink() {
  const matches = useMatches();
  let projectId: string | undefined;
  for (const m of matches) {
    const p = (m.params as { projectId?: string } | undefined)?.projectId;
    if (p) {
      projectId = p;
      break;
    }
  }
  if (!projectId) return null;
  return (
    <Link
      to="/projects/$projectId/bible"
      params={{ projectId }}
      className="glass-btn inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs uppercase tracking-widest"
    >
      <BookOpen className="h-3.5 w-3.5" />
      Project Bible
    </Link>
  );
}


