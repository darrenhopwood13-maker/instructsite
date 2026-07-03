import { Link, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center bg-background p-6">
      <div className="max-w-2xl border-4 border-neo-brutalist-border bg-background p-8 shadow-neo-brutalist">
        <h1 className="text-4xl font-black uppercase tracking-tight text-foreground">
          Site Operations Oracle
        </h1>
        <p className="mt-4 text-muted-foreground">
          AI-powered tooling for installation, safety, procurement, drawings,
          snagging, and on-site assistance.
        </p>
        <div className="mt-8">
          <Link to="/oracle" className="neo-button">
            Open Oracle Tooling
          </Link>
        </div>
      </div>
    </div>
  );
}
