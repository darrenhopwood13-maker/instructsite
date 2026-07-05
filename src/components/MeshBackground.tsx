// Multi-layered animated 3D wireframe mesh + floating particles.
// Pure SVG + CSS keyframes. No client state, safe for SSR.
export function MeshBackground({ className = "" }: { className?: string }) {
  const particles = Array.from({ length: 22 }).map((_, i) => ({
    cx: (i * 47) % 100,
    cy: (i * 71) % 100,
    r: (i % 3) * 0.4 + 0.6,
    delay: (i % 7) * 0.4,
  }));

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      {/* Back mesh layer */}
      <svg
        className="mesh-layer-b absolute -inset-[10%] h-[120%] w-[120%] opacity-[0.35]"
        viewBox="0 0 1200 600"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="mesh-fade-b" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>
        {Array.from({ length: 14 }).map((_, r) => (
          <path
            key={`b-${r}`}
            d={`M 0 ${80 + r * 38} Q 300 ${40 + r * 34} 600 ${90 + r * 36} T 1200 ${70 + r * 38}`}
            fill="none"
            stroke="url(#mesh-fade-b)"
            strokeWidth="0.6"
          />
        ))}
        {Array.from({ length: 24 }).map((_, c) => (
          <path
            key={`bv-${c}`}
            d={`M ${c * 52} 0 Q ${c * 52 + 20} 300 ${c * 52} 600`}
            fill="none"
            stroke="url(#mesh-fade-b)"
            strokeWidth="0.4"
            opacity="0.6"
          />
        ))}
      </svg>

      {/* Front mesh wave */}
      <svg
        className="mesh-layer-a absolute inset-0 h-full w-full opacity-70"
        viewBox="0 0 1200 600"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="mesh-fade-a" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="70%" stopColor="#ffffff" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>
        {Array.from({ length: 10 }).map((_, r) => (
          <path
            key={`a-${r}`}
            d={`M 0 ${180 + r * 42} Q 300 ${120 + r * 38 + (r % 2 ? 40 : -20)} 600 ${200 + r * 40} T 1200 ${170 + r * 42}`}
            fill="none"
            stroke="url(#mesh-fade-a)"
            strokeWidth="1"
          />
        ))}
      </svg>

      {/* Floating particles */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {particles.map((p, i) => (
          <circle
            key={i}
            className="mesh-particle"
            cx={p.cx}
            cy={p.cy}
            r={p.r}
            fill="#ffffff"
            opacity="0.7"
            style={{ animationDelay: `${p.delay}s` }}
          />
        ))}
      </svg>
    </div>
  );
}
