import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  motion,
  useScroll,
  useSpring,
  useTransform,
  animate,
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
  Layers,
  Wrench,
  Check,
  Bell,
  Cloud,
  ChevronDown,
  Camera,
  CheckCircle2,
} from "lucide-react";

export const Route = createFileRoute("/experience")({
  head: () => ({
    meta: [
      { title: "instructSite — See the Cockpit. Count the Hours." },
      {
        name: "description",
        content:
          "The AI cockpit that saves every site manager 2 hours a day. Run the ROI matrix, tour the live dashboard, and see what paper is costing you.",
      },
      { property: "og:title", content: "instructSite — See the Cockpit. Count the Hours." },
      {
        property: "og:description",
        content:
          "Interactive ROI calculator, live cockpit preview, and the six AI modules that give your PMs their Sundays back.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ExperiencePage,
});

/* ---------- App theme palette (matches main app) ---------- */
const ORANGE = "#ff7a00";
const ORANGE_SOFT = "#ffb057";
const PURPLE = "#a78bfa";
const GREEN = "#34d399";
const AMBER = "#fbbf24";
const RED = "#fb7185";
const CYAN = "#38bdf8";

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
        background: `linear-gradient(90deg, ${ORANGE}, ${ORANGE_SOFT}, ${ORANGE})`,
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
   Industry data — drives clients + testimonials + case metrics
============================================================= */
type Industry = {
  id: string;
  label: string;
  blurb: string;
  clients: string[];
  testimonials: {
    quote: string;
    name: string;
    role: string;
    company: string;
    color: string;
  }[];
  metrics: { label: string; value: number; prefix?: string; suffix?: string; color: string }[];
};

const INDUSTRIES: Industry[] = [
  {
    id: "commercial",
    label: "Commercial Fit-out",
    blurb: "Cat-A/B fit-outs, high-end office, retail rollouts. Fast programmes, tight snagging.",
    clients: ["Meridian Build Group", "Halcyon Interiors", "Blackfriars Fit-Out", "Kelvin & Rowe", "Ostara Developments", "Longacre Interiors"],
    testimonials: [
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
        quote: "Six tiles, one glove. My foremen picked it up on day one — no training deck required.",
        name: "Priya Shah",
        role: "Project Lead",
        company: "Blackfriars Fit-Out",
        color: ORANGE,
      },
    ],
    metrics: [
      { label: "Hours reclaimed", value: 42400, suffix: " h", color: ORANGE },
      { label: "Valuations closed", value: 1240000, prefix: "£", color: GREEN },
      { label: "Snags resolved", value: 9876, color: PURPLE },
    ],
  },
  {
    id: "civils",
    label: "Civils & Infrastructure",
    blurb: "Highways, rail, groundworks, utilities. Long-duration, heavy plant, weather-driven.",
    clients: ["Northwark Civils", "Trenton Highways", "Beaumont Rail", "Cavendish Infrastructure", "Grangeway Groundworks", "Silverline Utilities"],
    testimonials: [
      {
        quote: "Randall gave me back my Sundays. The Oracle is the site manager I couldn't afford to hire.",
        name: "Tom Aldridge",
        role: "Senior Project Manager",
        company: "Northwark Civils",
        color: ORANGE,
      },
      {
        quote: "Weather-driven programme risk used to eat my Mondays. Now it's on a chip in the cockpit.",
        name: "Rachel Doyle",
        role: "Contracts Manager",
        company: "Trenton Highways",
        color: CYAN,
      },
      {
        quote: "Sentinel drafts our permits-to-work in 90 seconds. NEC compensation events dropped 34%.",
        name: "Iain McConnell",
        role: "HSE Director",
        company: "Beaumont Rail",
        color: RED,
      },
    ],
    metrics: [
      { label: "Weather delays avoided", value: 380, suffix: " days", color: CYAN },
      { label: "NEC events prevented", value: 2100000, prefix: "£", color: GREEN },
      { label: "Permits issued live", value: 14520, color: ORANGE },
    ],
  },
  {
    id: "residential",
    label: "Residential & Student",
    blurb: "PRS, BTR, student accommodation, high-density housing. Repeat-plate builds, unit-level QS.",
    clients: ["Ridgemont Living", "Coppergate PRS", "Halstead Student", "Marylebone Residences", "Kingfisher Homes", "Aldwych Build-to-Rent"],
    testimonials: [
      {
        quote: "Unit-level progress and QS reconciliation across 340 flats. Interim valuations went from 3 days to 4 hours.",
        name: "Chloe Bennett",
        role: "Commercial Manager",
        company: "Ridgemont Living",
        color: GREEN,
      },
      {
        quote: "DABS turns every apartment type into a sequence card. Our packages install 22% faster.",
        name: "Daniel Osei",
        role: "Head of Delivery",
        company: "Coppergate PRS",
        color: ORANGE,
      },
      {
        quote: "The snag list on handover used to run 900 items. Photo-verified QS closed it in a fortnight.",
        name: "Emma Radcliffe",
        role: "Development Director",
        company: "Halstead Student",
        color: PURPLE,
      },
    ],
    metrics: [
      { label: "Units delivered on time", value: 4820, color: ORANGE },
      { label: "Interim payment recovery", value: 3400000, prefix: "£", color: GREEN },
      { label: "Handover snag close-out", value: 92, suffix: "%", color: PURPLE },
    ],
  },
  {
    id: "industrial",
    label: "Industrial & Logistics",
    blurb: "Sheds, data centres, logistics parks, cold storage. High-value plant, tight MEP coordination.",
    clients: ["Fenwick Industrial", "Ironbridge Logistics", "Meridian Data Centres", "Copperhouse Storage", "Vantage Sheds", "Northgate Warehousing"],
    testimonials: [
      {
        quote: "Cross-trade MEP coordination in the Oracle saved us a full sequencing re-plan. Six-figure win.",
        name: "James Whitaker",
        role: "MEP Manager",
        company: "Ironbridge Logistics",
        color: PURPLE,
      },
      {
        quote: "BIM-to-QS reconciliation on 42,000 IFC elements — verified progress landed on the same day.",
        name: "Nadia Petrov",
        role: "Digital Construction Lead",
        company: "Meridian Data Centres",
        color: GREEN,
      },
      {
        quote: "One glove for site, QS and HSE. My weekly report is now a 20-second export.",
        name: "Callum Rees",
        role: "Project Director",
        company: "Fenwick Industrial",
        color: ORANGE,
      },
    ],
    metrics: [
      { label: "IFC elements reconciled", value: 128000, color: CYAN },
      { label: "MEP clashes resolved live", value: 3200, color: PURPLE },
      { label: "Programme risk value saved", value: 5800000, prefix: "£", color: GREEN },
    ],
  },
  {
    id: "healthcare",
    label: "Healthcare & Public",
    blurb: "Hospitals, schools, custodial, defence. Heavily regulated, audit-first, phased handovers.",
    clients: ["Ashfield NHS Partners", "Redwood Education", "Marlow Custodial", "Sentinel Defence Build", "Whitcombe Health", "Rowanhill Public Works"],
    testimonials: [
      {
        quote: "Every task trails to CDM 2015 and HTM guidance. Our HSE audit went from a fortnight to an afternoon.",
        name: "Dr. Amelia Cross",
        role: "Compliance Director",
        company: "Ashfield NHS Partners",
        color: RED,
      },
      {
        quote: "Phased handover on 14 wards. QS Verifier gave the client photo-evidence progress in real time.",
        name: "Owen Hargreaves",
        role: "Senior QS",
        company: "Whitcombe Health",
        color: GREEN,
      },
      {
        quote: "Zero paper. Every RAMS, permit and diary retained under audit trail. That alone paid for it.",
        name: "Farah Al-Mansour",
        role: "Framework Manager",
        company: "Redwood Education",
        color: ORANGE,
      },
    ],
    metrics: [
      { label: "Audit prep time cut", value: 87, suffix: "%", color: RED },
      { label: "CDM findings closed", value: 1560, color: ORANGE },
      { label: "Framework contract value", value: 12400000, prefix: "£", color: GREEN },
    ],
  },
];

/* =============================================================
   HERO
============================================================= */
function Hero() {
  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 0.2], [0, -80]);
  return (
    <section className="relative min-h-[92vh] overflow-hidden flex items-center">
      <motion.div
        style={{ y }}
        className="absolute -top-40 -left-40 w-[560px] h-[560px] rounded-full blur-3xl opacity-40 pointer-events-none"
      >
        <div className="w-full h-full" style={{ background: `radial-gradient(circle, ${ORANGE}, transparent 70%)` }} />
      </motion.div>
      <motion.div
        style={{ y: useTransform(scrollYProgress, [0, 0.2], [0, 80]) }}
        className="absolute -bottom-40 -right-32 w-[620px] h-[620px] rounded-full blur-3xl opacity-30 pointer-events-none"
      >
        <div className="w-full h-full" style={{ background: `radial-gradient(circle, ${PURPLE}, transparent 70%)` }} />
      </motion.div>

      <div className="relative max-w-7xl mx-auto px-6 py-24 grid lg:grid-cols-2 gap-12 items-center w-full">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 backdrop-blur border border-white/10 text-xs font-bold uppercase tracking-[0.3em] text-white/80 mb-6"
          >
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: GREEN }} />
            Live on site · v2026.7
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.05 }}
            className="text-5xl md:text-7xl font-extrabold tracking-tight leading-[0.95] text-white"
            style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
          >
            Two hours back{" "}
            <span
              style={{
                backgroundImage: `linear-gradient(90deg, ${ORANGE}, ${ORANGE_SOFT}, ${ORANGE})`,
                backgroundSize: "200% 100%",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                animation: "shimmer 3s linear infinite",
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
            className="mt-6 text-lg md:text-xl text-white/70 max-w-xl"
          >
            instructSite is the AI cockpit that turns drawings into sequences, meetings into diaries,
            and BIM into cash. Six modules. One glove. Zero paper.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="mt-8 flex flex-wrap gap-3"
          >
            <a
              href="#roi"
              className="btn-3d-orange inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-sm uppercase tracking-wider"
            >
              Run the numbers <ArrowRight size={16} />
            </a>
            <Link
              to="/auth"
              className="glass-btn inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-sm uppercase tracking-wider text-white"
            >
              Start free trial
            </Link>
          </motion.div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="mt-10 flex flex-wrap items-center gap-6 text-sm text-white/60"
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
          <CockpitDashboard />
        </div>
      </div>
    </section>
  );
}

