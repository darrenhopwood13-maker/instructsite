import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  motion,
  useScroll,
  useSpring,
  useTransform,
  animate,
  useMotionValue,
  AnimatePresence,
} from "framer-motion";
import {
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Clock,
  PoundSterling,
  Users,
  TrendingUp,
  Zap,
  FileText,
  HardHat,
  ClipboardCheck,
  MessageCircle,
  Layers,
  Wrench,
  Check,
  Bell,
  Cloud,
  ChevronDown,
} from "lucide-react";

export const Route = createFileRoute("/experience")({
  head: () => ({
    meta: [
      { title: "InstructSite — See the Cockpit. Count the Hours." },
      {
        name: "description",
        content:
          "The AI cockpit that saves every site manager 2 hours a day. See the real interface, run the ROI numbers, and find out what paper is costing you.",
      },
      { property: "og:title", content: "InstructSite — See the Cockpit. Count the Hours." },
      {
        property: "og:description",
        content:
          "Interactive ROI calculator, real cockpit preview, and the six AI modules that give your PMs their Sundays back.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ExperiencePage,
});

/* ---------- palette (light theme) ---------- */
const ORANGE = "#FB923C";
const PURPLE = "#8B5CF6";
const GREEN = "#10B981";
const AMBER = "#F59E0B";
const RED = "#F43F5E";
const CYAN = "#06B6D4";
const INK = "#0F172A";
const CANVAS = "#FAF7F2";

/* =============================================================
   Progress bar
============================================================= */
function ProgressBar() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 200, damping: 30 });
  return (
    <motion.div
      className="fixed top-0 left-0 right-0 h-1 z-50 origin-left"
      style={{
        scaleX,
        background: `linear-gradient(90deg, ${ORANGE}, ${PURPLE}, ${GREEN})`,
      }}
    />
  );
}

/* =============================================================
   Animated counter
============================================================= */
function Counter({
  to,
  prefix = "",
  suffix = "",
  duration = 1.2,
  decimals = 0,
}: {
  to: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  decimals?: number;
}) {
  const [val, setVal] = useState(to);
  const ref = useRef(to);
  useEffect(() => {
    const controls = animate(ref.current, to, {
      duration,
      ease: "easeOut",
      onUpdate: (v) => {
        ref.current = v;
        setVal(v);
      },
    });
    return () => controls.stop();
  }, [to, duration]);
  const formatted = val.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return (
    <span>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

/* =============================================================
   HERO
============================================================= */
function Hero() {
  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 0.2], [0, -80]);
  return (
    <section className="relative min-h-[92vh] overflow-hidden flex items-center">
      {/* gradient blobs */}
      <motion.div
        style={{ y }}
        className="absolute -top-40 -left-40 w-[560px] h-[560px] rounded-full blur-3xl opacity-40"
      >
        <div className="w-full h-full" style={{ background: `radial-gradient(circle, ${ORANGE}, transparent 70%)` }} />
      </motion.div>
      <motion.div
        style={{ y: useTransform(scrollYProgress, [0, 0.2], [0, 80]) }}
        className="absolute -bottom-40 -right-32 w-[620px] h-[620px] rounded-full blur-3xl opacity-40"
      >
        <div className="w-full h-full" style={{ background: `radial-gradient(circle, ${PURPLE}, transparent 70%)` }} />
      </motion.div>
      <motion.div
        className="absolute top-1/2 left-1/2 w-[400px] h-[400px] rounded-full blur-3xl opacity-30"
        style={{ background: `radial-gradient(circle, ${GREEN}, transparent 70%)` }}
      />

      <div className="relative max-w-7xl mx-auto px-6 py-24 grid lg:grid-cols-2 gap-16 items-center w-full">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/70 backdrop-blur border border-slate-200 text-sm font-medium text-slate-700 mb-6"
          >
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: GREEN }} />
            Live on site · v2026.7
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.05 }}
            className="text-5xl md:text-7xl font-black tracking-tight leading-[0.95]"
            style={{ color: INK }}
          >
            Two hours back{" "}
            <span
              style={{
                background: `linear-gradient(90deg, ${ORANGE}, ${PURPLE})`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              per manager,
            </span>
            <br />
            every single day.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="mt-6 text-lg md:text-xl text-slate-600 max-w-xl"
          >
            InstructSite is the AI cockpit that turns drawings into sequences, meetings into diaries,
            and BIM into cash. Six modules. One glove. Zero paper.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="mt-8 flex flex-wrap gap-4"
          >
            <a
              href="#roi"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-white shadow-lg hover:scale-105 transition-transform"
              style={{ background: `linear-gradient(90deg, ${ORANGE}, ${AMBER})` }}
            >
              Run the numbers <ArrowRight size={18} />
            </a>
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold border-2 border-slate-900 text-slate-900 hover:bg-slate-900 hover:text-white transition-colors"
            >
              Start free trial
            </Link>
          </motion.div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="mt-10 flex items-center gap-6 text-sm text-slate-500"
          >
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} style={{ color: GREEN }} /> CDM 2015 ready
            </div>
            <div className="flex items-center gap-2">
              <Sparkles size={16} style={{ color: PURPLE }} /> Powered by The Oracle
            </div>
          </motion.div>
        </div>

        <div className="flex justify-center lg:justify-end">
          <CockpitMock />
        </div>
      </div>
    </section>
  );
}

