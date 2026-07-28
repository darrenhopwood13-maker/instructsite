import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ExternalLink, RotateCcw, PartyPopper, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { GuideDemo } from "@/components/guide/GuideDemo";
import { MISSIONS } from "@/components/guide/missions";
import { Term, GLOSSARY } from "@/components/guide/Term";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/start")({
  head: () => ({
    meta: [
      { title: "Quick Start — instructSite" },
      { name: "description", content: "A 10-minute guided setup for your first site on instructSite." },
      { property: "og:title", content: "Quick Start — instructSite" },
      { property: "og:description", content: "Ten short missions to get your first project running." },
    ],
  }),
  component: StartPage,
});

const STORAGE_PREFIX = "instructsite:start:done:";

function useDone() {
  const [userId, setUserId] = useState<string>("anon");
  const [done, setDone] = useState<Record<string, boolean>>({});
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const id = data.user?.id ?? "anon";
      setUserId(id);
      try {
        const raw = localStorage.getItem(STORAGE_PREFIX + id);
        setDone(raw ? JSON.parse(raw) : {});
      } catch { /* noop */ }
    });
  }, []);
  const persist = useCallback((next: Record<string, boolean>) => {
    setDone(next);
    try { localStorage.setItem(STORAGE_PREFIX + userId, JSON.stringify(next)); } catch { /* noop */ }
  }, [userId]);
  const toggle = useCallback((id: string) => {
    persist({ ...done, [id]: !done[id] });
  }, [done, persist]);
  const reset = useCallback(() => persist({}), [persist]);
  return { done, toggle, reset };
}

function StartPage() {
  const { done, toggle, reset } = useDone();
  const total = MISSIONS.length;
  const completed = useMemo(() => MISSIONS.filter((m) => done[m.id]).length, [done]);
  const allDone = completed === total;

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-background">
      <div className="aurora-bg print:hidden" />
      <div className="grain-overlay print:hidden" />

      <PrintStyles />

      <div className="relative mx-auto max-w-5xl px-6 py-14 print:py-4">
        {/* Hero */}
        <header className="text-center print:text-left">
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.4em] text-alert">Quick Start · ~10 minutes</p>
          <h1
            className="mt-3 text-4xl font-extrabold uppercase tracking-tight text-foreground md:text-6xl"
            style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
          >
            Build your first site
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-foreground/70">
            Ten short missions. Each one shows you exactly what to click, why it matters, and links
            you straight to the real screen. Want the deep dive? Read <Link to="/manual" className="underline decoration-alert underline-offset-2">the full manual</Link>.
          </p>
          <div className="mt-6 flex justify-center print:hidden">
            <a href="#m1" className="glass-orange shimmer-btn inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm uppercase tracking-widest">
              Start
            </a>
          </div>
        </header>

        {/* Progress rail */}
        <div className="sticky top-16 z-20 mt-10 print:hidden">
          <div className="glass-panel flex flex-wrap items-center gap-3 rounded-xl px-4 py-3">
            <div className="text-xs font-bold uppercase tracking-widest text-foreground">
              {completed} of {total} missions done
            </div>
            <div className="flex flex-1 flex-wrap gap-1">
              {MISSIONS.map((m) => (
                <a
                  key={m.id}
                  href={`#${m.id}`}
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-bold",
                    done[m.id]
                      ? "border-alert bg-alert/20 text-alert"
                      : "border-border bg-muted/40 text-foreground/60",
                  )}
                  title={m.title}
                >
                  {done[m.id] ? <Check size={12} /> : m.number}
                </a>
              ))}
            </div>
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-1 text-[11px] uppercase tracking-widest text-foreground/60 hover:text-foreground"
            >
              <RotateCcw size={12} /> Reset progress
            </button>
          </div>
        </div>

        {/* Celebration */}
        {allDone && (
          <div className="glass-panel mt-8 rounded-xl border border-alert bg-alert/10 p-6 text-center">
            <PartyPopper className="mx-auto text-alert" size={32} />
            <h2 className="mt-2 text-2xl font-extrabold uppercase tracking-tight">You're set up.</h2>
            <p className="mt-1 text-sm text-foreground/70">
              All ten missions done. Your first site is live — go run it.
            </p>
          </div>
        )}

        {/* Missions */}
        <div className="mt-10 space-y-8">
          {MISSIONS.map((m) => {
            const isDone = !!done[m.id];
            return (
              <Card
                id={m.id}
                key={m.id}
                className={cn(
                  "scroll-mt-40 border-border/60 bg-card/60 backdrop-blur transition-colors",
                  isDone && "border-alert/60",
                )}
              >
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border text-sm font-extrabold",
                        isDone ? "border-alert bg-alert/10 text-alert" : "border-border bg-muted/40 text-foreground",
                      )}
                    >
                      {isDone ? <Check size={16} /> : m.number}
                    </div>
                    <div>
                      <CardTitle className="text-xl font-extrabold uppercase tracking-tight">{m.title}</CardTitle>
                      <p className="mt-1 text-sm text-foreground/70">
                        <span className="font-semibold text-foreground/90">Why it matters — </span>{m.why}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <GuideDemo steps={m.steps} mock={<MissionMock k={m.mockKey} />} />

                  <div className="flex flex-wrap items-center gap-2 print:hidden">
                    <a
                      href={m.deepLink}
                      target="_blank"
                      rel="noreferrer"
                      className="glass-orange inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs uppercase tracking-widest"
                    >
                      Try it now <ExternalLink size={12} />
                    </a>
                    <Button
                      variant={isDone ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggle(m.id)}
                      className="gap-1.5"
                    >
                      <Check size={14} />
                      {isDone ? "Done" : "Mark as done"}
                    </Button>
                  </div>

                  <p className="text-[11px] uppercase tracking-widest text-foreground/50">
                    <span className="font-bold text-alert">If it goes wrong · </span>{m.ifWrong}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Glossary */}
        <Collapsible className="mt-12">
          <CollapsibleTrigger className="glass-panel flex w-full items-center justify-between rounded-xl px-4 py-3 text-left">
            <div>
              <div className="text-[0.7rem] font-bold uppercase tracking-[0.4em] text-alert">Jargon Buster</div>
              <div className="text-lg font-extrabold uppercase tracking-tight">Glossary</div>
            </div>
            <ChevronDown size={16} />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 space-y-2">
            {Object.entries(GLOSSARY).map(([term, def]) => (
              <div key={term} className="rounded-lg border border-border bg-card/40 p-3">
                <div className="text-sm font-bold capitalize text-foreground">{term}</div>
                <div className="text-sm text-foreground/70">{def}</div>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>

        {/* Sample glossary use so Term is exercised */}
        <p className="mt-8 text-center text-xs text-foreground/50 print:hidden">
          Hover any underlined word — like <Term>RAMS</Term>, <Term>DABS</Term> or <Term>the Oracle</Term> — for a plain-English definition.
        </p>
      </div>
    </div>
  );
}

function PrintStyles() {
  return (
    <style>{`
      @media print {
        body { background: white !important; color: black !important; }
        .print\\:hidden { display: none !important; }
        header h1 { font-size: 24pt !important; }
        .glass-panel, .aurora-bg, .grain-overlay { background: none !important; box-shadow: none !important; }
        [id^="m"] { page-break-inside: avoid; break-inside: avoid; border: 1px solid #ccc !important; margin-bottom: 8pt; }
      }
    `}</style>
  );
}
