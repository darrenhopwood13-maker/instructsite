import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { AlertTriangle, PlusCircle, ShieldAlert, Trash2, Lock, Unlock, ChevronDown, ChevronUp } from "lucide-react";
import { getMyRoles } from "@/lib/projects.functions";
import {
  deleteProject,
  createWorkZone,
  setWorkZoneStatus,
} from "@/lib/admin.functions";
import { toast } from "sonner";

type Zone = { id: string; name: string; level?: string | null; source?: string; status?: string };

export function MasterAdminHUD({
  projectId,
  projectName,
  zones,
  onZonesChanged,
}: {
  projectId: string;
  projectName: string;
  zones: Zone[];
  onZonesChanged: () => void;
}) {
  const rolesFn = useServerFn(getMyRoles);
  const roles = useQuery({
    queryKey: ["my-roles"],
    queryFn: () => rolesFn(),
    staleTime: 60_000,
  });
  const isMaster = roles.data?.roles?.includes("master_admin");

  const [expanded, setExpanded] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [zoneName, setZoneName] = useState("");
  const [zoneLevel, setZoneLevel] = useState("");
  const [busyDelete, setBusyDelete] = useState(false);
  const [busyCreate, setBusyCreate] = useState(false);

  const qc = useQueryClient();
  const navigate = useNavigate();
  const deleteFn = useServerFn(deleteProject);
  const createZoneFn = useServerFn(createWorkZone);
  const setStatusFn = useServerFn(setWorkZoneStatus);

  if (!roles.isLoading && !isMaster) return null;

  const runDelete = async () => {
    setBusyDelete(true);
    try {
      await deleteFn({ data: { projectId, confirmName: confirmText } });
      toast.success("Project deleted.");
      // Drop every cached query tied to this project BEFORE navigating so the
      // detail page's useQuery hooks don't refetch a now-missing project and
      // spam "not found" errors during unmount.
      qc.removeQueries({ predicate: (q) => q.queryKey.includes(projectId) });
      navigate({ to: "/projects" });
      qc.invalidateQueries({ queryKey: ["projects"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Delete failed.");
    } finally {
      setBusyDelete(false);
    }
  };


  const runCreateZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!zoneName.trim()) return;
    setBusyCreate(true);
    try {
      await createZoneFn({
        data: { projectId, name: zoneName.trim(), level: zoneLevel.trim() },
      });
      setZoneName("");
      setZoneLevel("");
      toast.success("Work zone created.");
      onZonesChanged();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to create zone.");
    } finally {
      setBusyCreate(false);
    }
  };

  const toggleStatus = async (z: Zone) => {
    const next = z.status === "closed" ? "active" : "closed";
    try {
      await setStatusFn({ data: { zoneId: z.id, status: next } });
      toast.success(`Zone ${z.name} → ${next.toUpperCase()}`);
      onZonesChanged();
    } catch (e: any) {
      toast.error(e?.message ?? "Toggle failed.");
    }
  };

  return (
    <div className="mt-6 rounded-xl border-2 border-alert bg-gradient-to-br from-alert/15 via-black/85 to-black/95 p-4 shadow-[0_0_45px_rgba(255,80,0,0.25)]">
      <button
        type="button"
        onClick={() => setExpanded((x) => !x)}
        className="flex w-full items-center justify-between gap-2"
      >
        <div className="flex items-center gap-2">
          <ShieldAlert className="text-alert" size={18} />
          <h3
            className="font-mono text-sm font-black uppercase tracking-[0.3em] text-alert"
            style={{ textShadow: "0 0 12px rgba(255,120,0,0.6)" }}
          >
            Master Admin Command HUD
          </h3>
        </div>
        {expanded ? (
          <ChevronUp size={16} className="text-alert" />
        ) : (
          <ChevronDown size={16} className="text-alert" />
        )}
      </button>

      {expanded && (
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          {/* Destructive column */}
          <div className="rounded-lg border border-alert/50 bg-black/60 p-3">
            <p className="font-mono text-[0.6rem] font-bold uppercase tracking-[0.28em] text-alert">
              Data Erasure
            </p>
            <p className="mt-1 text-xs text-foreground/70">
              Cascades delete across DABS records, drawings, RAMS, zones, and logs.
            </p>
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md border border-alert bg-alert/20 px-3 py-2 font-mono text-[0.7rem] font-black uppercase tracking-widest text-alert hover:bg-alert/30"
            >
              <Trash2 size={13} /> Delete Project
            </button>
          </div>

          {/* Zones column */}
          <div className="rounded-lg border border-alert/50 bg-black/60 p-3">
            <p className="font-mono text-[0.6rem] font-bold uppercase tracking-[0.28em] text-alert">
              Site Logistics Overrides
            </p>

            <form onSubmit={runCreateZone} className="mt-2 grid grid-cols-[1fr_1fr_auto] gap-2">
              <input
                value={zoneName}
                onChange={(e) => setZoneName(e.target.value)}
                placeholder="Zone name"
                className="rounded-md border border-white/15 bg-black/50 px-2 py-1.5 font-mono text-xs text-foreground outline-none focus:border-alert"
              />
              <input
                value={zoneLevel}
                onChange={(e) => setZoneLevel(e.target.value)}
                placeholder="Level (opt)"
                className="rounded-md border border-white/15 bg-black/50 px-2 py-1.5 font-mono text-xs text-foreground outline-none focus:border-alert"
              />
              <button
                type="submit"
                disabled={busyCreate || !zoneName.trim()}
                className="glass-orange inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[0.65rem] uppercase tracking-widest disabled:opacity-40"
              >
                <PlusCircle size={12} /> Create
              </button>
            </form>

            <div className="mt-3 max-h-56 overflow-y-auto rounded-md border border-white/10 bg-black/40">
              {zones.length === 0 && (
                <p className="p-3 text-center text-xs text-foreground/50">No zones yet.</p>
              )}
              {zones.map((z) => {
                const closed = z.status === "closed";
                return (
                  <div
                    key={z.id}
                    className="flex items-center justify-between gap-2 border-b border-white/8 px-2.5 py-1.5 last:border-b-0"
                  >
                    <div className="min-w-0">
                      <p className={`truncate font-mono text-xs ${closed ? "text-foreground/40 line-through" : "text-foreground/90"}`}>
                        {z.name}
                        {z.level ? ` · ${z.level}` : ""}
                      </p>
                      <p className="font-mono text-[0.55rem] uppercase tracking-widest text-foreground/40">
                        {z.source ?? "manual"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleStatus(z)}
                      className={`inline-flex items-center gap-1 rounded-sm border px-2 py-1 font-mono text-[0.55rem] uppercase tracking-widest ${
                        closed
                          ? "border-alert/60 bg-alert/20 text-alert"
                          : "border-emerald-400/50 bg-emerald-400/10 text-emerald-300"
                      }`}
                      title={closed ? "Reopen zone" : "Close zone"}
                    >
                      {closed ? <Lock size={10} /> : <Unlock size={10} />}
                      {closed ? "Closed" : "Active"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur"
          onClick={() => !busyDelete && setConfirmOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border-2 border-alert bg-gradient-to-b from-black to-black/90 p-5 shadow-[0_0_60px_rgba(255,60,0,0.5)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 text-alert">
              <AlertTriangle size={18} />
              <h4 className="font-mono text-sm font-black uppercase tracking-[0.28em]">
                Confirm Cascade Delete
              </h4>
            </div>
            <p className="mt-3 text-sm text-foreground/80">
              This will permanently delete <span className="font-mono text-alert">{projectName}</span>
              {" "}and every related record — drawings, zones, RAMS, DABS activities, permits.
              This action cannot be undone.
            </p>
            <label className="mt-4 block">
              <span className="font-mono text-[0.6rem] font-bold uppercase tracking-[0.25em] text-foreground/60">
                Type project name to confirm
              </span>
              <input
                autoFocus
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={projectName}
                className="mt-1 w-full rounded-md border border-alert/60 bg-black/70 px-3 py-2 font-mono text-sm text-foreground outline-none focus:border-alert"
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={busyDelete}
                className="rounded-md border border-white/20 px-3 py-1.5 text-xs uppercase tracking-widest text-foreground/70 hover:border-white/40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={runDelete}
                disabled={busyDelete || confirmText.trim() !== projectName.trim()}
                className="inline-flex items-center gap-1 rounded-md border border-alert bg-alert px-3 py-1.5 text-xs font-black uppercase tracking-widest text-black disabled:opacity-40"
              >
                <Trash2 size={12} /> {busyDelete ? "Deleting…" : "Delete Forever"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
