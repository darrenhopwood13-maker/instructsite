import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useEffect, useState } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useMotionTemplate,
  type MotionValue,
} from "framer-motion";
import { ArrowRight, Sparkles, ShieldCheck, ChevronsLeftRight } from "lucide-react";

export const Route = createFileRoute("/experience")({
  head: () => ({
    meta: [
      { title: "The Future of Site Management is Autonomous" },
      {
        name: "description",
        content:
          "An autonomous six-tool AI cockpit for construction — programme to diary, BIM to money, drawings to plain English.",
      },
      { property: "og:title", content: "The Future of Site Management is Autonomous" },
      {
        property: "og:description",
        content: "An autonomous six-tool AI cockpit for construction.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ExperiencePage,
});

/* ---------- palette ---------- */
const SLATE = "#1E293B";
const ORANGE = "#FB923C";
const PURPLE = "#8B5CF6";
const GREEN = "#10B981";
const BLACK = "#050609";

/* =============================================================
   SECTION 1 — THE VISION (cursor particles)
============================================================= */
function VisionHero() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouse = useRef({ x: -9999, y: -9999 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
    };
    resize();
    window.addEventListener("resize", resize);

    const N = 140;
    const particles = Array.from({ length: N }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      r: Math.random() * 1.6 + 0.4,
    }));

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.current.x = (e.clientX - rect.left) * dpr;
      mouse.current.y = (e.clientY - rect.top) * dpr;
    };
    const onLeave = () => {
      mouse.current.x = -9999;
      mouse.current.y = -9999;
    };
    window.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseleave", onLeave);

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // update
      for (const p of particles) {
        const dx = mouse.current.x - p.x;
        const dy = mouse.current.y - p.y;
        const d2 = dx * dx + dy * dy;
        const range = 180 * dpr;
        if (d2 < range * range) {
          const f = (1 - Math.sqrt(d2) / range) * 0.6;
          p.vx += (dx / Math.sqrt(d2 || 1)) * f;
          p.vy += (dy / Math.sqrt(d2 || 1)) * f;
        }
        p.vx *= 0.94;
        p.vy *= 0.94;
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
      }

      // connections
      ctx.lineWidth = 0.6 * dpr;
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const a = particles[i];
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          const max = 110 * dpr;
          if (d2 < max * max) {
            const alpha = 1 - Math.sqrt(d2) / max;
            ctx.strokeStyle = `rgba(251,146,60,${alpha * 0.25})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      for (const p of particles) {
        const dx = mouse.current.x - p.x;
        const dy = mouse.current.y - p.y;
        const near = dx * dx + dy * dy < (180 * dpr) * (180 * dpr);
        ctx.fillStyle = near ? "rgba(251,146,60,0.95)" : "rgba(226,232,240,0.55)";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * dpr, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <section
      className="relative h-[100svh] w-full overflow-hidden"
      style={{ backgroundColor: BLACK }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        style={{ background: `radial-gradient(ellipse at 50% 40%, ${SLATE} 0%, ${BLACK} 70%)` }}
      />
      {/* vignette */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(5,6,9,0.9) 100%)",
        }}
      />

      <div className="relative z-10 mx-auto flex h-full max-w-6xl flex-col items-center justify-center px-6 text-center">
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.9 }}
          className="text-[0.65rem] font-semibold uppercase tracking-[0.8em]"
          style={{ color: ORANGE }}
        >
          Section · 01 · The Vision
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 1.1 }}
          className="mt-8 max-w-5xl text-4xl font-black leading-[0.95] tracking-tight text-white sm:text-6xl md:text-7xl lg:text-[6.5rem]"
          style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
        >
          The future of site management is{" "}
          <span
            style={{
              background: `linear-gradient(90deg,#FB923C 0%,#fed7aa 50%,#FB923C 100%)`,
              backgroundSize: "200% 100%",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              animation: "shimmer 5s linear infinite",
            }}
          >
            autonomous.
          </span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.75, duration: 0.9 }}
          className="mt-8 max-w-2xl text-base text-slate-300/80 md:text-lg"
        >
          A six-tool AI cockpit that turns drawings into sequences, programmes
          into diaries, and models into money. Engineered like a film.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0, duration: 0.8 }}
          className="mt-12 flex flex-wrap justify-center gap-3"
        >
          <Link
            to="/auth"
            search={{ trial: "start" }}
            className="inline-flex items-center gap-2 rounded-full px-8 py-4 text-xs font-bold uppercase tracking-[0.3em] text-white transition-transform hover:-translate-y-0.5"
            style={{
              background: `linear-gradient(135deg, ${ORANGE} 0%, #fdba74 100%)`,
              boxShadow: `0 20px 60px -15px ${ORANGE}99`,
            }}
          >
            Enter the cockpit <ArrowRight size={14} />
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-8 py-4 text-xs font-bold uppercase tracking-[0.3em] text-white/80 backdrop-blur-md hover:bg-white/[0.07]"
          >
            Portal
          </Link>
        </motion.div>

        {/* scroll cue */}
        <motion.div
          className="absolute bottom-10 left-1/2 -translate-x-1/2 text-[0.6rem] uppercase tracking-[0.6em] text-white/40"
          animate={{ y: [0, 10, 0], opacity: [0.4, 0.9, 0.4] }}
          transition={{ repeat: Infinity, duration: 2.4 }}
        >
          Scroll to assemble
        </motion.div>
      </div>
    </section>
  );
}