/* =============================================================
   INTERACTIVE COCKPIT DASHBOARD PREVIEW
   Multi-tab preview of the site-manager / subcontractor cockpit
============================================================= */
type TabKey = "cockpit" | "zones" | "qs" | "oracle";

function CockpitDashboard() {
  const [tab, setTab] = useState<TabKey>("cockpit");
  const [time, setTime] = useState<string>("");
  useEffect(() => {
    const set = () =>
      setTime(
        new Date().toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    set();
    const id = setInterval(set, 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: "easeOut" }}
      className="relative w-full max-w-[560px]"
    >
      {/* browser chrome */}
      <div
        className="rounded-2xl border border-white/10 overflow-hidden shadow-2xl"
        style={{
          background: "linear-gradient(160deg, #0f2b4a 0%, #0b1e3f 100%)",
          boxShadow: "0 40px 80px -20px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)",
        }}
      >
        {/* window bar */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" />
          <div className="ml-3 flex-1 text-[10px] tracking-widest text-white/40 font-mono truncate">
            instructsite.app / cockpit / stanley-road
          </div>
          <div className="text-[10px] text-white/40 tabular-nums">{time || "14:32"}</div>
        </div>

        {/* project header */}
        <div className="px-5 pt-4 pb-3 flex items-center justify-between gap-3 border-b border-white/5">
          <div className="min-w-0">
            <div className="text-[9px] font-bold tracking-[0.3em]" style={{ color: ORANGE }}>
              PROJECT · LIVE
            </div>
            <div className="text-white font-bold text-base truncate">
              Stanley Road · Riverside, London
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold bg-white/5 border border-white/10 text-white/80">
              <Cloud size={10} /> 12°C
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold" style={{ background: `${GREEN}20`, color: GREEN }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: GREEN }} /> LIVE
            </span>
          </div>
        </div>

        {/* tabs */}
        <div className="flex items-center gap-1 px-3 pt-3 border-b border-white/5">
          {[
            { k: "cockpit", label: "Cockpit" },
            { k: "zones", label: "Zone Matrix" },
            { k: "qs", label: "QS Queue" },
            { k: "oracle", label: "Oracle" },
          ].map((t) => {
            const active = tab === (t.k as TabKey);
            return (
              <button
                key={t.k}
                onClick={() => setTab(t.k as TabKey)}
                className="relative px-3 py-2 text-[11px] font-bold uppercase tracking-widest transition-colors"
                style={{ color: active ? "#fff" : "rgba(255,255,255,0.5)" }}
              >
                {t.label}
                {active && (
                  <motion.div
                    layoutId="cockpit-tab-underline"
                    className="absolute left-0 right-0 -bottom-px h-0.5"
                    style={{ background: ORANGE }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* tab content */}
        <div className="p-4 min-h-[380px]">
          <AnimatePresence mode="wait">
            {tab === "cockpit" && <CockpitTab key="cockpit" />}
            {tab === "zones" && <ZonesTab key="zones" />}
            {tab === "qs" && <QsTab key="qs" />}
            {tab === "oracle" && <OracleTab key="oracle" />}
          </AnimatePresence>
        </div>
      </div>

      {/* floating callouts (desktop only) */}
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.9 }}
        className="absolute -left-24 top-40 z-20 hidden xl:block"
      >
        <div className="text-[10px] font-bold tracking-[0.25em]" style={{ color: ORANGE }}>
          ● DABS
        </div>
        <div className="text-[10px] tracking-widest text-white/50">DRAWINGS → SEQUENCES</div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 1.1 }}
        className="absolute -right-24 bottom-24 z-20 hidden xl:block"
      >
        <div className="text-[10px] font-bold tracking-[0.25em]" style={{ color: PURPLE }}>
          ● ORACLE
        </div>
        <div className="text-[10px] tracking-widest text-white/50">30-YR HSE ADVISOR</div>
      </motion.div>
    </motion.div>
  );
}

function tabWrap(children: React.ReactNode) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25 }}
      className="space-y-3"
    >
      {children}
    </motion.div>
  );
}