/* =============================================================
   COCKPIT MOCK — recreates the real subcontractor cockpit
============================================================= */
function CockpitMock({ scale = 1 }: { scale?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40, rotateX: 20 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ duration: 0.9, ease: "easeOut" }}
      whileHover={{ y: -6 }}
      style={{ transformPerspective: 1200, transformStyle: "preserve-3d", scale }}
      className="relative"
    >
      {/* callout: DABS */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.9 }}
        className="absolute -left-20 top-56 z-20 hidden md:block"
      >
        <div className="text-[10px] font-bold tracking-[0.2em]" style={{ color: ORANGE }}>
          ● DABS
        </div>
        <div className="text-[10px] tracking-widest text-slate-500">DRAWINGS → SEQUENCES</div>
        <svg width="80" height="20" className="mt-1">
          <path d="M0 10 L75 10" stroke={ORANGE} strokeWidth="1.5" strokeDasharray="3 3" />
        </svg>
      </motion.div>

      {/* callout: Oracle FAB */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 1.1 }}
        className="absolute -right-24 bottom-24 z-20 hidden md:block"
      >
        <div className="text-[10px] font-bold tracking-[0.2em]" style={{ color: PURPLE }}>
          ● ORACLE
        </div>
        <div className="text-[10px] tracking-widest text-slate-500">30-YR HSE ADVISOR</div>
      </motion.div>

      {/* phone frame */}
      <div
        className="relative w-[320px] h-[660px] rounded-[52px] p-3 shadow-2xl"
        style={{
          background: "linear-gradient(145deg, #1e293b, #0f172a)",
          boxShadow: "0 40px 80px -20px rgba(15,23,42,0.35), 0 0 0 1px rgba(255,255,255,0.06)",
        }}
      >
        <div className="w-full h-full rounded-[42px] overflow-hidden relative" style={{ background: "#0B1220" }}>
          {/* notch */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-6 rounded-full bg-black z-10" />
          {/* status bar */}
          <div className="flex justify-between items-center px-6 pt-3 text-white text-xs">
            <span>09:41</span>
            <div className="flex items-center gap-1 opacity-80">
              <Cloud size={11} /> 5G
            </div>
          </div>

          {/* content */}
          <div className="px-4 pt-6 space-y-3">
            {/* project header card */}
            <div className="rounded-2xl p-4 border border-white/5" style={{ background: "linear-gradient(135deg, rgba(251,146,60,0.12), rgba(139,92,246,0.08))" }}>
              <div className="text-[9px] font-bold tracking-[0.25em]" style={{ color: ORANGE }}>
                PROJECT · LIVE
              </div>
              <div className="text-white font-bold text-base mt-1">Premier Commercial Fit-out</div>
              <div className="flex justify-between items-center mt-2 text-[11px] text-slate-400">
                <span className="flex items-center gap-1">
                  <Cloud size={10} /> 12°C · Cloudy
                </span>
                <span>14:32</span>
              </div>
            </div>

            {/* tiles grid */}
            <div className="grid grid-cols-2 gap-2.5">
              <MockTile color={ORANGE} label="INSTALL" tag="DABS" pulse />
              <MockTile color={RED} label="SAFETY" tag="SENTINEL" />
              <MockTile color={AMBER} label="PROCURE" tag="RANDALL" />
              <MockTile color={CYAN} label="DRAWINGS" tag="DABS" />
              <MockTile color={GREEN} label="SNAG" tag="QS" />
              <MockTile color={PURPLE} label="ASSIST" tag="ORACLE" />
            </div>

            {/* live activity ticker */}
            <div className="rounded-xl p-3 border border-white/5 bg-white/[0.03]">
              <div className="text-[9px] font-bold tracking-widest text-slate-400 mb-1.5">LIVE ACTIVITY</div>
              <div className="space-y-1.5">
                <TickerRow color={GREEN} text="QS · Level 3 valuation signed" />
                <TickerRow color={ORANGE} text="DABS · Sequence A-14 published" />
                <TickerRow color={PURPLE} text="Oracle · RAMS drafted" />
              </div>
            </div>
          </div>

          {/* Oracle FAB */}
          <motion.div
            animate={{ boxShadow: [`0 0 0 0 ${PURPLE}66`, `0 0 0 16px ${PURPLE}00`] }}
            transition={{ duration: 1.8, repeat: Infinity }}
            className="absolute bottom-6 right-5 w-14 h-14 rounded-full flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${PURPLE}, #6D28D9)` }}
          >
            <Sparkles size={22} className="text-white" />
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

function MockTile({
  color,
  label,
  tag,
  pulse,
}: {
  color: string;
  label: string;
  tag: string;
  pulse?: boolean;
}) {
  return (
    <motion.div
      whileHover={{ scale: 1.03 }}
      className="relative rounded-xl p-3 h-[74px] flex flex-col justify-between border border-white/5 overflow-hidden"
      style={{ background: `linear-gradient(140deg, ${color}22, ${color}08 60%, rgba(255,255,255,0.02))` }}
    >
      <motion.div
        animate={pulse ? { scale: [1, 1.6, 1], opacity: [1, 0, 1] } : undefined}
        transition={pulse ? { duration: 1.8, repeat: Infinity } : undefined}
        className="w-2 h-2 rounded-full"
        style={{ background: color }}
      />
      <div>
        <div className="text-white text-[13px] font-bold leading-none">{label}</div>
        <div className="text-[9px] tracking-widest text-slate-400 mt-1">{tag}</div>
      </div>
    </motion.div>
  );
}

function TickerRow({ color, text }: { color: string; text: string }) {
  return (
    <div className="flex items-center gap-2 text-[10px] text-slate-300">
      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: color }} />
      {text}
    </div>
  );
}