/* =============================================================
   SECTION 2 — COMMAND MODULE (scroll-assembled phone)
============================================================= */
function CommandModule() {
  const ref = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const p = useSpring(scrollYProgress, { stiffness: 80, damping: 22 });

  // Frame assembles first, screen 2nd, tiles 3rd, FAB last
  const frameX = useTransform(p, [0, 0.25], [-260, 0]);
  const frameOpacity = useTransform(p, [0, 0.2], [0, 1]);
  const screenScale = useTransform(p, [0.2, 0.4], [0.4, 1]);
  const screenOpacity = useTransform(p, [0.2, 0.4], [0, 1]);
  const tilesY = useTransform(p, [0.35, 0.55], [80, 0]);
  const tilesOpacity = useTransform(p, [0.35, 0.55], [0, 1]);
  const fabScale = useTransform(p, [0.55, 0.7], [0, 1]);
  const rotateY = useTransform(p, [0, 1], [-25, 15]);

  const tiles: [string, string, string][] = [
    ["Install", ORANGE, "DABS"],
    ["Safety", "#ef4444", "Sentinel"],
    ["Procure", "#f59e0b", "Randall"],
    ["Drawings", "#38bdf8", "DABS"],
    ["Snag", GREEN, "QS"],
    ["Assist", PURPLE, "Oracle"],
  ];

  return (
    <section
      ref={ref}
      className="relative overflow-hidden py-40"
      style={{ backgroundColor: BLACK }}
    >
      {/* aura */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, ${PURPLE}30 0%, transparent 60%)` }}
      />

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-20 px-6 md:grid-cols-2 md:items-center">
        {/* Phone */}
        <div
          className="relative flex h-[600px] items-center justify-center"
          style={{ perspective: 1800 }}
        >
          <motion.div
            style={{ rotateY, transformStyle: "preserve-3d" }}
            className="relative"
          >
            {/* Frame */}
            <motion.div
              style={{ x: frameX, opacity: frameOpacity }}
              className="relative h-[560px] w-[280px] rounded-[3.2rem] border p-3"
             
            >
              <div
                className="absolute inset-0 rounded-[3.2rem]"
                style={{
                  background: "linear-gradient(160deg,#1e2a44 0%,#070b16 100%)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  boxShadow:
                    "0 80px 140px -30px rgba(139,92,246,0.35), inset 0 0 0 1.5px rgba(255,255,255,0.05)",
                }}
              />
              {/* Screen */}
              <motion.div
                style={{ scale: screenScale, opacity: screenOpacity }}
                className="relative h-full w-full overflow-hidden rounded-[2.5rem]"
              >
                <div
                  className="absolute inset-0"
                  style={{
                    background: `linear-gradient(180deg, ${SLATE} 0%, #0b1424 100%)`,
                  }}
                />
                {/* notch */}
                <div className="absolute left-1/2 top-3 z-20 h-6 w-28 -translate-x-1/2 rounded-full bg-black" />
                {/* status */}
                <div className="relative flex items-center justify-between px-6 pt-4 text-[10px] font-bold text-white/80">
                  <span>09:41</span>
                  <span>◉ 5G</span>
                </div>

                {/* project card */}
                <motion.div
                  style={{ opacity: screenOpacity }}
                  className="relative mx-4 mt-8 rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-md"
                >
                  <p
                    className="text-[8px] font-bold uppercase tracking-[0.3em]"
                    style={{ color: ORANGE }}
                  >
                    Project · Live
                  </p>
                  <p className="mt-1 text-sm font-extrabold text-white">
                    Premier Commercial Fit-out
                  </p>
                  <div className="mt-2 flex items-center justify-between text-[9px] text-white/60">
                    <span>◐ 12°C · Cloudy</span>
                    <span>14:32</span>
                  </div>
                </motion.div>

                {/* tiles */}
                <motion.div
                  style={{ y: tilesY, opacity: tilesOpacity }}
                  className="relative mx-4 mt-4 grid grid-cols-2 gap-2"
                >
                  {tiles.map(([label, color, tag], i) => (
                    <motion.div
                      key={label}
                      initial={{ scale: 0.7, opacity: 0 }}
                      whileInView={{ scale: 1, opacity: 1 }}
                      viewport={{ once: true, amount: 0.5 }}
                      transition={{ delay: i * 0.06, duration: 0.4 }}
                      className="relative h-16 overflow-hidden rounded-lg border border-white/10 p-2 text-[8px] font-bold uppercase tracking-wider text-white"
                      style={{
                        background: `linear-gradient(135deg, ${color}22 0%, ${color}44 100%)`,
                      }}
                    >
                      <div
                        className="mb-1 h-3 w-3 rounded"
                        style={{ backgroundColor: color }}
                      />
                      {label}
                      <span
                        className="absolute bottom-1 right-1.5 text-[6px] tracking-[0.15em] text-white/50"
                      >
                        {tag}
                      </span>
                    </motion.div>
                  ))}
                </motion.div>

                {/* FAB */}
                <motion.div
                  style={{ scale: fabScale }}
                  className="absolute bottom-6 right-5 flex h-14 w-14 items-center justify-center rounded-full"
                >
                  <motion.div
                    className="flex h-14 w-14 items-center justify-center rounded-full"
                    animate={{
                      boxShadow: [
                        `0 10px 30px -5px ${PURPLE}80`,
                        `0 10px 50px 0 ${PURPLE}ff`,
                        `0 10px 30px -5px ${PURPLE}80`,
                      ],
                    }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    style={{
                      background: `linear-gradient(135deg, ${PURPLE} 0%, #a78bfa 100%)`,
                    }}
                  >
                    <Sparkles size={20} className="text-white" />
                  </motion.div>
                </motion.div>
              </motion.div>
            </motion.div>

            {/* orbiting labels */}
            <motion.div
              style={{ opacity: tilesOpacity }}
              className="pointer-events-none absolute -left-40 top-24 hidden md:block"
            >
              <ToolChip color={ORANGE} name="DABS" desc="Drawings → sequences" />
            </motion.div>
            <motion.div
              style={{ opacity: fabScale }}
              className="pointer-events-none absolute -right-44 bottom-16 hidden md:block"
            >
              <ToolChip color={PURPLE} name="Oracle" desc="Purple AI FAB" />
            </motion.div>
          </motion.div>
        </div>

        {/* Copy */}
        <div>
          <p
            className="text-[0.65rem] font-semibold uppercase tracking-[0.7em]"
            style={{ color: ORANGE }}
          >
            Section · 02 · Command Module
          </p>
          <h2
            className="mt-5 text-4xl font-black leading-[0.95] text-white md:text-6xl"
            style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
          >
            One glove.<br />
            <span style={{ color: ORANGE }}>Six commands.</span><br />
            <span style={{ color: PURPLE }}>Zero paper.</span>
          </h2>
          <p className="mt-6 max-w-md text-base text-slate-300/70 md:text-lg">
            A progressive web app that installs to the home screen and behaves
            like a native cockpit. Six tiles route to six agents. One purple
            floating action button opens the project-scoped Oracle.
          </p>

          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FeatureRow
              n="01"
              title="DABS · Orange tile"
              body="Drawings become plain-English installation sequences."
              color={ORANGE}
            />
            <FeatureRow
              n="02"
              title="Oracle · Purple FAB"
              body="One-hand chat. Scoped to the live project only."
              color={PURPLE}
            />
            <FeatureRow
              n="03"
              title="Randall · Programme"
              body="Master programme in. Day-to-a-page diary out."
              color="#f59e0b"
            />
            <FeatureRow
              n="04"
              title="QS Verifier"
              body="Model quantities reconciled against site progress."
              color={GREEN}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function ToolChip({ color, name, desc }: { color: string; name: string; desc: string }) {
  return (
    <div
      className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 backdrop-blur-md"
      style={{ boxShadow: `0 20px 60px -30px ${color}` }}
    >
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
        <span
          className="text-xs font-black uppercase tracking-widest"
          style={{ color }}
        >
          {name}
        </span>
      </div>
      <p className="mt-1 text-[10px] uppercase tracking-widest text-white/50">
        {desc}
      </p>
    </div>
  );
}

function FeatureRow({
  n,
  title,
  body,
  color,
}: {
  n: string;
  title: string;
  body: string;
  color: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.5 }}
      className="rounded-xl border border-white/10 bg-white/[0.02] p-4"
    >
      <div className="flex items-center gap-3">
        <span
          className="text-lg font-black"
          style={{ color, fontFamily: "'Zen Dots', sans-serif" }}
        >
          {n}
        </span>
        <span className="text-sm font-extrabold text-white">{title}</span>
      </div>
      <p className="mt-2 text-xs text-white/60">{body}</p>
    </motion.div>
  );
}