function CockpitTab() {
  const tiles = [
    { color: ORANGE, label: "INSTALL", tag: "DABS", pulse: true },
    { color: RED, label: "SAFETY", tag: "SENTINEL" },
    { color: AMBER, label: "PROCURE", tag: "RANDALL" },
    { color: CYAN, label: "DRAWINGS", tag: "DABS" },
    { color: GREEN, label: "SNAG", tag: "QS" },
    { color: PURPLE, label: "ASSIST", tag: "ORACLE" },
  ];
  return tabWrap(
    <>
      <div className="grid grid-cols-3 gap-2">
        {tiles.map((t) => (
          <motion.div
            key={t.label}
            whileHover={{ scale: 1.04 }}
            className="relative rounded-xl p-3 h-[86px] flex flex-col justify-between border border-white/10 overflow-hidden cursor-pointer"
            style={{
              background: `linear-gradient(140deg, ${t.color}22, ${t.color}05 60%, rgba(255,255,255,0.02))`,
            }}
          >
            <motion.div
              animate={t.pulse ? { scale: [1, 1.6, 1], opacity: [1, 0, 1] } : undefined}
              transition={t.pulse ? { duration: 1.8, repeat: Infinity } : undefined}
              className="w-2 h-2 rounded-full"
              style={{ background: t.color }}
            />
            <div>
              <div className="text-white text-[13px] font-extrabold leading-none">{t.label}</div>
              <div className="text-[9px] tracking-widest text-white/50 mt-1">{t.tag}</div>
            </div>
          </motion.div>
        ))}
      </div>
      <div className="rounded-xl p-3 border border-white/10 bg-white/[0.03]">
        <div className="text-[9px] font-bold tracking-widest text-white/50 mb-2">LIVE ACTIVITY</div>
        <div className="space-y-1.5">
          <TickerRow color={GREEN} text="QS · Level 3 valuation signed · £182k" />
          <TickerRow color={ORANGE} text="DABS · Sequence A-14 published to 6 operatives" />
          <TickerRow color={PURPLE} text="Oracle · RAMS drafted for hot-works permit" />
          <TickerRow color={AMBER} text="Randall · Diary auto-filed for Level 3 fit-out" />
        </div>
      </div>
    </>,
  );
}

