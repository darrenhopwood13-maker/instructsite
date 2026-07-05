import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Link2, PlusCircle, Trash2, HardHat, Check, X, Building2, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  createSubcontractorInvite,
  listSubcontractorInvites,
  revokeSubcontractorInvite,
} from "@/lib/subcontractors.functions";

const TRADE_PACKAGES = [
  "Structural Steels",
  "Groundworks",
  "Drylining",
  "M&E",
  "Concrete Frame",
  "Cladding & Facade",
  "Roofing",
  "Joinery",
  "Fit-Out",
  "Ceilings",
  "Painting",
  "Flooring",
  "Glazing",
];

export function TradeDirectoryPanel({ projectId }: { projectId: string }) {
  const listFn = useServerFn(listSubcontractorInvites);
  const createFn = useServerFn(createSubcontractorInvite);
  const revokeFn = useServerFn(revokeSubcontractorInvite);
  const qc = useQueryClient();

  const invites = useQuery({
    queryKey: ["subcontractor-invites", projectId],
    queryFn: () => listFn({ data: { projectId } }),
  });

  const [companyName, setCompanyName] = useState("");
  const [packages, setPackages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [freshLink, setFreshLink] = useState<{ url: string; company: string } | null>(null);

  const togglePackage = (p: string) =>
    setPackages((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || packages.length === 0) return;
    setBusy(true);
    try {
      const res = await createFn({
        data: {
          projectId,
          companyName: companyName.trim(),
          tradePackages: packages,
        },
      });
      const url = `${window.location.origin}/invite/${res.token}`;
      setFreshLink({ url, company: companyName.trim() });
      setCompanyName("");
      setPackages([]);
      qc.invalidateQueries({ queryKey: ["subcontractor-invites", projectId] });
      toast.success("Invite generated.");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to create invite.");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: string) => {
    try {
      await revokeFn({ data: { inviteId: id } });
      qc.invalidateQueries({ queryKey: ["subcontractor-invites", projectId] });
      toast.success("Invite revoked.");
    } catch (e: any) {
      toast.error(e?.message ?? "Revoke failed.");
    }
  };

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard.");
    } catch {
      toast.error("Copy failed.");
    }
  };

  const list = useMemo(() => invites.data ?? [], [invites.data]);

  return (
    <div className="mt-4 rounded-lg border border-alert/50 bg-black/60 p-3">
      <div className="flex items-center gap-2">
        <HardHat className="text-alert" size={14} />
        <p className="font-mono text-[0.6rem] font-bold uppercase tracking-[0.28em] text-alert">
          Project Trade Directory
        </p>
      </div>

      <form onSubmit={submit} className="mt-3 grid gap-2">
        <input
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          placeholder="Subcontractor company name"
          className="rounded-md border border-white/15 bg-black/50 px-2.5 py-2 font-mono text-xs text-foreground outline-none focus:border-alert"
        />
        <div>
          <p className="mb-1.5 font-mono text-[0.55rem] uppercase tracking-widest text-foreground/50">
            Trade Packages ({packages.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {TRADE_PACKAGES.map((p) => {
              const on = packages.includes(p);
              return (
                <button
                  type="button"
                  key={p}
                  onClick={() => togglePackage(p)}
                  className={`rounded-sm border px-2 py-1 font-mono text-[0.6rem] uppercase tracking-widest transition ${
                    on
                      ? "border-alert bg-alert/20 text-alert"
                      : "border-white/15 text-foreground/60 hover:border-white/40"
                  }`}
                >
                  {p}
                </button>
              );
            })}
          </div>
        </div>
        <button
          type="submit"
          disabled={busy || !companyName.trim() || packages.length === 0}
          className="glass-orange inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-[0.65rem] uppercase tracking-widest disabled:opacity-40"
        >
          <PlusCircle size={12} /> Generate Subcontractor Access
        </button>
      </form>

      {freshLink && (
        <div className="mt-3 rounded-md border border-emerald-400/40 bg-emerald-400/5 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="font-mono text-[0.6rem] font-bold uppercase tracking-widest text-emerald-300">
              Live Invite · {freshLink.company}
            </p>
            <button
              type="button"
              onClick={() => setFreshLink(null)}
              className="rounded-sm border border-white/20 p-1 text-foreground/60 hover:text-foreground"
              aria-label="Close"
            >
              <X size={12} />
            </button>
          </div>
          <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-center">
            <div className="rounded-md bg-white p-2">
              <QRCodeSVG value={freshLink.url} size={128} level="M" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="mb-1 font-mono text-[0.55rem] uppercase tracking-widest text-foreground/60">
                Invite Link
              </p>
              <div className="flex items-center gap-2 rounded-md border border-emerald-400/40 bg-black/70 px-2 py-1.5">
                <Link2 size={12} className="shrink-0 text-emerald-300" />
                <input
                  readOnly
                  value={freshLink.url}
                  onFocus={(e) => e.currentTarget.select()}
                  className="w-full bg-transparent font-mono text-xs text-foreground outline-none"
                />
                <button
                  type="button"
                  onClick={() => copy(freshLink.url)}
                  className="inline-flex items-center gap-1 rounded-sm border border-emerald-400/60 bg-emerald-400/10 px-2 py-1 font-mono text-[0.55rem] uppercase tracking-widest text-emerald-200 hover:bg-emerald-400/20"
                >
                  <Copy size={10} /> Copy
                </button>
              </div>
              <p className="mt-2 text-[0.65rem] text-foreground/60">
                Anyone opening this link becomes a subcontractor on this project and is routed
                directly to DABS.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-3 max-h-64 overflow-y-auto rounded-md border border-white/10 bg-black/40">
        {list.length === 0 && (
          <p className="p-3 text-center text-xs text-foreground/50">No subcontractors invited yet.</p>
        )}
        {list.map((inv: any) => {
          const status = inv.revoked_at
            ? { label: "Revoked", cls: "border-destructive/60 text-destructive-foreground" }
            : inv.accepted_at
              ? { label: "Accepted", cls: "border-emerald-400/50 text-emerald-300" }
              : new Date(inv.expires_at) < new Date()
                ? { label: "Expired", cls: "border-white/30 text-foreground/50" }
                : { label: "Pending", cls: "border-alert/60 text-alert" };
          return (
            <div
              key={inv.id}
              className="flex items-center justify-between gap-2 border-b border-white/8 px-2.5 py-2 last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-xs text-foreground/90">{inv.company_name}</p>
                <div className="mt-0.5 flex flex-wrap gap-1">
                  {(inv.trade_packages ?? []).map((t: string) => (
                    <span
                      key={t}
                      className="rounded-sm border border-white/15 px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-widest text-foreground/70"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <span
                className={`inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 font-mono text-[0.55rem] uppercase tracking-widest ${status.cls}`}
              >
                {status.label === "Accepted" && <Check size={10} />}
                {status.label}
              </span>
              {!inv.revoked_at && !inv.accepted_at && (
                <button
                  type="button"
                  onClick={() => revoke(inv.id)}
                  className="rounded-sm border border-destructive/60 p-1 text-destructive-foreground hover:bg-destructive/20"
                  title="Revoke"
                >
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
