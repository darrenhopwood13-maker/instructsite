import { Link } from "@tanstack/react-router";
import { ArrowLeft, Ban } from "lucide-react";

/**
 * Plain panel rendered in place of any billing / subscription surface
 * while BILLING_ENABLED is false.
 */
export function NotAvailablePanel({
  title = "Not available",
  message = "This section is not available.",
}: {
  title?: string;
  message?: string;
}) {
  return (
    <div className="min-h-screen bg-[#0A192F] text-white">
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full border-2 border-white/15 bg-white/5">
          <Ban size={22} className="text-white/50" />
        </span>
        <h1
          className="mt-6 text-3xl font-black tracking-tight"
          style={{ fontFamily: "'Zen Dots', 'Inter Tight', sans-serif" }}
        >
          {title}
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-white/60">{message}</p>
        <div className="mt-10">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-[0.65rem] font-bold uppercase tracking-[0.32em] text-white/50 hover:text-white"
          >
            <ArrowLeft size={12} /> Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