/* =============================================================
   SECTION 3 — RANDALL'S LOGIC (draggable slider comparison)
============================================================= */
function RandallSlider() {
  const [pct, setPct] = useState(50);
  const dragRef = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);

  useEffect(() => {
    const move = (e: MouseEvent | TouchEvent) => {
      if (!dragging.current || !dragRef.current) return;
      const rect = dragRef.current.getBoundingClientRect();
      const clientX =
        "touches" in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const x = clientX - rect.left;
      const v = Math.max(0, Math.min(100, (x / rect.width) * 100));
      setPct(v);
    };
    const up = () => (dragging.current = false);
    window.addEventListener("mousemove", move);
    window.addEventListener("touchmove", move);
    window.addEventListener("mouseup", up);
    window.addEventListener("touchend", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("touchend", up);
    };
  }, []);

  return (
    <section
      className="relative overflow-hidden py-40"
      style={{
        background: `linear-gradient(180deg, ${BLACK} 0%, ${SLATE} 50%, ${BLACK} 100%)`,
      }}
    >
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center">
          <p
            className="text-[0.65rem] font-semibold uppercase tracking-[0.7em]"
            style={{ color: ORANGE }}
          >
            Section · 03 · Randall's Logic
          </p>
          <h2
            className="mx-auto mt-5 max-w-4xl text-4xl font-black leading-[0.95] text-white md:text-6xl"
            style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
          >
            Programme in.{" "}
            <span style={{ color: ORANGE }}>Playbook out.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-base text-slate-300/70 md:text-lg">
            Drag the handle. Watch a chaotic master programme resolve into a
            day-to-a-page diary any foreman can read in twelve minutes.
          </p>
        </div>

        {/* Comparison */}
        <div
          ref={dragRef}
          className="relative mt-16 h-[540px] w-full select-none overflow-hidden rounded-3xl border border-white/10"
          style={{ background: "#050a13" }}
        >
          {/* Gantt (blurred as pct grows) */}
          <div className="absolute inset-0">
            <GanttMock blurPx={(pct / 100) * 14} />
          </div>

          {/* Diary revealed by clip */}
          <div
            className="absolute inset-0"
            style={{ clipPath: `inset(0 0 0 ${pct}%)` }}
          >
            <DiaryMock />
          </div>

          {/* Handle */}
          <div
            className="absolute top-0 h-full cursor-ew-resize"
            style={{ left: `${pct}%`, transform: "translateX(-50%)" }}
            onMouseDown={() => (dragging.current = true)}
            onTouchStart={() => (dragging.current = true)}
          >
            <div
              className="mx-auto h-full w-[3px]"
              style={{
                background: `linear-gradient(180deg, transparent 0%, ${ORANGE} 20%, ${ORANGE} 80%, transparent 100%)`,
                boxShadow: `0 0 30px ${ORANGE}`,
              }}
            />
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex h-14 w-14 items-center justify-center rounded-full border-2 border-white/30 bg-black/70 backdrop-blur-md"
              style={{ boxShadow: `0 0 40px ${ORANGE}80` }}
            >
              <ChevronsLeftRight size={22} className="text-white" />
            </div>
          </div>

          {/* labels */}
          <div className="pointer-events-none absolute left-6 top-6 rounded-full border border-white/10 bg-black/60 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white/70 backdrop-blur">
            Master programme · P6
          </div>
          <div className="pointer-events-none absolute right-6 top-6 rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest backdrop-blur"
               style={{ borderColor: `${ORANGE}66`, color: ORANGE, background: "rgba(0,0,0,0.6)" }}>
            Day-to-a-page diary
          </div>
        </div>

        {/* ROI band */}
        <div className="mt-24 text-center">
          <p className="text-[0.65rem] uppercase tracking-[0.6em] text-white/40">
            Daily ROI · per programme
          </p>
          <div className="mt-6 flex flex-wrap items-baseline justify-center gap-x-12 gap-y-4">
            <ROIStat value="3h → 12m" label="brief prep" />
            <span className="text-2xl text-white/20">·</span>
            <ROIStat value="£11.2k" label="saved / day" />
            <span className="text-2xl text-white/20">·</span>
            <ROIStat value="14h" label="back / day" />
          </div>
        </div>
      </div>
    </section>
  );
}

