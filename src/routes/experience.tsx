import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useMotionTemplate,
  type MotionValue,
} from "framer-motion";
import {
  ArrowRight,
  Smartphone,
  Sparkles,
  CalendarDays,
  Boxes,
  ShieldCheck,
  Quote,
} from "lucide-react";
import heroImg from "@/assets/experience-hero.jpg";

export const Route = createFileRoute("/experience")({
  head: () => ({
    meta: [
      { title: "instructSite — The Cinematic Experience" },
      {
        name: "description",
        content:
          "A Hollywood-grade tour of instructSite: AI-driven site operations, Randall's programme-to-diary playbook, BIM verification and the purple Oracle.",
      },
      { property: "og:title", content: "instructSite — The Cinematic Experience" },
      {
        property: "og:description",
        content: "Turn complex 2D drawings into instant, plain-English sequences.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ExperiencePage,
});

/* ---------- palette ---------- */
const NAVY = "#0A192F";
const ORANGE = "#FF6B00";
const PURPLE = "#8B5CF6";
const GREEN = "#10B981";

/* ---------- Hero ---------- */
function Hero() {
  const ref = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [0, -220]);
  const opacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.12]);

  return (
    <section
      ref={ref}
      className="relative h-[100svh] w-full overflow-hidden"
      style={{ backgroundColor: NAVY }}
    >
      <motion.img
        src={heroImg}
        alt=""
        style={{ scale }}
        className="absolute inset-0 h-full w-full object-cover opacity-70"
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(10,25,47,0.4) 0%, rgba(10,25,47,0.7) 55%, rgba(10,25,47,1) 100%)",
        }}
      />
      <motion.div
        style={{ y, opacity }}
        className="relative z-10 mx-auto flex h-full max-w-6xl flex-col items-start justify-center px-6"
      >
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.8 }}
          className="text-[0.7rem] font-bold uppercase tracking-[0.6em]"
          style={{ color: ORANGE }}
        >
          instructSite · Cinematic Reel
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 1 }}
          className="mt-6 max-w-5xl text-4xl font-black leading-[0.95] tracking-tight text-white sm:text-6xl md:text-7xl lg:text-[7.5rem]"
          style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
        >
          Turn complex 2D drawings into{" "}
          <span style={{ color: ORANGE }}>instant,</span>{" "}
          <span
            style={{
              background:
                "linear-gradient(90deg,#FF6B00 0%,#ffb057 50%,#FF6B00 100%)",
              backgroundSize: "200% 100%",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              animation: "shimmer 4s linear infinite",
            }}
          >
            plain-English
          </span>{" "}
          sequences.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.8 }}
          className="mt-6 max-w-2xl text-lg text-white/70 md:text-xl"
        >
          A six-tool AI cockpit for construction — DABS, Randall, Oracle, BIM
          Auto-Allocator, QS Verifier and Permit Sentinel. Built for the site,
          engineered like a film.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.8 }}
          className="mt-10 flex flex-wrap gap-3"
        >
          <Link
            to="/auth"
            search={{ trial: "start" }}
            className="inline-flex items-center gap-2 rounded-xl px-7 py-4 text-sm font-bold uppercase tracking-widest text-white shadow-2xl transition-transform hover:-translate-y-0.5"
            style={{
              background: `linear-gradient(135deg, ${ORANGE} 0%, #ff9040 100%)`,
              boxShadow: "0 20px 60px -15px rgba(255,107,0,0.6)",
            }}
          >
            Start free trial <ArrowRight size={16} />
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-7 py-4 text-sm font-bold uppercase tracking-widest text-white backdrop-blur-md transition-colors hover:bg-white/10"
          >
            Back to portal
          </Link>
        </motion.div>
      </motion.div>

      {/* scroll indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2 text-xs uppercase tracking-[0.4em] text-white/50"
        animate={{ y: [0, 8, 0] }}
        transition={{ repeat: Infinity, duration: 2 }}
      >
        Scroll
      </motion.div>
    </section>
  );
}

/* ---------- Section 2: 3D Phone Cockpit ---------- */
function CockpitSection() {
  const ref = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const rotateY = useSpring(useTransform(scrollYProgress, [0, 1], [-35, 35]), {
    stiffness: 60,
    damping: 20,
  });
  const rotateX = useSpring(useTransform(scrollYProgress, [0, 1], [20, -20]), {
    stiffness: 60,
    damping: 20,
  });
  const y = useTransform(scrollYProgress, [0, 1], [80, -80]);

  const steps = [
    {
      n: "01",
      title: "One-tap PWA install",
      body: "Add to home screen from the login page. Native app feel, zero app-store friction.",
    },
    {
      n: "02",
      title: "Bottom-sheet drawing selector",
      body: "Native-style modal lists every drawing with number + description. Thumb-reach, one-handed.",
    },
    {
      n: "03",
      title: "Purple Oracle FAB",
      body: "One tap opens a mobile chat locked to project context. Ask, answer, back to work.",
    },
  ];

  return (
    <section
      ref={ref}
      className="relative overflow-hidden py-32"
      style={{ backgroundColor: NAVY }}
    >
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-16 px-6 md:grid-cols-2 md:items-center">
        {/* 3D Phone */}
        <div
          className="relative flex h-[560px] items-center justify-center"
          style={{ perspective: 1600 }}
        >
          {/* Glow */}
          <div
            className="absolute inset-0 blur-3xl opacity-40"
            style={{
              background: `radial-gradient(circle at 50% 50%, ${PURPLE} 0%, transparent 60%)`,
            }}
          />
          <motion.div
            style={{
              rotateY,
              rotateX,
              y,
              transformStyle: "preserve-3d",
            }}
            className="relative"
          >
            <div
              className="relative h-[520px] w-[260px] rounded-[3rem] border border-white/10 p-3 shadow-2xl"
              style={{
                background: "linear-gradient(160deg,#1a2338 0%,#0a1220 100%)",
                boxShadow:
                  "0 60px 120px -30px rgba(139,92,246,0.4), 0 0 0 2px rgba(255,255,255,0.05) inset",
              }}
            >
              {/* Screen */}
              <div
                className="relative h-full w-full overflow-hidden rounded-[2.3rem]"
                style={{
                  background: `linear-gradient(180deg, #0a192f 0%, #0d2543 100%)`,
                }}
              >
                {/* notch */}
                <div className="absolute left-1/2 top-2 z-20 h-6 w-24 -translate-x-1/2 rounded-full bg-black" />

                {/* status bar */}
                <div className="flex items-center justify-between px-6 pt-3 text-[10px] font-bold text-white/80">
                  <span>09:41</span>
                  <span>◉ 5G</span>
                </div>

                {/* header card */}
                <div className="mx-4 mt-8 rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-md">
                  <p
                    className="text-[8px] font-bold uppercase tracking-[0.3em]"
                    style={{ color: ORANGE }}
                  >
                    Project · L-4471
                  </p>
                  <p className="mt-1 text-sm font-extrabold text-white">
                    YSL Mayfair
                  </p>
                  <div className="mt-2 flex items-center justify-between text-[9px] text-white/60">
                    <span>◐ 12°C · Cloudy</span>
                    <span>14:32</span>
                  </div>
                </div>

                {/* command grid */}
                <div className="mx-4 mt-4 grid grid-cols-2 gap-2">
                  {[
                    ["Install", ORANGE],
                    ["Safety", "#ef4444"],
                    ["Procure", "#f59e0b"],
                    ["Drawings", "#38bdf8"],
                    ["Snag", GREEN],
                    ["Assist", "#a3e635"],
                  ].map(([label, color]) => (
                    <div
                      key={label}
                      className="h-14 rounded-lg border border-white/10 p-2 text-[8px] font-bold uppercase tracking-wider text-white"
                      style={{
                        background: `linear-gradient(135deg, ${color}22 0%, ${color}44 100%)`,
                      }}
                    >
                      <div
                        className="mb-1 h-3 w-3 rounded"
                        style={{ backgroundColor: color as string }}
                      />
                      {label}
                    </div>
                  ))}
                </div>

                {/* Oracle FAB */}
                <motion.div
                  className="absolute bottom-6 right-5 flex h-12 w-12 items-center justify-center rounded-full"
                  style={{
                    background: `linear-gradient(135deg, ${PURPLE} 0%, #a78bfa 100%)`,
                    boxShadow: "0 10px 30px -5px rgba(139,92,246,0.7)",
                  }}
                  animate={{
                    boxShadow: [
                      "0 10px 30px -5px rgba(139,92,246,0.5)",
                      "0 10px 40px 0px rgba(139,92,246,0.9)",
                      "0 10px 30px -5px rgba(139,92,246,0.5)",
                    ],
                  }}
                  transition={{ repeat: Infinity, duration: 2 }}
                >
                  <Sparkles size={18} className="text-white" />
                </motion.div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Steps */}
        <div>
          <p
            className="text-[0.7rem] font-bold uppercase tracking-[0.5em]"
            style={{ color: ORANGE }}
          >
            Section · 02
          </p>
          <h2
            className="mt-4 text-4xl font-black leading-[1] text-white md:text-6xl"
            style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
          >
            The mobile <br />
            <span style={{ color: PURPLE }}>cockpit.</span>
          </h2>
          <p className="mt-6 max-w-md text-lg text-white/70">
            A PWA that installs to the home screen and behaves like a native
            app. Purpose-built for gloved thumbs, one hand, and a busy site.
          </p>

          <div className="mt-10 space-y-6">
            {steps.map((s, i) => (
              <motion.div
                key={s.n}
                initial={{ opacity: 0, x: 40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ delay: i * 0.15, duration: 0.6 }}
                className="flex gap-5 border-l-2 pl-6"
                style={{ borderColor: `${ORANGE}66` }}
              >
                <span
                  className="text-4xl font-black leading-none"
                  style={{
                    fontFamily: "'Zen Dots', sans-serif",
                    color: ORANGE,
                  }}
                >
                  {s.n}
                </span>
                <div>
                  <h3 className="text-xl font-extrabold text-white">
                    {s.title}
                  </h3>
                  <p className="mt-1 text-white/60">{s.body}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Section 3: Randall ---------- */
function RandallSection() {
  const ref = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const blur = useTransform(scrollYProgress, [0.2, 0.6], [0, 16]);
  const filter = useMotionTemplate`blur(${blur}px)`;
  const clarityOpacity = useTransform(scrollYProgress, [0.3, 0.65], [0, 1]);

  return (
    <section
      ref={ref}
      className="relative overflow-hidden py-32"
      style={{
        background: `linear-gradient(180deg, ${NAVY} 0%, #071224 50%, ${NAVY} 100%)`,
      }}
    >
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center">
          <p
            className="text-[0.7rem] font-bold uppercase tracking-[0.5em]"
            style={{ color: ORANGE }}
          >
            Section · 03 · Randall
          </p>
          <h2
            className="mx-auto mt-4 max-w-4xl text-4xl font-black leading-[1] text-white md:text-6xl"
            style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
          >
            Programme in.{" "}
            <span style={{ color: ORANGE }}>Playbook out.</span>
          </h2>
        </div>

        <div className="mt-20 grid grid-cols-1 gap-10 md:grid-cols-2 md:items-center">
          {/* Gantt (blurs) */}
          <motion.div style={{ filter }} className="relative">
            <div
              className="h-[380px] overflow-hidden rounded-2xl border border-white/10 p-4"
              style={{
                background: "linear-gradient(160deg,#0d1a2e,#0a1220)",
              }}
            >
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                Master Programme · P6
              </p>
              {[...Array(14)].map((_, i) => (
                <div key={i} className="mt-2 flex items-center gap-2">
                  <div className="h-2 w-24 rounded-full bg-white/10" />
                  <div
                    className="h-2 rounded-full"
                    style={{
                      width: `${20 + ((i * 37) % 60)}%`,
                      marginLeft: `${(i * 13) % 30}%`,
                      background: `linear-gradient(90deg, ${ORANGE}88, ${ORANGE}33)`,
                    }}
                  />
                </div>
              ))}
            </div>
          </motion.div>

          {/* Diary (fades in crisp) */}
          <motion.div style={{ opacity: clarityOpacity }} className="relative">
            <div
              className="rounded-2xl border p-6"
              style={{
                background: "linear-gradient(160deg,#fefefe,#f4f0e8)",
                borderColor: "#e8dfc9",
                boxShadow: "0 40px 80px -20px rgba(0,0,0,0.5)",
              }}
            >
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  Tuesday · 07 Jul 2026
                </p>
                <CalendarDays size={14} className="text-slate-400" />
              </div>
              <h3
                className="mt-2 text-2xl font-black"
                style={{
                  fontFamily: "'Zen Dots', sans-serif",
                  color: NAVY,
                }}
              >
                Day-to-a-Page
              </h3>
              <ul className="mt-4 space-y-2 text-sm text-slate-700">
                <li>
                  <b>08:00</b> — Level 04 riser second-fix, Team A (4 ops).
                </li>
                <li>
                  <b>10:30</b> — Permit signed: hot works, plantroom.
                </li>
                <li>
                  <b>12:00</b> — QS verify Zone C façade panels.
                </li>
                <li>
                  <b>14:00</b> — Weather snapshot &amp; afternoon briefing.
                </li>
                <li>
                  <b>16:30</b> — Snag walk-through, Levels 01–03.
                </li>
              </ul>
            </div>
          </motion.div>
        </div>

        {/* ROI */}
        <div className="mt-24 text-center">
          <p className="text-xs uppercase tracking-[0.4em] text-white/50">
            Daily ROI · per programme
          </p>
          <motion.div
            className="mt-6 flex flex-wrap items-baseline justify-center gap-8"
            animate={{ scale: [1, 1.02, 1] }}
            transition={{ repeat: Infinity, duration: 3 }}
          >
            <div>
              <div
                className="text-6xl font-black md:text-8xl"
                style={{
                  color: ORANGE,
                  fontFamily: "'Zen Dots', sans-serif",
                  textShadow: `0 0 60px ${ORANGE}88`,
                }}
              >
                £11.2k
              </div>
              <p className="mt-2 text-xs uppercase tracking-widest text-white/60">
                saved / day
              </p>
            </div>
            <div className="text-white/30 text-4xl">·</div>
            <div>
              <div
                className="text-6xl font-black md:text-8xl"
                style={{
                  color: ORANGE,
                  fontFamily: "'Zen Dots', sans-serif",
                  textShadow: `0 0 60px ${ORANGE}88`,
                }}
              >
                14h
              </div>
              <p className="mt-2 text-xs uppercase tracking-widest text-white/60">
                back / day
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}


/* ---------- Section 4: Green Mesh Reveal ---------- */
function GreenMeshSection() {
  const ref = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const paint = useTransform(scrollYProgress, [0.4, 0.75], [0, 1]);
  const paintScale = useTransform(paint, [0, 1], [0, 30]);
  const paintOpacity = useTransform(paint, [0, 0.5, 1], [0, 0.9, 0.4]);
  const shift1 = useTransform(scrollYProgress, [0.15, 0.35], [0, 60]);
  const shift2 = useTransform(scrollYProgress, [0.35, 0.55], [0, 40]);

  return (
    <section
      ref={ref}
      className="relative min-h-[130vh] overflow-hidden py-32"
      style={{ backgroundColor: "#050c18" }}
    >
      {/* radial paint */}
      <motion.div
        className="pointer-events-none absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background: `radial-gradient(circle, ${GREEN} 0%, transparent 70%)`,
          scale: paintScale,
          opacity: paintOpacity,
        }}
      />

      <div className="relative mx-auto max-w-7xl px-6">
        <p
          className="text-[0.7rem] font-bold uppercase tracking-[0.5em]"
          style={{ color: ORANGE }}
        >
          Section · 04 · BIM + QS
        </p>
        <h2
          className="mt-4 max-w-4xl text-4xl font-black leading-[1] text-white md:text-6xl"
          style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
        >
          10,000 IFC elements. <br />
          <span style={{ color: GREEN }}>Verified green.</span>
        </h2>

        <div className="mt-16 grid grid-cols-1 gap-10 md:grid-cols-2 md:items-center">
          {/* model placeholder */}
          <div
            className="relative h-[420px] overflow-hidden rounded-2xl border border-white/10"
            style={{
              background:
                "radial-gradient(circle at 50% 40%, #143253 0%, #0a192f 60%, #050c18 100%)",
            }}
          >
            {/* grid mesh */}
            <svg
              className="absolute inset-0 h-full w-full opacity-40"
              viewBox="0 0 400 400"
            >
              {[...Array(20)].map((_, i) => (
                <line
                  key={`h${i}`}
                  x1="0"
                  y1={i * 20}
                  x2="400"
                  y2={i * 20}
                  stroke={GREEN}
                  strokeWidth="0.3"
                />
              ))}
              {[...Array(20)].map((_, i) => (
                <line
                  key={`v${i}`}
                  x1={i * 20}
                  y1="0"
                  x2={i * 20}
                  y2="400"
                  stroke={GREEN}
                  strokeWidth="0.3"
                />
              ))}
              {/* isometric block */}
              <g transform="translate(200 200)">
                <polygon
                  points="0,-80 80,-40 80,60 0,100 -80,60 -80,-40"
                  fill={GREEN}
                  fillOpacity="0.15"
                  stroke={GREEN}
                  strokeWidth="1"
                />
                <polygon
                  points="0,-80 80,-40 0,0 -80,-40"
                  fill={GREEN}
                  fillOpacity="0.25"
                  stroke={GREEN}
                  strokeWidth="1"
                />
              </g>
            </svg>
            <Boxes
              size={64}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white/20"
            />
          </div>

          {/* shift readouts */}
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: false, amount: 0.5 }}
              className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-widest text-white/60">
                  Shift 1
                </span>
                <motion.span
                  style={{ x: 0 }}
                  className="text-4xl font-black"
                >
                  <motion.span style={{ color: ORANGE }}>
                    <Counter value={shift1} suffix="%" />
                  </motion.span>
                </motion.span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    background: `linear-gradient(90deg, ${ORANGE}, ${GREEN})`,
                    scaleX: useTransform(shift1, [0, 100], [0, 1]),
                    transformOrigin: "left",
                  }}
                />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: false, amount: 0.5 }}
              className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-widest text-white/60">
                  Shift 2
                </span>
                <span className="text-4xl font-black" style={{ color: GREEN }}>
                  <Counter value={shift2} suffix="%" />
                </span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    background: GREEN,
                    scaleX: useTransform(shift2, [0, 100], [0, 1]),
                    transformOrigin: "left",
                  }}
                />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              className="flex items-center gap-3 pt-4"
            >
              <ShieldCheck size={28} style={{ color: GREEN }} />
              <span
                className="text-2xl font-black"
                style={{
                  color: GREEN,
                  fontFamily: "'Zen Dots', sans-serif",
                }}
              >
                100% QS-verified
              </span>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* animated numeric counter fed by a MotionValue */
