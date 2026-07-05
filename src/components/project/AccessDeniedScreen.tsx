import { Link } from "@tanstack/react-router";
import { ShieldAlert, ArrowLeft } from "lucide-react";

export function AccessDeniedScreen({ message }: { message?: string }) {
  const isAccessError = /access denied|not a member|forbidden/i.test(
    message ?? "",
  );
  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden bg-background px-4">
      <div className="aurora-bg" />
      <div className="glass-panel relative z-10 max-w-md p-8 text-center">
        <ShieldAlert className="mx-auto mb-4 text-alert" size={40} />
        <h1 className="text-lg font-bold uppercase tracking-[0.35em] text-alert">
          {isAccessError ? "Access Restricted" : "Unable to load project"}
        </h1>
        <p className="mt-3 text-sm text-foreground/70">
          {isAccessError
            ? "You are not a member of this project. Ask a project admin to invite you."
            : (message ?? "Something went wrong loading this project.")}
        </p>
        <Link
          to="/projects"
          className="mt-6 inline-flex items-center gap-2 rounded-md border border-white/15 px-4 py-2 text-xs uppercase tracking-widest text-foreground/70 hover:border-alert hover:text-alert"
        >
          <ArrowLeft size={14} /> Back to projects
        </Link>
      </div>
    </div>
  );
}