function ROIStat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div
        className="text-5xl font-black md:text-7xl"
        style={{
          color: ORANGE,
          fontFamily: "'Zen Dots', sans-serif",
          textShadow: `0 0 60px ${ORANGE}66`,
        }}
      >
        {value}
      </div>
      <p className="mt-2 text-[10px] uppercase tracking-[0.5em] text-white/50">
        {label}
      </p>
    </div>
  );
}

function GanttMock({ blurPx }: { blurPx: number }) {
  const rows = 16;
  return (
    <div
      className="h-full w-full p-8"
      style={{
        filter: `blur(${blurPx}px)`,
        background: "linear-gradient(160deg,#0b1424,#050a13)",
      }}
    >
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/40">
          Task · Trade · Duration · Float
        </span>
        <span className="text-[10px] uppercase tracking-widest text-white/30">
          {rows * 3}+ activities
        </span>
      </div>
      <div className="mt-4 space-y-2.5">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              className="h-2 rounded-sm bg-white/10"
              style={{ width: `${18 + (i % 4) * 4}%` }}
            />
            <div
              className="h-2 rounded-sm"
              style={{
                width: `${12 + ((i * 37) % 60)}%`,
                marginLeft: `${(i * 13) % 30}%`,
                background: `linear-gradient(90deg, ${ORANGE}aa, ${ORANGE}44)`,
              }}
            />
            <div
              className="h-2 rounded-sm bg-red-500/40"
              style={{ width: `${4 + (i % 3) * 3}%` }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function DiaryMock() {
  return (
    <div
      className="h-full w-full p-8"
      style={{ background: "linear-gradient(160deg,#f8f5ec,#ece4cf)" }}
    >
      <div className="flex items-center justify-between">
        <span
          className="text-[10px] font-bold uppercase tracking-[0.4em]"
          style={{ color: SLATE }}
        >
          Tuesday · Day 142
        </span>
        <span
          className="rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-widest text-white"
          style={{ background: ORANGE }}
        >
          Randall · verified
        </span>
      </div>
      <h3
        className="mt-2 text-3xl font-black"
        style={{ fontFamily: "'Zen Dots', sans-serif", color: SLATE }}
      >
        Day-to-a-Page
      </h3>
      <ul className="mt-5 space-y-2.5 text-sm leading-relaxed" style={{ color: "#334155" }}>
        <li><b>08:00</b> — Level 04 riser second-fix, Team A (4 ops).</li>
        <li><b>10:30</b> — Permit signed: hot works, plantroom.</li>
        <li><b>12:00</b> — QS verify Zone C façade panels.</li>
        <li><b>14:00</b> — Weather snapshot &amp; afternoon briefing.</li>
        <li><b>16:30</b> — Snag walk-through, Levels 01–03.</li>
        <li><b>17:15</b> — Diary auto-signed, distributed to 12 trades.</li>
      </ul>
      <div className="mt-6 flex items-center gap-2 text-[10px] uppercase tracking-widest" style={{ color: "#64748b" }}>
        <div className="h-1 flex-1 rounded-full" style={{ background: "#cbd5e1" }}>
          <div className="h-1 rounded-full" style={{ width: "84%", background: ORANGE }} />
        </div>
        <span>84% shift complete</span>
      </div>
    </div>
  );
}

/* =============================================================
   SECTION 4 — VERIFICATION ENGINE (BIM → Money paint pipeline)
============================================================= */
function VerificationEngine() {
  const ref = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const p = useSpring(scrollYProgress, { stiffness: 70, damping: 22 });

  const paintPct = useTransform(p, [0.15, 0.85], [0, 100]);
  const money = useTransform(p, [0.2, 0.9], [0, 428_500]);
  const verified = useTransform(p, [0.15, 0.85], [0, 10412]);

  return (
    <section
      ref={ref}
      className="relative overflow-hidden py-40"
      style={{ backgroundColor: BLACK }}
    >
      <div className="mx-auto max-w-7xl px-6">
        <p
          className="text-[0.65rem] font-semibold uppercase tracking-[0.7em]"
          style={{ color: ORANGE }}
        >
          Section · 04 · Verification Engine
        </p>
        <h2
          className="mt-5 max-w-4xl text-4xl font-black leading-[0.95] text-white md:text-6xl"
          style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
        >
          From raw mesh <br />
          <span style={{ color: GREEN }}>to verified revenue.</span>
        </h2>
        <p className="mt-6 max-w-2xl text-base text-slate-300/70 md:text-lg">
          Every element in the model is auto-allocated to a shift. As trades
          verify installation on site, the mesh paints green — and the
          cumulative revenue counter climbs in real time.
        </p>

        <div className="mt-16 grid grid-cols-1 gap-10 md:grid-cols-2 md:items-center">
          {/* Mesh */}
          <MeshPipeline paintPct={paintPct} />

          {/* Metrics */}
          <div className="space-y-6">
            <MetricCard
              label="Elements verified"
              value={<CounterMV value={verified} />}
              max="10,412"
              color={GREEN}
              pct={paintPct}
            />
            <MetricCard
              label="Cumulative revenue unlocked"
              value={<CounterMV value={money} prefix="£" />}
              max="£428,500"
              color={ORANGE}
              pct={paintPct}
            />

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              className="flex items-center gap-3 pt-4"
            >
              <ShieldCheck size={28} style={{ color: GREEN }} />
              <span
                className="text-2xl font-black md:text-3xl"
                style={{ color: GREEN, fontFamily: "'Zen Dots', sans-serif" }}
              >
                100% QS-audit ready
              </span>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}

function MeshPipeline({ paintPct }: { paintPct: MotionValue<number> }) {
  const clip = useMotionTemplate`inset(0 ${useTransform(paintPct, (v) => 100 - v)}% 0 0)`;
  const glow = useMotionTemplate`0 0 ${useTransform(paintPct, [0, 100], [0, 80])}px ${GREEN}`;

  // Build a grid of cubes
  const cells: { x: number; y: number }[] = [];
  const cols = 10;
  const rows = 6;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) cells.push({ x, y });
  }

  return (
    <div
      className="relative aspect-[5/4] overflow-hidden rounded-3xl border border-white/10"
      style={{
        background: "radial-gradient(circle at 50% 40%, #0c1a2f 0%, #060b16 65%, #030509 100%)",
        boxShadow: `inset 0 0 120px rgba(0,0,0,0.5)`,
      }}
    >
      {/* isometric grid */}
      <svg viewBox="0 0 500 400" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="mesh-grey" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#64748b" stopOpacity="0.5" />
            <stop offset="1" stopColor="#334155" stopOpacity="0.3" />
          </linearGradient>
          <linearGradient id="mesh-green" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={GREEN} stopOpacity="0.9" />
            <stop offset="1" stopColor={GREEN} stopOpacity="0.4" />
          </linearGradient>
        </defs>

        {/* base grey mesh */}
        {cells.map((c, i) => (
          <IsoCube key={`g${i}`} x={c.x} y={c.y} fill="url(#mesh-grey)" stroke="#475569" />
        ))}
      </svg>

      {/* green painted overlay clipped by scroll */}
      <motion.svg
        viewBox="0 0 500 400"
        className="absolute inset-0 h-full w-full"
        style={{ clipPath: clip, filter: `drop-shadow(0 0 20px ${GREEN})` }}
      >
        {cells.map((c, i) => (
          <IsoCube key={`v${i}`} x={c.x} y={c.y} fill="url(#mesh-green)" stroke={GREEN} />
        ))}
      </motion.svg>

      {/* scan line */}
      <motion.div
        className="absolute top-0 h-full w-[3px]"
        style={{
          left: useMotionTemplate`${paintPct}%`,
          background: `linear-gradient(180deg, transparent, ${GREEN}, transparent)`,
          boxShadow: glow,
        }}
      />

      {/* HUD */}
      <div className="absolute left-4 top-4 flex gap-2 text-[9px] font-bold uppercase tracking-widest">
        <span className="rounded-full border border-white/15 bg-black/50 px-2.5 py-1 text-white/70 backdrop-blur">
          IFC · v4
        </span>
        <span
          className="rounded-full px-2.5 py-1 text-black backdrop-blur"
          style={{ background: GREEN }}
        >
          Live scan
        </span>
      </div>

      <div className="absolute bottom-4 right-4 rounded-full border border-white/10 bg-black/50 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-white/80 backdrop-blur">
        <CounterMV value={paintPct} suffix="%" /> verified
      </div>
    </div>
  );
}

function IsoCube({
  x,
  y,
  fill,
  stroke,
}: {
  x: number;
  y: number;
  fill: string;
  stroke: string;
}) {
  // isometric projection
  const size = 26;
  const originX = 250;
  const originY = 130;
  const px = originX + (x - y) * size;
  const py = originY + (x + y) * (size / 2);
  return (
    <g transform={`translate(${px} ${py})`}>
      <polygon
        points={`0,-${size / 2} ${size},0 0,${size / 2} -${size},0`}
        fill={fill}
        stroke={stroke}
        strokeWidth="0.6"
      />
      <polygon
        points={`0,${size / 2} ${size},0 ${size},${size} 0,${size + size / 2}`}
        fill={fill}
        fillOpacity="0.65"
        stroke={stroke}
        strokeWidth="0.6"
      />
      <polygon
        points={`0,${size / 2} -${size},0 -${size},${size} 0,${size + size / 2}`}
        fill={fill}
        fillOpacity="0.4"
        stroke={stroke}
        strokeWidth="0.6"
      />
    </g>
  );
}

function MetricCard({
  label,
  value,
  max,
  color,
  pct,
}: {
  label: string;
  value: React.ReactNode;
  max: string;
  color: string;
  pct: MotionValue<number>;
}) {
  const width = useMotionTemplate`${pct}%`;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-md"
    >
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/60">
          {label}
        </span>
        <span className="text-[10px] uppercase tracking-widest text-white/30">
          / {max}
        </span>
      </div>
      <div
        className="mt-3 text-4xl font-black md:text-5xl"
        style={{ color, fontFamily: "'Zen Dots', sans-serif" }}
      >
        {value}
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full rounded-full"
          style={{
            width,
            background: `linear-gradient(90deg, ${color}, ${color}66)`,
          }}
        />
      </div>
    </motion.div>
  );
}

function CounterMV({
  value,
  prefix,
  suffix,
}: {
  value: MotionValue<number>;
  prefix?: string;
  suffix?: string;
}) {
  const [display, setDisplay] = useState("0");
  useEffect(() => {
    const unsub = value.on("change", (v) => {
      setDisplay(Math.round(v).toLocaleString());
    });
    return unsub;
  }, [value]);
  return (
    <span>
      {prefix ?? ""}
      {display}
      {suffix ?? ""}
    </span>
  );
}

/* =============================================================
   FINAL CTA
============================================================= */
function FinalCTA() {
  return (
    <section
      className="relative overflow-hidden py-40"
      style={{
        background: `linear-gradient(180deg, ${BLACK} 0%, ${SLATE} 100%)`,
      }}
    >
      <div className="mx-auto max-w-4xl px-6 text-center">
        <motion.h3
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          className="mx-auto text-3xl font-black leading-[0.95] text-white md:text-6xl"
          style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
        >
          Autonomous.<br />
          <span style={{ color: ORANGE }}>Auditable.</span>{" "}
          <span style={{ color: GREEN }}>Alive.</span>
        </motion.h3>
        <p className="mx-auto mt-6 max-w-xl text-base text-slate-300/70 md:text-lg">
          Purpose-built for premier commercial fit-outs and urban infrastructure
          projects. Deploy in a day. Pay back in a week.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link
            to="/auth"
            search={{ trial: "start" }}
            className="inline-flex items-center gap-2 rounded-full px-8 py-4 text-xs font-bold uppercase tracking-[0.3em] text-white"
            style={{
              background: `linear-gradient(135deg, ${ORANGE} 0%, #fdba74 100%)`,
              boxShadow: `0 20px 60px -15px ${ORANGE}99`,
            }}
          >
            Start free trial <ArrowRight size={14} />
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-8 py-4 text-xs font-bold uppercase tracking-[0.3em] text-white/80 backdrop-blur-md hover:bg-white/[0.07]"
          >
            Portal
          </Link>
        </div>
        <p className="mt-14 text-[10px] uppercase tracking-[0.6em] text-white/30">
          Engineered like a film · 2026
        </p>
      </div>
    </section>
  );
}

/* =============================================================
   STICKY SECTION NAV
============================================================= */
function StickyNav() {
  const { scrollYProgress } = useScroll();
  const width = useMotionTemplate`${useTransform(scrollYProgress, [0, 1], [0, 100])}%`;

  return (
    <>
      <motion.div
        className="fixed left-0 top-0 z-50 h-[3px]"
        style={{
          width,
          background: `linear-gradient(90deg, ${ORANGE}, ${PURPLE}, ${GREEN})`,
          boxShadow: `0 0 20px ${ORANGE}`,
        }}
      />
    </>
  );
}

/* =============================================================
   PAGE
============================================================= */
function ExperiencePage() {
  return (
    <main
      className="relative w-full"
      style={{ backgroundColor: BLACK }}
    >
      <StickyNav />
      <VisionHero />
      <CommandModule />
      <RandallSlider />
      <VerificationEngine />
      <FinalCTA />
    </main>
  );
}

export default ExperiencePage;
