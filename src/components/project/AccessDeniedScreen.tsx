import { Link, useParams, useRouter } from "@tanstack/react-router";
import { ShieldAlert, ArrowLeft, KeyRound, Loader2 } from "lucide-react";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { claimMasterAdmin } from "@/lib/dev-admin.functions";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export function AccessDeniedScreen({ message }: { message?: string }) {
  const isAccessError = /access denied|not a member|forbidden/i.test(
    message ?? "",
  );
  const router = useRouter();
  const params = useParams({ strict: false }) as { projectId?: string };
  const claim = useServerFn(claimMasterAdmin);
  const [loading, setLoading] = useState(false);

  const onClaim = async () => {
    setLoading(true);
    try {
      await claim({ data: { projectId: params.projectId } });
      await supabase.auth.refreshSession();
      toast.success("Master admin granted. Reloading…");
      router.invalidate();
      setTimeout(() => window.location.reload(), 400);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to elevate role");
      setLoading(false);
    }
  };

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

        <button
          type="button"
          onClick={onClaim}
          disabled={loading}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md border-2 border-amber-400/60 bg-amber-500/20 px-4 py-3 text-xs font-bold uppercase tracking-widest text-amber-200 shadow-[0_0_20px_rgba(251,191,36,0.25)] transition hover:bg-amber-500/30 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <KeyRound size={14} />
          )}
          Dev Override: Claim Master Admin
        </button>
        <p className="mt-2 text-[10px] uppercase tracking-widest text-amber-300/60">
          Temporary development escalation
        </p>

        <Link
          to="/projects"
          className="mt-4 inline-flex items-center gap-2 rounded-md border border-white/15 px-4 py-2 text-xs uppercase tracking-widest text-foreground/70 hover:border-alert hover:text-alert"
        >
          <ArrowLeft size={14} /> Back to projects
        </Link>
      </div>
    </div>
  );
}
