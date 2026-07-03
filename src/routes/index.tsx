import { Link, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Site Operations Oracle" },
      {
        name: "description",
        content:
          "Premium AI tooling for installation, safety, procurement, drawings, snagging, and on-site assistance.",
      },
      { property: "og:title", content: "Site Operations Oracle" },
      {
        property: "og:description",
        content: "Premium AI tooling for site operations.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-background">
      <div className="aurora-bg" />
      <div className="grain-overlay" />

      <div className="relative mx-auto flex max-w-6xl flex-col items-start gap-10 px-6 py-24">
        <div className="glass-panel max-w-3xl p-10">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.3em] text-alert">
            AI · Site Operations
          </p>
          <h1
            className="text-5xl font-extrabold leading-tight tracking-tight text-foreground md:text-6xl"
            style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
          >
            Site Operations Oracle
          </h1>
          <p className="mt-5 max-w-xl text-base text-foreground/80">
            Premium AI tooling for installation, safety, procurement,
            drawings, snagging, and on-site assistance — engineered for the
            field.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/oracle"
              className="glass-orange shimmer-btn rounded-xl px-5 py-3 text-sm uppercase tracking-wider"
            >
              Open Oracle Tooling
            </Link>
            <Link
              to="/oracle"
              className="glass-btn rounded-xl px-5 py-3 text-sm uppercase tracking-wider"
            >
              View Modules
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