function Counter({
  value,
  suffix,
}: {
  value: MotionValue<number>;
  suffix?: string;
}) {
  const rounded = useTransform(value, (v) => `${Math.round(v)}${suffix ?? ""}`);
  return <motion.span>{rounded}</motion.span>;
}

/* ---------- Section 5: Case studies ---------- */
function CaseStudies() {
  const cases = [
    {
      client: "YSL Mayfair",
      contractor: "McLaren Construction",
      quote:
        "Cut daily brief prep from 3 hours to 12 minutes. The programme-to-diary hand-off is now automatic.",
      metric: "3h → 12m",
      accent: ORANGE,
    },
    {
      client: "Hoxton Studios",
      contractor: "Mayor of London — Affordable Homes",
      quote:
        "Every trade sees only their zone, only their permits. Zero paper. Full audit trail.",
      metric: "0 paper",
      accent: PURPLE,
    },
    {
      client: "Battersea Phase 4",
      contractor: "Tier-1 Fit-out",
      quote:
        "10,412 IFC elements auto-allocated to shifts. The 3D model turns green as work is verified.",
      metric: "10,412 elements",
      accent: GREEN,
    },
  ];

  return (
    <section
      className="relative overflow-hidden py-32"
      style={{ backgroundColor: NAVY }}
    >
      <div className="mx-auto max-w-7xl px-6">
        <p
          className="text-[0.7rem] font-bold uppercase tracking-[0.5em]"
          style={{ color: ORANGE }}
        >
          Section · 05 · Real-world proof
        </p>
        <h2
          className="mt-4 max-w-4xl text-4xl font-black leading-[1] text-white md:text-6xl"
          style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
        >
          Sites where <span style={{ color: ORANGE }}>instructSite</span> is in
          the loop.
        </h2>
      </div>

      <div className="mt-16 flex gap-6 overflow-x-auto px-6 pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {cases.map((c, i) => (
          <motion.article
            key={c.client}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ delay: i * 0.15, duration: 0.7 }}
            className="relative min-w-[85%] shrink-0 overflow-hidden rounded-3xl border border-white/10 p-8 md:min-w-[520px]"
            style={{
              background: `linear-gradient(160deg, ${c.accent}22 0%, #0a192f 70%)`,
            }}
          >
            <Quote size={28} style={{ color: c.accent }} />
            <p className="mt-6 text-xl leading-snug text-white md:text-2xl">
              "{c.quote}"
            </p>
            <div className="mt-8 flex items-end justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-white/50">
                  {c.contractor}
                </p>
                <p
                  className="mt-1 text-2xl font-black text-white"
                  style={{ fontFamily: "'Zen Dots', sans-serif" }}
                >
                  {c.client}
                </p>
              </div>
              <div
                className="text-3xl font-black"
                style={{
                  color: c.accent,
                  fontFamily: "'Zen Dots', sans-serif",
                }}
              >
                {c.metric}
              </div>
            </div>
          </motion.article>
        ))}
      </div>

      {/* CTA */}
      <div className="mt-24 text-center">
        <h3
          className="mx-auto max-w-3xl text-3xl font-black text-white md:text-5xl"
          style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
        >
          Ready to run the site like a film set?
        </h3>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            to="/auth"
            search={{ trial: "start" }}
            className="inline-flex items-center gap-2 rounded-xl px-8 py-4 text-sm font-bold uppercase tracking-widest text-white"
            style={{
              background: `linear-gradient(135deg, ${ORANGE} 0%, #ff9040 100%)`,
              boxShadow: "0 20px 60px -15px rgba(255,107,0,0.6)",
            }}
          >
            Start free trial <ArrowRight size={16} />
          </Link>
          <a
            href="/instructsite-brochure.pdf"
            download
            className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-8 py-4 text-sm font-bold uppercase tracking-widest text-white backdrop-blur-md hover:bg-white/10"
          >
            Download brochure
          </a>
        </div>
        <p className="mt-10 text-xs uppercase tracking-[0.4em] text-white/40">
          instructSite · 2026
        </p>
      </div>
    </section>
  );
}

/* ---------- Page ---------- */
function ExperiencePage() {
  return (
    <main className="relative w-full" style={{ backgroundColor: NAVY }}>
      <Hero />
      <CockpitSection />
      <RandallSection />
      <GreenMeshSection />
      <CaseStudies />
    </main>
  );
}

export default ExperiencePage;