function ZonesTab() {
  // 4x3 grid of zones with status colors
  const zones: { id: string; status: "done" | "wip" | "planned" | "hold" }[] = [
    { id: "L1-A", status: "done" },
    { id: "L1-B", status: "done" },
    { id: "L1-C", status: "wip" },
    { id: "L1-D", status: "planned" },
    { id: "L2-A", status: "done" },
    { id: "L2-B", status: "wip" },
    { id: "L2-C", status: "wip" },
    { id: "L2-D", status: "hold" },
    { id: "L3-A", status: "planned" },
    { id: "L3-B", status: "planned" },
    { id: "L3-C", status: "planned" },
    { id: "L3-D", status: "planned" },
  ];
  const map: Record<string, { c: string; label: string }> = {
    done: { c: GREEN, label: "QS Verified" },
    wip: { c: ORANGE, label: "In Progress" },
    planned: { c: CYAN, label: "Planned" },
    hold: { c: RED, label: "On Hold" },
  };
  return tabWrap(
    <>
      <div className="text-[9px] font-bold tracking-widest text-white/50">ZONE MATRIX · LEVELS 1–3</div>
      <div className="grid grid-cols-4 gap-1.5">
        {zones.map((z, i) => {
          const cfg = map[z.status];
          return (
            <motion.div
              key={z.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.03 }}
              whileHover={{ scale: 1.06 }}
              className="rounded-lg p-2 border cursor-pointer"
              style={{
                background: `${cfg.c}18`,
                borderColor: `${cfg.c}55`,
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-white">{z.id}</span>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.c }} />
              </div>
              <div className="text-[8px] tracking-wider uppercase mt-1" style={{ color: cfg.c }}>
                {cfg.label}
              </div>
            </motion.div>
          );
        })}
      </div>
      <div className="flex items-center gap-3 pt-1 text-[9px] uppercase tracking-widest text-white/50">
        {Object.entries(map).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ background: v.c }} /> {v.label}
          </span>
        ))}
      </div>
    </>,
  );
}