/* =============================================================
   TRUST STRIP
============================================================= */
function TrustStrip() {
  const brands = [
    "Meridian Build Group",
    "Halcyon Interiors",
    "Northwark Civils",
    "Blackfriars Fit-Out",
    "Kelvin & Rowe",
    "Ostara Developments",
  ];
  return (
    <section className="py-14 border-y border-slate-200 bg-white/60">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center text-xs font-bold tracking-[0.3em] text-slate-500 mb-8">
          TRUSTED ON SITES ACROSS THE UK
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
          {brands.map((b) => (
            <div
              key={b}
              className="text-center text-slate-700 font-black text-sm tracking-wider opacity-70 hover:opacity-100 transition-opacity"
              style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}
            >
              {b.toUpperCase()}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* =============================================================
   SIX MODULES DEEP-DIVE
============================================================= */
const MODULES = [
  {
    id: "dabs",
    name: "DABS",
    tag: "Drawings → Sequences",
    color: ORANGE,
    icon: FileText,
    saves: "40 min / day",
    who: "Site managers & foremen",
    what:
      "Feed DABS a GA drawing or spec sheet. It returns a numbered, plain-English installation sequence, with hand-off criteria and safety checkpoints baked in.",
  },
  {
    id: "sentinel",
    name: "Sentinel",
    tag: "Permits & RAMS",
    color: RED,
    icon: ShieldCheck,
    saves: "60 min / permit",
    who: "HSE managers",
    what:
      "Drafts hot-works, working-at-height and confined-space permits from a task description. Every doc trails to CDM 2015, HSG150, Work at Height Regs.",
  },
  {
    id: "randall",
    name: "Randall",
    tag: "Programme → Diary",
    color: AMBER,
    icon: ClipboardCheck,
    saves: "60 min / day",
    who: "Senior PMs",
    what:
      "Import the master Gantt. Randall turns it into a day-to-a-page playbook, tracks slippage, and files the diary automatically.",
  },
  {
    id: "drawings",
    name: "Drawings",
    tag: "Vision Q&A",
    color: CYAN,
    icon: Layers,
    saves: "20 min / query",
    who: "Everyone on site",
    what:
      "Ask a drawing anything. Grid refs, RFI-worthy clashes, revision deltas. Answers cite the file, the sheet, and the callout.",
  },
  {
    id: "qs",
    name: "QS Verifier",
    tag: "BIM → Money",
    color: GREEN,
    icon: PoundSterling,
    saves: "120 min / week",
    who: "Quantity surveyors",
    what:
      "Reconciles model quantities against site progress. Valuations that used to take two days close in forty minutes.",
  },
  {
    id: "oracle",
    name: "The Oracle",
    tag: "30-yr HSE Advisor",
    color: PURPLE,
    icon: Sparkles,
    saves: "Priceless",
    who: "Anyone with a question",
    what:
      "A decorated 30-year site manager, HSE director and Fellow of every UK institution — grounded in your Project Bible.",
  },
];

function ModulesSection() {
  const [open, setOpen] = useState<string | null>("dabs");
  return (
    <section className="py-24 relative">
      <div className="max-w-7xl mx-auto px-6">
        <SectionLabel color={ORANGE}>SECTION · 02 · SIX MODULES</SectionLabel>
        <h2 className="text-4xl md:text-6xl font-black tracking-tight mt-4" style={{ color: INK }}>
          One glove.{" "}
          <span style={{ color: ORANGE }}>Six commands.</span>{" "}
          <span style={{ color: PURPLE }}>Zero paper.</span>
        </h2>
        <p className="mt-4 text-lg text-slate-600 max-w-2xl">
          A progressive web app that installs to the home screen and behaves like a native cockpit. Every
          module was built by construction people, for construction people.
        </p>

        <div className="mt-12 grid gap-3">
          {MODULES.map((m) => {
            const isOpen = open === m.id;
            const Icon = m.icon;
            return (
              <motion.div
                key={m.id}
                layout
                className="rounded-2xl border-2 bg-white overflow-hidden"
                style={{ borderColor: isOpen ? m.color : "#E2E8F0" }}
              >
                <button
                  onClick={() => setOpen(isOpen ? null : m.id)}
                  className="w-full flex items-center gap-4 p-5 text-left hover:bg-slate-50 transition-colors"
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `${m.color}20`, color: m.color }}
                  >
                    <Icon size={22} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-baseline gap-3 flex-wrap">
                      <span className="text-xl font-black" style={{ color: INK }}>
                        {m.name}
                      </span>
                      <span className="text-sm text-slate-500 font-medium">{m.tag}</span>
                    </div>
                  </div>
                  <div
                    className="text-xs font-bold px-3 py-1.5 rounded-full"
                    style={{ background: `${m.color}15`, color: m.color }}
                  >
                    Saves {m.saves}
                  </div>
                  <motion.div animate={{ rotate: isOpen ? 180 : 0 }}>
                    <ChevronDown size={20} className="text-slate-400" />
                  </motion.div>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-5 pl-[76px] grid md:grid-cols-2 gap-6">
                        <p className="text-slate-700 leading-relaxed">{m.what}</p>
                        <div className="text-sm">
                          <div className="text-slate-500 uppercase tracking-widest text-xs font-bold mb-1">
                            Who uses it
                          </div>
                          <div className="text-slate-800 font-medium">{m.who}</div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* =============================================================
   ROI MATRIX
============================================================= */
function ROIMatrix() {
  const [managers, setManagers] = useState(6);
  const [dayRate, setDayRate] = useState(450);
  const [adoption, setAdoption] = useState(70);
  const [days, setDays] = useState(21);

  // savings model
  const DABS_MIN = 40; // per manager per day
  const DIARY_MIN = 60; // per manager per day
  const QS_MIN_WEEK = 120; // per manager per week → per day
  const QS_MIN_DAY = QS_MIN_WEEK / 5;

  const adoptionFactor = adoption / 100;
  const perManagerMinsPerDay = (DABS_MIN + DIARY_MIN + QS_MIN_DAY) * adoptionFactor;

  const hoursPerDay = (managers * perManagerMinsPerDay) / 60;
  const hoursPerWeek = hoursPerDay * 5;
  const hoursPerMonth = hoursPerDay * days;
  const hoursPerYear = hoursPerDay * days * 12;

  const hourlyRate = dayRate / 8;
  const savingsMonth = Math.round(hoursPerMonth * hourlyRate);
  const savingsYear = Math.round(hoursPerYear * hourlyRate);
  const extraManagers = (hoursPerMonth / (days * 8)).toFixed(1);

  const INSTRUCT_COST_PER_MANAGER = 89; // £/mo placeholder
  const totalCost = INSTRUCT_COST_PER_MANAGER * managers;
  const roi = totalCost > 0 ? Math.round((savingsMonth / totalCost) * 100) : 0;

  // stacked bar percentages
  const total = DABS_MIN + DIARY_MIN + QS_MIN_DAY;
  const dabsPct = (DABS_MIN / total) * 100;
  const diaryPct = (DIARY_MIN / total) * 100;
  const qsPct = (QS_MIN_DAY / total) * 100;

  const bigWin = savingsYear > 100000;

  return (
    <section id="roi" className="py-24 relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{
          background: `radial-gradient(circle at 20% 30%, ${ORANGE}22, transparent 50%), radial-gradient(circle at 80% 70%, ${GREEN}22, transparent 50%)`,
        }}
      />
      <div className="relative max-w-7xl mx-auto px-6">
        <SectionLabel color={GREEN}>SECTION · 03 · THE ROI MATRIX</SectionLabel>
        <h2 className="text-4xl md:text-6xl font-black tracking-tight mt-4" style={{ color: INK }}>
          How much is{" "}
          <span
            style={{
              background: `linear-gradient(90deg, ${ORANGE}, ${RED})`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            paper
          </span>{" "}
          costing you?
        </h2>
        <p className="mt-4 text-lg text-slate-600 max-w-2xl">
          Drag the sliders. Watch the meter run. Every minute your managers spend on admin is a minute
          they aren't running the job.
        </p>

        <div className="mt-12 grid lg:grid-cols-2 gap-8">
          {/* inputs */}
          <div className="bg-white rounded-3xl p-8 border-2 border-slate-100 shadow-xl">
            <SliderRow
              label="Site managers"
              value={managers}
              min={1}
              max={20}
              step={1}
              onChange={setManagers}
              unit={managers === 1 ? "manager" : "managers"}
              icon={<Users size={18} />}
              color={ORANGE}
            />
            <SliderRow
              label="Average day rate"
              value={dayRate}
              min={250}
              max={800}
              step={25}
              onChange={setDayRate}
              unit={`£${dayRate.toLocaleString()}/day`}
              display=""
              icon={<PoundSterling size={18} />}
              color={AMBER}
            />
            <SliderRow
              label="Adoption"
              value={adoption}
              min={10}
              max={100}
              step={10}
              onChange={setAdoption}
              unit="%"
              icon={<TrendingUp size={18} />}
              color={PURPLE}
            />
            <SliderRow
              label="Working days / month"
              value={days}
              min={15}
              max={26}
              step={1}
              onChange={setDays}
              unit="days"
              icon={<Clock size={18} />}
              color={GREEN}
            />

            {/* stacked bar */}
            <div className="mt-8">
              <div className="text-xs font-bold tracking-widest text-slate-500 mb-2">
                MINUTES SAVED PER MANAGER PER DAY
              </div>
              <div className="flex h-10 rounded-full overflow-hidden shadow-inner">
                <motion.div
                  animate={{ width: `${dabsPct}%` }}
                  className="flex items-center justify-center text-white text-xs font-bold"
                  style={{ background: ORANGE }}
                >
                  DABS 40
                </motion.div>
                <motion.div
                  animate={{ width: `${diaryPct}%` }}
                  className="flex items-center justify-center text-white text-xs font-bold"
                  style={{ background: PURPLE }}
                >
                  Diary 60
                </motion.div>
                <motion.div
                  animate={{ width: `${qsPct}%` }}
                  className="flex items-center justify-center text-white text-xs font-bold"
                  style={{ background: GREEN }}
                >
                  QS 24
                </motion.div>
              </div>
              <div className="mt-2 text-sm text-slate-500">
                {Math.round(perManagerMinsPerDay)} minutes / manager / day at {adoption}% adoption
              </div>
            </div>
          </div>

          {/* outputs */}
          <div
            className="rounded-3xl p-8 shadow-2xl text-white relative overflow-hidden"
            style={{
              background: `linear-gradient(135deg, #0F172A, #1E293B)`,
            }}
          >
            <div
              className="absolute inset-0 opacity-30 pointer-events-none"
              style={{
                background: `radial-gradient(circle at 70% 20%, ${GREEN}, transparent 50%)`,
              }}
            />
            <div className="relative">
              <div className="text-xs font-bold tracking-[0.3em] text-emerald-300">
                YOUR ANNUAL SAVINGS
              </div>
              <div className="mt-2 text-6xl md:text-7xl font-black">
                <Counter to={savingsYear} prefix="£" />
              </div>
              {bigWin && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold"
                  style={{ background: `${GREEN}30`, color: GREEN }}
                >
                  <Zap size={12} /> BIG WIN — Six-figure recovery
                </motion.div>
              )}

              <div className="mt-8 grid grid-cols-2 gap-4">
                <Stat label="Per month" value={savingsMonth} prefix="£" />
                <Stat label="Hours / month" value={Math.round(hoursPerMonth)} suffix=" h" />
                <Stat label="Hours / year" value={Math.round(hoursPerYear)} suffix=" h" />
                <Stat label="Extra managers unlocked" value={parseFloat(extraManagers)} decimals={1} />
              </div>

              <div className="mt-8 pt-6 border-t border-white/10">
                <div className="flex justify-between items-baseline">
                  <div>
                    <div className="text-xs text-slate-400 uppercase tracking-widest">Cost of InstructSite</div>
                    <div className="text-2xl font-black mt-1">£{totalCost.toLocaleString()}<span className="text-sm text-slate-400 font-normal">/mo</span></div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-400 uppercase tracking-widest">Monthly ROI</div>
                    <div className="text-3xl font-black" style={{ color: GREEN }}>
                      <Counter to={roi} suffix="%" />
                    </div>
                  </div>
                </div>
                <div className="mt-3 text-xs text-slate-400">
                  Every £1 spent on InstructSite returns <b className="text-white">£{(roi / 100).toFixed(2)}</b> in reclaimed manager time.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* breakdown ribbon */}
        <div className="mt-8 grid md:grid-cols-3 gap-4">
          <MetricCard color={ORANGE} icon={FileText} label="DABS · Drawings → Sequences" value="40 min / manager / day" />
          <MetricCard color={PURPLE} icon={ClipboardCheck} label="Diary & progress recording" value="60 min / manager / day" />
          <MetricCard color={GREEN} icon={PoundSterling} label="QS payment verification" value="120 min / manager / week" />
        </div>
      </div>
    </section>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
  unit,
  display,
  icon,
  color,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  unit: string;
  display?: string;
  icon?: React.ReactNode;
  color: string;
}) {
  return (
    <div className="mb-6 last:mb-0">
      <div className="flex justify-between items-center mb-2">
        <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
          <span style={{ color }}>{icon}</span>
          {label}
        </label>
        <div className="text-lg font-black" style={{ color: INK }}>
          {display !== undefined ? display : `${value} ${unit}`.trim()}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(90deg, ${color} 0%, ${color} ${
            ((value - min) / (max - min)) * 100
          }%, #E2E8F0 ${((value - min) / (max - min)) * 100}%, #E2E8F0 100%)`,
        }}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  prefix,
  suffix,
  decimals,
}: {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}) {
  return (
    <div>
      <div className="text-xs text-slate-400 uppercase tracking-widest">{label}</div>
      <div className="text-2xl font-black mt-1">
        <Counter to={value} prefix={prefix} suffix={suffix} decimals={decimals} />
      </div>
    </div>
  );
}

function MetricCard({
  color,
  icon: Icon,
  label,
  value,
}: {
  color: string;
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-5 border-2 border-slate-100 flex items-center gap-4">
      <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}20`, color }}>
        <Icon size={22} />
      </div>
      <div>
        <div className="text-xs text-slate-500 font-medium">{label}</div>
        <div className="font-black text-lg" style={{ color: INK }}>{value}</div>
      </div>
    </div>
  );
}

/* =============================================================
   DAY IN THE LIFE
============================================================= */
const DAY_TIMELINE = [
  { time: "06:45", label: "Site opens", detail: "Weather chip auto-pulled. Programme risk flagged.", color: ORANGE },
  { time: "07:15", label: "Toolbox talk", detail: "Sentinel drafts today's RAMS in 90 seconds.", color: RED },
  { time: "09:30", label: "Drawing question", detail: "Foreman asks Oracle a fire-stop query. Answered in 12s.", color: PURPLE },
  { time: "11:00", label: "Sequence issued", detail: "DABS produces install sequence for Level 4 dry-lining.", color: ORANGE },
  { time: "14:00", label: "QS visit", detail: "Verifier reconciles progress. Valuation ready.", color: GREEN },
  { time: "17:00", label: "Diary auto-filed", detail: "Randall compiles the day-to-a-page. No typing.", color: AMBER },
];

function DayInTheLife() {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <SectionLabel color={PURPLE}>SECTION · 04 · A DAY IN THE LIFE</SectionLabel>
        <h2 className="text-4xl md:text-6xl font-black tracking-tight mt-4" style={{ color: INK }}>
          06:45 to 17:00. <span style={{ color: PURPLE }}>Every minute earning.</span>
        </h2>

        <div className="mt-16 relative">
          <div className="absolute left-8 md:left-1/2 top-0 bottom-0 w-0.5 bg-slate-200" />
          <div className="space-y-8">
            {DAY_TIMELINE.map((t, i) => (
              <motion.div
                key={t.time}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ delay: i * 0.05 }}
                className={`relative pl-20 md:pl-0 md:grid md:grid-cols-2 md:gap-16 items-center ${
                  i % 2 === 0 ? "" : "md:[&>*:first-child]:col-start-2"
                }`}
              >
                <div
                  className="absolute left-8 md:left-1/2 -translate-x-1/2 w-4 h-4 rounded-full ring-4 ring-white"
                  style={{ background: t.color }}
                />
                <div className={i % 2 === 0 ? "md:text-right md:pr-12" : "md:pl-12"}>
                  <div className="text-3xl font-black" style={{ color: t.color }}>
                    {t.time}
                  </div>
                  <div className="text-xl font-bold mt-1" style={{ color: INK }}>
                    {t.label}
                  </div>
                  <div className="text-slate-600 mt-1">{t.detail}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* =============================================================
   TESTIMONIALS
============================================================= */
const TESTIMONIALS = [
  {
    quote: "We closed a £1.2M valuation in 40 minutes instead of two days. My QS thinks I hired her a team.",
    name: "Sarah Ellis",
    role: "Commercial Director",
    company: "Meridian Build Group",
    color: GREEN,
  },
  {
    quote: "My site managers stopped drowning in WhatsApps. Diaries file themselves and Sundays are mine again.",
    name: "Marcus Whitfield",
    role: "Operations Director",
    company: "Halcyon Interiors",
    color: PURPLE,
  },
  {
    quote: "Randall gave me back my Sundays. The Oracle is the site manager I couldn't afford to hire.",
    name: "Tom Aldridge",
    role: "Senior Project Manager",
    company: "Northwark Civils",
    color: ORANGE,
  },
];

function Testimonials() {
  return (
    <section className="py-24">
      <div className="max-w-7xl mx-auto px-6">
        <SectionLabel color={AMBER}>SECTION · 05 · FROM THE SITE</SectionLabel>
        <h2 className="text-4xl md:text-6xl font-black tracking-tight mt-4" style={{ color: INK }}>
          People who <span style={{ color: AMBER }}>build things</span> say it best.
        </h2>

        <div className="mt-12 grid md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ y: -6 }}
              className="bg-white rounded-3xl p-7 border-2 border-slate-100 shadow-lg relative overflow-hidden"
            >
              <div
                className="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-20"
                style={{ background: t.color }}
              />
              <div className="text-5xl font-black leading-none" style={{ color: t.color }}>
                "
              </div>
              <p className="mt-2 text-slate-800 leading-relaxed font-medium">{t.quote}</p>
              <div className="mt-6 flex items-center gap-3">
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center text-white font-black shrink-0"
                  style={{ background: `linear-gradient(135deg, ${t.color}, ${INK})` }}
                >
                  {t.name
                    .split(" ")
                    .map((s) => s[0])
                    .join("")}
                </div>
                <div>
                  <div className="font-bold text-sm" style={{ color: INK }}>
                    {t.name}
                  </div>
                  <div className="text-xs text-slate-500">
                    {t.role} · {t.company}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* case study metrics */}
        <div className="mt-12 grid md:grid-cols-3 gap-4">
          <BigMetric label="Hours reclaimed" value={42400} suffix=" h" color={ORANGE} />
          <BigMetric label="Valuations closed" value={1240000} prefix="£" color={GREEN} />
          <BigMetric label="Snags resolved" value={9876} color={PURPLE} />
        </div>
      </div>
    </section>
  );
}

function BigMetric({
  label,
  value,
  prefix,
  suffix,
  color,
}: {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  color: string;
}) {
  const [ref, inView] = useInView();
  return (
    <div ref={ref} className="bg-white rounded-2xl p-6 border-2 border-slate-100 text-center">
      <div className="text-xs uppercase tracking-widest text-slate-500 font-bold">{label}</div>
      <div className="text-4xl md:text-5xl font-black mt-2" style={{ color }}>
        {inView ? <Counter to={value} prefix={prefix} suffix={suffix} duration={1.8} /> : `${prefix || ""}0${suffix || ""}`}
      </div>
      <div className="text-xs text-slate-500 mt-1">Across our beta cohort</div>
    </div>
  );
}

function useInView(): [React.RefObject<HTMLDivElement>, boolean] {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setInView(true);
      },
      { threshold: 0.3 },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return [ref, inView];
}

/* =============================================================
   COMPLIANCE
============================================================= */
function Compliance() {
  const items = [
    { icon: ShieldCheck, label: "CDM 2015", detail: "Every task, RAMS and permit trails to CDM duties." },
    { icon: HardHat, label: "HSG150 & HSG151", detail: "Site safety standards built into Sentinel." },
    { icon: Wrench, label: "Work at Height Regs", detail: "Automated high-risk flags & permits." },
    { icon: ClipboardCheck, label: "Audit trail", detail: "Every action stamped. RLS-backed data." },
    { icon: Bell, label: "Real-time alerts", detail: "Permit expiry, weather, near-miss triggers." },
    { icon: Check, label: "Data ownership", detail: "Your data. Export anytime. No lock-in." },
  ];
  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <SectionLabel color={GREEN}>SECTION · 06 · COMPLIANCE</SectionLabel>
        <h2 className="text-4xl md:text-6xl font-black tracking-tight mt-4" style={{ color: INK }}>
          Built for <span style={{ color: GREEN }}>HSE inspections.</span>
        </h2>
        <div className="mt-12 grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((it) => {
            const Icon = it.icon;
            return (
              <div key={it.label} className="bg-slate-50 rounded-2xl p-6 border border-slate-100 hover:border-emerald-300 transition-colors">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${GREEN}20`, color: GREEN }}>
                  <Icon size={20} />
                </div>
                <div className="font-bold mt-3" style={{ color: INK }}>
                  {it.label}
                </div>
                <div className="text-sm text-slate-600 mt-1">{it.detail}</div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* =============================================================
   FAQ
============================================================= */
const FAQS = [
  { q: "How long does onboarding take?", a: "Under an hour. Upload your Project Bible (drawings, spec, programme) and the six modules configure themselves." },
  { q: "Does it work offline?", a: "Yes. The PWA caches your project. Log activities, diaries and photos with no signal — they sync when you're back." },
  { q: "Can I import my existing programme?", a: "Import Asta, MS Project, P6 exports. Randall converts them into the day-to-a-page playbook automatically." },
  { q: "Who owns the data?", a: "You do. Full export at any time. Row-level security means only your team sees your projects." },
  { q: "How is it priced?", a: "Per active manager per month. No seat fees for operatives or subcontractors. Cancel anytime." },
  { q: "What if my team hates new software?", a: "Six tiles. One purple button. It behaves like Instagram, not SAP. Adoption in our beta cohort is above 90%." },
];

function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="py-24">
      <div className="max-w-4xl mx-auto px-6">
        <SectionLabel color={CYAN}>SECTION · 07 · FAQ</SectionLabel>
        <h2 className="text-4xl md:text-6xl font-black tracking-tight mt-4" style={{ color: INK }}>
          Answers, <span style={{ color: CYAN }}>on the trowel.</span>
        </h2>
        <div className="mt-10 space-y-3">
          {FAQS.map((f, i) => (
            <div
              key={f.q}
              className="bg-white rounded-2xl border-2 border-slate-100 overflow-hidden"
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between p-5 text-left"
              >
                <span className="font-bold text-lg" style={{ color: INK }}>{f.q}</span>
                <motion.div animate={{ rotate: open === i ? 180 : 0 }}>
                  <ChevronDown className="text-slate-400" />
                </motion.div>
              </button>
              <AnimatePresence initial={false}>
                {open === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-5 text-slate-600">{f.a}</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* =============================================================
   CTA
============================================================= */
function FinalCTA() {
  return (
    <section className="py-24">
      <div className="max-w-5xl mx-auto px-6">
        <div
          className="relative rounded-[40px] p-12 md:p-20 text-center overflow-hidden shadow-2xl"
          style={{
            background: `linear-gradient(135deg, ${ORANGE}, ${PURPLE})`,
          }}
        >
          <div className="absolute inset-0 opacity-30" style={{ background: `radial-gradient(circle at 30% 30%, white, transparent 50%)` }} />
          <div className="relative">
            <h2 className="text-4xl md:text-6xl font-black text-white tracking-tight">
              Stop paying managers to type.
            </h2>
            <p className="mt-4 text-lg md:text-xl text-white/90 max-w-2xl mx-auto">
              Start your free 14-day trial. No card. No fluff. Just two hours a day, per manager, back where they belong.
            </p>
            <div className="mt-8 flex flex-wrap gap-4 justify-center">
              <Link
                to="/auth"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-black text-lg bg-white hover:scale-105 transition-transform"
                style={{ color: INK }}
              >
                Get started free <ArrowRight size={20} />
              </Link>
              <a
                href="#roi"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-black text-lg border-2 border-white text-white hover:bg-white/10"
              >
                Run the numbers again
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* =============================================================
   Helpers
============================================================= */
function SectionLabel({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <div className="inline-flex items-center gap-2 text-xs font-black tracking-[0.3em]" style={{ color }}>
      <span className="w-8 h-px" style={{ background: color }} />
      {children}
    </div>
  );
}

/* =============================================================
   PAGE
============================================================= */
function ExperiencePage() {
  return (
    <div className="min-h-screen" style={{ background: CANVAS, color: INK }}>
      <ProgressBar />

      {/* nav */}
      <nav className="fixed top-0 left-0 right-0 z-40 backdrop-blur-md bg-white/70 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="font-black text-lg tracking-tight" style={{ color: INK }}>
            Instruct<span style={{ color: ORANGE }}>Site</span>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#roi" className="hover:text-slate-900">ROI</a>
            <a href="#modules" className="hover:text-slate-900">Modules</a>
            <a href="#compliance" className="hover:text-slate-900">Compliance</a>
            <a href="#faq" className="hover:text-slate-900">FAQ</a>
          </div>
          <Link
            to="/auth"
            className="px-4 py-2 rounded-full text-sm font-bold text-white"
            style={{ background: INK }}
          >
            Start free
          </Link>
        </div>
      </nav>

      <div className="pt-16">
        <Hero />
        <TrustStrip />
        <div id="modules"><ModulesSection /></div>
        <ROIMatrix />
        <DayInTheLife />
        <Testimonials />
        <div id="compliance"><Compliance /></div>
        <div id="faq"><FAQ /></div>
        <FinalCTA />

        <footer className="py-10 border-t border-slate-200">
          <div className="max-w-7xl mx-auto px-6 text-center text-sm text-slate-500">
            © {new Date().getFullYear()} InstructSite · Built by construction people, for construction people.
          </div>
        </footer>
      </div>
    </div>
  );
}