function QsTab() {
  const items = [
    { zone: "L1-A", trade: "Dry-lining", value: 42800, status: "signed" as const },
    { zone: "L2-B", trade: "MEP 1st Fix", value: 128400, status: "verified" as const },
    { zone: "L2-C", trade: "Flooring", value: 18200, status: "pending" as const },
    { zone: "L3-B", trade: "Ceilings", value: 22600, status: "pending" as const },
  ];
  const statusMap = {
    signed: { c: GREEN, icon: CheckCircle2, label: "SIGNED" },
    verified: { c: CYAN, icon: Camera, label: "PHOTO-VERIFIED" },
    pending: { c: AMBER, icon: Clock, label: "PENDING" },
  };
  return tabWrap(
    <>
      <div className="flex items-center justify-between">
        <div className="text-[9px] font-bold tracking-widest text-white/50">QS VERIFICATION QUEUE</div>
        <div className="text-[10px] font-bold" style={{ color: GREEN }}>
          £212k this valuation
        </div>
      </div>
      <div className="space-y-1.5">
        {items.map((it, i) => {
          const s = statusMap[it.status];
          const Icon = s.icon;
          return (
            <motion.div
              key={it.zone}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              className="rounded-lg p-2.5 border border-white/10 bg-white/[0.03] flex items-center gap-3"
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: `${s.c}20`, color: s.c }}
              >
                <Icon size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-bold text-white truncate">
                  {it.zone} · {it.trade}
                </div>
                <div className="text-[9px] tracking-widest uppercase" style={{ color: s.c }}>
                  {s.label}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[13px] font-black text-white">£{it.value.toLocaleString()}</div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </>,
  );
}

function OracleTab() {
  return tabWrap(
    <div className="space-y-3">
      <div className="rounded-lg p-3 border border-white/10 bg-white/[0.03] text-[12px] text-white/80">
        <div className="text-[9px] font-bold tracking-widest mb-1" style={{ color: ORANGE }}>
          FOREMAN · 14:28
        </div>
        Where can I put a temporary works load on Level 3 slab without a PC sign-off?
      </div>
      <div
        className="rounded-lg p-3 border text-[12px] text-white/90 relative"
        style={{ borderColor: `${PURPLE}55`, background: `${PURPLE}12` }}
      >
        <div className="text-[9px] font-bold tracking-widest mb-1 flex items-center gap-1" style={{ color: PURPLE }}>
          <Sparkles size={11} /> ORACLE · 14:28
        </div>
        <p>
          Per <b>DWG SE-104 Rev C</b>, imposed load allowances on L3 slab are 5.0 kN/m² UDL general, 15 kN/m²
          within 1.2m of column grid lines B–D. Any pallet stack ≥ 800kg needs a temporary works cert (TWDR-14).
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5 text-[9px] font-bold tracking-widest">
          <span className="px-2 py-0.5 rounded-md" style={{ background: `${PURPLE}25`, color: PURPLE }}>
            SE-104 REV C
          </span>
          <span className="px-2 py-0.5 rounded-md" style={{ background: `${PURPLE}25`, color: PURPLE }}>
            BS EN 1991-1-1
          </span>
          <span className="px-2 py-0.5 rounded-md" style={{ background: `${ORANGE}25`, color: ORANGE }}>
            CDM 2015
          </span>
        </div>
      </div>
      <div className="text-[10px] text-white/50 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: GREEN }} />
        Answered in 11.4s · sources cited · logged to project diary
      </div>
    </div>,
  );
}

function TickerRow({ color, text }: { color: string; text: string }) {
  return (
    <div className="flex items-center gap-2 text-[11px] text-white/80">
      <span className="w-1.5 h-1.5 rounded-full animate-pulse shrink-0" style={{ background: color }} />
      <span className="truncate">{text}</span>
    </div>
  );
}

/* =============================================================
   INDUSTRY SELECTOR + CLIENTS + TESTIMONIALS
============================================================= */
function IndustrySection() {
  const [activeId, setActiveId] = useState<string>(INDUSTRIES[0].id);
  const active = useMemo(
    () => INDUSTRIES.find((i) => i.id === activeId) ?? INDUSTRIES[0],
    [activeId],
  );

  return (
    <section id="industries" className="py-24 relative">
      <div className="max-w-7xl mx-auto px-6">
        <SectionLabel color={ORANGE}>SECTION · 05 · BY INDUSTRY</SectionLabel>
        <h2
          className="text-4xl md:text-6xl font-extrabold tracking-tight mt-4 text-white"
          style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
        >
          Built for the <span style={{ color: ORANGE }}>site you run.</span>
        </h2>
        <p className="mt-4 text-lg text-white/70 max-w-2xl">
          Pick your sector. The proof updates — clients we work with, what their managers said, and the
          numbers the cohort is banking.
        </p>

        {/* selector chips */}
        <div className="mt-10 flex flex-wrap gap-2">
          {INDUSTRIES.map((ind) => {
            const isActive = ind.id === activeId;
            return (
              <button
                key={ind.id}
                onClick={() => setActiveId(ind.id)}
                className="px-4 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest border transition-all"
                style={{
                  background: isActive ? ORANGE : "rgba(255,255,255,0.04)",
                  borderColor: isActive ? ORANGE : "rgba(255,255,255,0.12)",
                  color: isActive ? "#0b1220" : "rgba(255,255,255,0.85)",
                }}
              >
                {ind.label}
              </button>
            );
          })}
        </div>

        <motion.p
          key={active.id + "-blurb"}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 text-white/60 max-w-3xl"
        >
          {active.blurb}
        </motion.p>

        {/* clients strip */}
        <div className="mt-10">
          <div className="text-[10px] font-bold tracking-[0.3em] text-white/40 mb-4">
            TRUSTED BY {active.label.toUpperCase()} CONTRACTORS
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={active.id + "-clients"}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35 }}
              className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3"
            >
              {active.clients.map((b) => (
                <div
                  key={b}
                  className="glass-panel border border-white/10 rounded-lg px-3 py-3 text-center"
                >
                  <div
                    className="text-[11px] font-black tracking-wider text-white/70"
                    style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}
                  >
                    {b.toUpperCase()}
                  </div>
                </div>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* testimonials */}
        <AnimatePresence mode="wait">
          <motion.div
            key={active.id + "-testis"}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.35 }}
            className="mt-10 grid md:grid-cols-3 gap-4"
          >
            {active.testimonials.map((t) => (
              <div
                key={t.name}
                className="glass-panel border border-white/10 rounded-2xl p-6 relative overflow-hidden"
              >
                <div
                  className="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-25 blur-xl"
                  style={{ background: t.color }}
                />
                <div className="relative">
                  <div
                    className="text-5xl font-black leading-none"
                    style={{ color: t.color, fontFamily: "'Zen Dots', sans-serif" }}
                  >
                    "
                  </div>
                  <p className="mt-1 text-white/90 leading-relaxed font-medium text-[15px]">
                    {t.quote}
                  </p>
                  <div className="mt-5 flex items-center gap-3">
                    <div
                      className="w-11 h-11 rounded-full flex items-center justify-center text-white font-black shrink-0 text-sm"
                      style={{ background: `linear-gradient(135deg, ${t.color}, #0b1220)` }}
                    >
                      {t.name
                        .split(" ")
                        .map((s) => s[0])
                        .slice(0, 2)
                        .join("")}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-white truncate">{t.name}</div>
                      <div className="text-xs text-white/50 truncate">
                        {t.role} · {t.company}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
        </AnimatePresence>

        {/* metrics */}
        <AnimatePresence mode="wait">
          <motion.div
            key={active.id + "-metrics"}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.35 }}
            className="mt-10 grid md:grid-cols-3 gap-4"
          >
            {active.metrics.map((m) => (
              <BigMetric
                key={m.label}
                label={m.label}
                value={m.value}
                prefix={m.prefix}
                suffix={m.suffix}
                color={m.color}
              />
            ))}
          </motion.div>
        </AnimatePresence>
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
    <section id="modules" className="py-24 relative">
      <div className="max-w-7xl mx-auto px-6">
        <SectionLabel color={ORANGE}>SECTION · 02 · SIX MODULES</SectionLabel>
        <h2
          className="text-4xl md:text-6xl font-extrabold tracking-tight mt-4 text-white"
          style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
        >
          One glove.{" "}
          <span style={{ color: ORANGE }}>Six commands.</span>{" "}
          <span style={{ color: PURPLE }}>Zero paper.</span>
        </h2>
        <p className="mt-4 text-lg text-white/70 max-w-2xl">
          A progressive web app that installs to the home screen and behaves like a native cockpit.
          Every module was built by construction people, for construction people.
        </p>

        <div className="mt-12 grid gap-3">
          {MODULES.map((m) => {
            const isOpen = open === m.id;
            const Icon = m.icon;
            return (
              <motion.div
                key={m.id}
                layout
                className="glass-panel rounded-2xl border overflow-hidden"
                style={{ borderColor: isOpen ? m.color : "rgba(255,255,255,0.08)" }}
              >
                <button
                  onClick={() => setOpen(isOpen ? null : m.id)}
                  className="w-full grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3 md:gap-4 p-4 md:p-5 text-left hover:bg-white/[0.03] transition-colors"
                >
                  <div
                    className="w-11 h-11 md:w-12 md:h-12 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `${m.color}20`, color: m.color }}
                  >
                    <Icon size={22} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-3 flex-wrap">
                      <span className="text-lg md:text-xl font-black text-white">{m.name}</span>
                      <span className="text-xs md:text-sm text-white/50 font-medium truncate">
                        {m.tag}
                      </span>
                    </div>
                  </div>
                  <div
                    className="text-[10px] md:text-xs font-bold px-2 md:px-3 py-1.5 rounded-full shrink-0 hidden sm:block"
                    style={{ background: `${m.color}18`, color: m.color }}
                  >
                    Saves {m.saves}
                  </div>
                  <motion.div animate={{ rotate: isOpen ? 180 : 0 }} className="shrink-0">
                    <ChevronDown size={20} className="text-white/40" />
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
                      <div className="px-5 pb-5 md:pl-[76px] grid md:grid-cols-2 gap-6">
                        <p className="text-white/80 leading-relaxed">{m.what}</p>
                        <div className="text-sm">
                          <div className="text-white/50 uppercase tracking-widest text-xs font-bold mb-1">
                            Who uses it
                          </div>
                          <div className="text-white/90 font-medium">{m.who}</div>
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

  const DABS_MIN = 40;
  const DIARY_MIN = 60;
  const QS_MIN_WEEK = 120;
  const QS_MIN_DAY = QS_MIN_WEEK / 5;

  const adoptionFactor = adoption / 100;
  const perManagerMinsPerDay = (DABS_MIN + DIARY_MIN + QS_MIN_DAY) * adoptionFactor;

  const hoursPerDay = (managers * perManagerMinsPerDay) / 60;
  const hoursPerMonth = hoursPerDay * days;
  const hoursPerYear = hoursPerDay * days * 12;

  const hourlyRate = dayRate / 8;
  const savingsMonth = Math.round(hoursPerMonth * hourlyRate);
  const savingsYear = Math.round(hoursPerYear * hourlyRate);
  const extraManagers = (hoursPerMonth / (days * 8)).toFixed(1);

  const INSTRUCT_COST_PER_MANAGER = 89;
  const totalCost = INSTRUCT_COST_PER_MANAGER * managers;
  const roi = totalCost > 0 ? Math.round((savingsMonth / totalCost) * 100) : 0;

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
        <h2
          className="text-4xl md:text-6xl font-extrabold tracking-tight mt-4 text-white"
          style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
        >
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
        <p className="mt-4 text-lg text-white/70 max-w-2xl">
          Drag the sliders. Watch the meter run. Every minute your managers spend on admin is a minute
          they aren't running the job.
        </p>

        <div className="mt-12 grid lg:grid-cols-2 gap-6">
          <div className="glass-panel rounded-3xl p-6 md:p-8 border border-white/10">
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
              unit=""
              display={`£${dayRate.toLocaleString()}/day`}
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

            <div className="mt-8">
              <div className="text-xs font-bold tracking-widest text-white/50 mb-2">
                MINUTES SAVED PER MANAGER PER DAY
              </div>
              <div className="flex h-10 rounded-full overflow-hidden shadow-inner border border-white/10">
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
              <div className="mt-2 text-sm text-white/60">
                {Math.round(perManagerMinsPerDay)} minutes / manager / day at {adoption}% adoption
              </div>
            </div>
          </div>

          <div
            className="rounded-3xl p-6 md:p-8 border border-white/10 relative overflow-hidden"
            style={{
              background: `linear-gradient(135deg, #0f2b4a, #0b1e3f)`,
              boxShadow: "0 30px 60px -20px rgba(0,0,0,0.5)",
            }}
          >
            <div
              className="absolute inset-0 opacity-30 pointer-events-none"
              style={{ background: `radial-gradient(circle at 70% 20%, ${GREEN}, transparent 50%)` }}
            />
            <div className="relative">
              <div className="text-xs font-bold tracking-[0.3em]" style={{ color: GREEN }}>
                YOUR ANNUAL SAVINGS
              </div>
              <div className="mt-2 text-5xl md:text-7xl font-extrabold text-white" style={{ fontFamily: "'Zen Dots', sans-serif" }}>
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
                <div className="flex justify-between items-baseline gap-4">
                  <div className="min-w-0">
                    <div className="text-xs text-white/50 uppercase tracking-widest">Cost of instructSite</div>
                    <div className="text-2xl font-black mt-1 text-white">
                      £{totalCost.toLocaleString()}
                      <span className="text-sm text-white/50 font-normal">/mo</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs text-white/50 uppercase tracking-widest">Monthly ROI</div>
                    <div className="text-3xl font-black" style={{ color: GREEN }}>
                      <Counter to={roi} suffix="%" />
                    </div>
                  </div>
                </div>
                <div className="mt-3 text-xs text-white/50">
                  Every £1 spent on instructSite returns{" "}
                  <b className="text-white">£{(roi / 100).toFixed(2)}</b> in reclaimed manager time.
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid md:grid-cols-3 gap-4">
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
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="mb-6 last:mb-0">
      <div className="flex justify-between items-center mb-2 gap-3">
        <label className="flex items-center gap-2 text-sm font-bold text-white/80 min-w-0">
          <span style={{ color }}>{icon}</span>
          <span className="truncate">{label}</span>
        </label>
        <div className="text-lg font-black text-white shrink-0">
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
          background: `linear-gradient(90deg, ${color} 0%, ${color} ${pct}%, rgba(255,255,255,0.12) ${pct}%, rgba(255,255,255,0.12) 100%)`,
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
      <div className="text-xs text-white/50 uppercase tracking-widest">{label}</div>
      <div className="text-2xl font-black mt-1 text-white">
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
    <div className="glass-panel rounded-2xl p-5 border border-white/10 flex items-center gap-4">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `${color}20`, color }}
      >
        <Icon size={22} />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-white/50 font-medium truncate">{label}</div>
        <div className="font-black text-lg text-white">{value}</div>
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
    <section className="py-24 relative">
      <div className="max-w-7xl mx-auto px-6">
        <SectionLabel color={PURPLE}>SECTION · 04 · A DAY IN THE LIFE</SectionLabel>
        <h2
          className="text-4xl md:text-6xl font-extrabold tracking-tight mt-4 text-white"
          style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
        >
          06:45 to 17:00. <span style={{ color: PURPLE }}>Every minute earning.</span>
        </h2>

        <div className="mt-16 relative">
          <div className="absolute left-8 md:left-1/2 top-0 bottom-0 w-0.5 bg-white/10" />
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
                  className="absolute left-8 md:left-1/2 -translate-x-1/2 w-4 h-4 rounded-full ring-4"
                  style={{ background: t.color, boxShadow: `0 0 0 4px rgba(11,30,63,1)` }}
                />
                <div className={i % 2 === 0 ? "md:text-right md:pr-12" : "md:pl-12"}>
                  <div className="text-3xl font-black" style={{ color: t.color, fontFamily: "'Zen Dots', sans-serif" }}>
                    {t.time}
                  </div>
                  <div className="text-xl font-bold mt-1 text-white">{t.label}</div>
                  <div className="text-white/70 mt-1">{t.detail}</div>
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
   BIG METRIC
============================================================= */
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
    <div ref={ref} className="glass-panel rounded-2xl p-6 border border-white/10 text-center">
      <div className="text-xs uppercase tracking-widest text-white/50 font-bold">{label}</div>
      <div className="text-4xl md:text-5xl font-black mt-2" style={{ color, fontFamily: "'Zen Dots', sans-serif" }}>
        {inView ? <Counter to={value} prefix={prefix} suffix={suffix} duration={1.8} /> : `${prefix || ""}0${suffix || ""}`}
      </div>
      <div className="text-xs text-white/50 mt-1">Across our beta cohort</div>
    </div>
  );
}

function useInView(): [React.RefObject<HTMLDivElement | null>, boolean] {
  const ref = useRef<HTMLDivElement | null>(null);
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
    <section id="compliance" className="py-24 relative">
      <div className="max-w-7xl mx-auto px-6">
        <SectionLabel color={GREEN}>SECTION · 06 · COMPLIANCE</SectionLabel>
        <h2
          className="text-4xl md:text-6xl font-extrabold tracking-tight mt-4 text-white"
          style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
        >
          Built for <span style={{ color: GREEN }}>HSE inspections.</span>
        </h2>
        <div className="mt-12 grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((it) => {
            const Icon = it.icon;
            return (
              <div
                key={it.label}
                className="glass-panel rounded-2xl p-6 border border-white/10 hover:border-emerald-400/40 transition-colors"
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: `${GREEN}20`, color: GREEN }}
                >
                  <Icon size={20} />
                </div>
                <div className="font-bold mt-3 text-white">{it.label}</div>
                <div className="text-sm text-white/70 mt-1">{it.detail}</div>
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
    <section id="faq" className="py-24 relative">
      <div className="max-w-4xl mx-auto px-6">
        <SectionLabel color={CYAN}>SECTION · 07 · FAQ</SectionLabel>
        <h2
          className="text-4xl md:text-6xl font-extrabold tracking-tight mt-4 text-white"
          style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
        >
          Answers, <span style={{ color: CYAN }}>on the trowel.</span>
        </h2>
        <div className="mt-10 space-y-3">
          {FAQS.map((f, i) => (
            <div key={f.q} className="glass-panel rounded-2xl border border-white/10 overflow-hidden">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between gap-4 p-5 text-left"
              >
                <span className="font-bold text-lg text-white">{f.q}</span>
                <motion.div animate={{ rotate: open === i ? 180 : 0 }} className="shrink-0">
                  <ChevronDown className="text-white/50" />
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
                    <div className="px-5 pb-5 text-white/70">{f.a}</div>
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
    <section className="py-24 relative">
      <div className="max-w-5xl mx-auto px-6">
        <div
          className="relative rounded-[40px] p-12 md:p-20 text-center overflow-hidden shadow-2xl border border-white/10"
          style={{
            background: `linear-gradient(135deg, ${ORANGE}, #b95400)`,
          }}
        >
          <div className="absolute inset-0 opacity-30" style={{ background: `radial-gradient(circle at 30% 30%, white, transparent 50%)` }} />
          <div className="relative">
            <h2
              className="text-4xl md:text-6xl font-extrabold text-white tracking-tight"
              style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
            >
              Stop paying managers to type.
            </h2>
            <p className="mt-4 text-lg md:text-xl text-white/90 max-w-2xl mx-auto">
              Start your free 14-day trial. No card. No fluff. Just two hours a day, per manager, back
              where they belong.
            </p>
            <div className="mt-8 flex flex-wrap gap-4 justify-center">
              <Link
                to="/auth"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-black text-lg bg-white text-[#0b1e3f] hover:scale-105 transition-transform"
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
    <div
      className="inline-flex items-center gap-2 text-xs font-black tracking-[0.3em]"
      style={{ color }}
    >
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
    <div className="min-h-screen relative text-white">
      <div className="aurora-bg" />
      <div className="grain-overlay" />
      <ProgressBar />

      {/* nav */}
      <nav className="fixed top-0 left-0 right-0 z-40 backdrop-blur-md bg-[#0b1e3f]/70 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <Link
            to="/"
            className="font-extrabold text-lg tracking-tight text-white"
            style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
          >
            <span style={{ color: ORANGE }}>instruct</span>Site
          </Link>
          <div className="hidden md:flex items-center gap-6 text-xs font-bold uppercase tracking-widest text-white/70">
            <a href="#modules" className="hover:text-white">Modules</a>
            <a href="#roi" className="hover:text-white">ROI</a>
            <a href="#industries" className="hover:text-white">Industries</a>
            <a href="#compliance" className="hover:text-white">Compliance</a>
            <a href="#faq" className="hover:text-white">FAQ</a>
          </div>
          <Link
            to="/auth"
            className="btn-3d-orange inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs uppercase tracking-wider"
          >
            Start free
          </Link>
        </div>
      </nav>

      <div className="relative pt-16">
        <Hero />
        <ModulesSection />
        <ROIMatrix />
        <DayInTheLife />
        <IndustrySection />
        <Compliance />
        <FAQ />
        <FinalCTA />

        <footer className="py-10 border-t border-white/10">
          <div className="max-w-7xl mx-auto px-6 text-center text-sm text-white/50">
            © {new Date().getFullYear()} instructSite · Built by construction people, for construction
            people.
          </div>
        </footer>
      </div>
    </div>
  );
}
