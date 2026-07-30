import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { errorMessage } from "@/lib/error-message";
import { Layers, Sparkles, Check, Pencil, Archive, PlusCircle, MapPin, Package } from "lucide-react";
import {
  listWorkfaces,
  listWorkfaceOptions,
  suggestWorkfaces,
  confirmWorkface,
  renameWorkface,
  archiveWorkface,
  createWorkfaceManual,
} from "@/lib/workfaces.functions";

type WorkfaceRow = {
  id: string;
  zone_id: string | null;
  package_invite_id: string | null;
  name: string;
  stage: string | null;
  source: string;
  status: "proposed" | "confirmed" | "archived";
  work_zones?: { name: string; level: string | null } | null;
  subcontractor_invites?: { company_name: string; package_manager_id: string | null } | null;
};

type ZoneOption = { id: string; name: string; level: string | null; status: string };
type PackageOption = {
  id: string;
  company_name: string;
  trade_packages: string[] | null;
  accepted_at: string | null;
};

const packageLabel = (p: PackageOption) =>
  `${p.company_name}${p.trade_packages?.length ? ` — ${p.trade_packages.join(", ")}` : ""}${
    p.accepted_at ? "" : " (invite pending)"
  }`;

export function WorkfaceRegisterPanel({ projectId }: { projectId: string }) {
  const listFn = useServerFn(listWorkfaces);
  const optionsFn = useServerFn(listWorkfaceOptions);
  const suggestFn = useServerFn(suggestWorkfaces);
  const confirmFn = useServerFn(confirmWorkface);
  const renameFn = useServerFn(renameWorkface);
  const archiveFn = useServerFn(archiveWorkface);
  const createFn = useServerFn(createWorkfaceManual);
  const qc = useQueryClient();

  const workfaces = useQuery({
    queryKey: ["workfaces", projectId],
    queryFn: () => listFn({ data: { projectId } }),
  });

  const options = useQuery({
    queryKey: ["workface-options", projectId],
    queryFn: () => optionsFn({ data: { projectId } }),
  });

  const zones = (options.data?.zones ?? []) as ZoneOption[];
  const packages = (options.data?.packages ?? []) as PackageOption[];

  const [suggesting, setSuggesting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editStage, setEditStage] = useState("");
  const [editZone, setEditZone] = useState("");
  const [editPackage, setEditPackage] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualStage, setManualStage] = useState("");
  const [manualZone, setManualZone] = useState("");
  const [manualPackage, setManualPackage] = useState("");
  const [showManualForm, setShowManualForm] = useState(false);

  const rows = useMemo(
    () => ((workfaces.data ?? []) as unknown) as WorkfaceRow[],
    [workfaces.data],
  );
  const proposed = rows.filter((r) => r.status === "proposed");
  const confirmed = rows.filter((r) => r.status === "confirmed");

  // Group the confirmed register by zone so it reads the way progress rolls up.
  const confirmedByZone = useMemo(() => {
    const groups = new Map<string, { label: string; items: WorkfaceRow[] }>();
    for (const w of confirmed) {
      const key = w.zone_id ?? "__unzoned";
      const label = w.work_zones?.name
        ? `${w.work_zones.name}${w.work_zones.level ? ` · ${w.work_zones.level}` : ""}`
        : "Unassigned zone";
      if (!groups.has(key)) groups.set(key, { label, items: [] });
      groups.get(key)!.items.push(w);
    }
    return [...groups.entries()].sort((a, b) =>
      a[0] === "__unzoned" ? 1 : b[0] === "__unzoned" ? -1 : a[1].label.localeCompare(b[1].label),
    );
  }, [confirmed]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["workfaces", projectId] });
    qc.invalidateQueries({ queryKey: ["zone-progress", projectId] });
  };

  const runSuggest = async () => {
    setSuggesting(true);
    try {
      const res = await suggestFn({ data: { projectId } });
      invalidate();
      if (res.created > 0) {
        toast.success(
          `${res.created} workface${res.created === 1 ? "" : "s"} proposed — every zone × package combination on this project${
            res.pendingCount ? `, including ${res.pendingCount} package(s) whose invite is still pending` : ""
          }.`,
        );
      } else if (!res.zoneCount) {
        toast.warning("Nothing proposed — this project has no work zones yet. Add zones first.");
      } else if (!res.packageCount) {
        toast.warning(
          "Nothing proposed — no subcontractor packages on this project yet. Register a package first.",
        );
      } else {
        toast.info(
          `Nothing new to propose — all ${res.zoneCount} zone(s) × ${res.packageCount} package(s) are already covered by ${res.existingCount} workface(s).`,
        );
      }
    } catch (e: any) {
      toast.error(errorMessage(e, "Failed to suggest workfaces."));
    } finally {
      setSuggesting(false);
    }
  };

  const confirm = async (id: string) => {
    const row = rows.find((r) => r.id === id);
    if (row && (!row.zone_id || !row.package_invite_id)) {
      toast.error("Set a work zone and trade package before confirming this workface.");
      startEdit(row);
      return;
    }
    try {
      await confirmFn({ data: { workfaceId: id } });
      invalidate();
      toast.success("Workface confirmed.");
    } catch (e: any) {
      toast.error(errorMessage(e, "Failed to confirm."));
    }
  };

  const startEdit = (row: WorkfaceRow) => {
    setEditingId(row.id);
    setEditName(row.name);
    setEditStage(row.stage ?? "");
    setEditZone(row.zone_id ?? "");
    setEditPackage(row.package_invite_id ?? "");
  };

  const saveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    if (!editZone || !editPackage) {
      toast.error("A workface needs both a work zone and a trade package.");
      return;
    }
    try {
      await renameFn({
        data: {
          workfaceId: editingId,
          name: editName.trim(),
          stage: editStage.trim() || null,
          zoneId: editZone,
          packageInviteId: editPackage,
        },
      });
      setEditingId(null);
      invalidate();
      toast.success("Workface updated.");
    } catch (e: any) {
      toast.error(errorMessage(e, "Failed to update."));
    }
  };

  const archive = async (id: string) => {
    try {
      await archiveFn({ data: { workfaceId: id } });
      invalidate();
      toast.success("Workface archived.");
    } catch (e: any) {
      toast.error(errorMessage(e, "Failed to archive."));
    }
  };

  const submitManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim()) return;
    if (!manualZone || !manualPackage) {
      toast.error("Pick a work zone and a trade package.");
      return;
    }
    try {
      await createFn({
        data: {
          projectId,
          name: manualName.trim(),
          stage: manualStage.trim() || null,
          zoneId: manualZone,
          packageInviteId: manualPackage,
        },
      });
      setManualName("");
      setManualStage("");
      setManualZone("");
      setManualPackage("");
      setShowManualForm(false);
      invalidate();
      toast.success("Workface added.");
    } catch (e: any) {
      toast.error(errorMessage(e, "Failed to add workface."));
    }
  };

  const selectClass =
    "w-full rounded-md border border-white/15 bg-black/50 px-2.5 py-2 font-mono text-xs text-foreground outline-none focus:border-alert";

  return (
    <div className="mt-4 rounded-lg border border-alert/50 bg-black/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Layers className="text-alert" size={14} />
          <p className="font-mono text-[0.6rem] font-bold uppercase tracking-[0.28em] text-alert">
            Workface Register
          </p>
        </div>
        <span className="font-mono text-[0.65rem] text-foreground/60">
          {confirmed.length} confirmed · {proposed.length} proposed
        </span>
      </div>
      <p className="mt-1 px-1 text-[0.65rem] text-foreground/50">
        Every workface binds one trade package to one work zone (e.g. "L03 East — WestShore Steel"),
        so progress is tracked per package and rolls up into that zone.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={runSuggest}
          disabled={suggesting}
          className="glass-orange inline-flex items-center gap-2 rounded-md px-3 py-2 text-[0.65rem] uppercase tracking-widest disabled:opacity-40"
        >
          <Sparkles size={12} /> {suggesting ? "Suggesting…" : "Suggest from Zones + Packages"}
        </button>
        <button
          type="button"
          onClick={() => setShowManualForm((v) => !v)}
          className="glass-btn inline-flex items-center gap-2 rounded-md px-3 py-2 text-[0.65rem] uppercase tracking-widest"
        >
          <PlusCircle size={12} /> Add Manually
        </button>
      </div>

      {showManualForm && (
        <form onSubmit={submitManual} className="mt-2 space-y-2">
          <input
            value={manualName}
            onChange={(e) => setManualName(e.target.value)}
            placeholder="e.g. Roof Plant Enclosure — Remedial"
            className={selectClass}
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <select
              value={manualZone}
              onChange={(e) => setManualZone(e.target.value)}
              className={selectClass}
            >
              <option value="">Work zone (required)…</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                  {z.level ? ` · ${z.level}` : ""}
                </option>
              ))}
            </select>
            <select
              value={manualPackage}
              onChange={(e) => setManualPackage(e.target.value)}
              className={selectClass}
            >
              <option value="">Trade package (required)…</option>
              {packages.map((p) => (
                <option key={p.id} value={p.id}>
                  {packageLabel(p)}
                </option>
              ))}
            </select>
          </div>
          <input
            value={manualStage}
            onChange={(e) => setManualStage(e.target.value)}
            placeholder="Stage (optional) — e.g. First Fix"
            className={selectClass}
          />
          {(zones.length === 0 || packages.length === 0) && (
            <p className="text-[0.6rem] text-amber-300">
              {zones.length === 0
                ? "No work zones on this project yet — add zones first."
                : "No subcontractor packages on this project yet — register a package first."}
            </p>
          )}
          <button
            type="submit"
            disabled={!manualName.trim() || !manualZone || !manualPackage}
            className="rounded-md border border-alert/60 bg-alert/10 px-3 py-2 font-mono text-[0.6rem] uppercase tracking-widest text-alert hover:bg-alert/20 disabled:opacity-40"
          >
            Add Workface
          </button>
        </form>
      )}

      {proposed.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 font-mono text-[0.55rem] uppercase tracking-widest text-amber-300">
            Proposed — awaiting confirmation
          </p>
          <div className="space-y-1.5">
            {proposed.map((w) => (
              <WorkfaceRow
                key={w.id}
                row={w}
                zones={zones}
                packages={packages}
                editing={editingId === w.id}
                editName={editName}
                editStage={editStage}
                editZone={editZone}
                editPackage={editPackage}
                onEditNameChange={setEditName}
                onEditStageChange={setEditStage}
                onEditZoneChange={setEditZone}
                onEditPackageChange={setEditPackage}
                onStartEdit={() => startEdit(w)}
                onSaveEdit={saveEdit}
                onCancelEdit={() => setEditingId(null)}
                onConfirm={() => confirm(w.id)}
                onArchive={() => archive(w.id)}
              />
            ))}
          </div>
        </div>
      )}

      <div className="mt-3">
        <p className="mb-1.5 font-mono text-[0.55rem] uppercase tracking-widest text-emerald-300">
          Confirmed — grouped by zone
        </p>
        {confirmed.length === 0 ? (
          <p className="rounded-md border border-dashed border-white/15 bg-black/25 p-3 text-center text-xs text-foreground/50">
            No confirmed workfaces yet.
          </p>
        ) : (
          <div className="space-y-3">
            {confirmedByZone.map(([key, group]) => (
              <div key={key}>
                <p className="mb-1 flex items-center gap-1.5 font-mono text-[0.55rem] uppercase tracking-widest text-foreground/50">
                  <MapPin size={10} /> {group.label} · {group.items.length}
                </p>
                <div className="space-y-1.5">
                  {group.items.map((w) => (
                    <WorkfaceRow
                      key={w.id}
                      row={w}
                      zones={zones}
                      packages={packages}
                      editing={editingId === w.id}
                      editName={editName}
                      editStage={editStage}
                      editZone={editZone}
                      editPackage={editPackage}
                      onEditNameChange={setEditName}
                      onEditStageChange={setEditStage}
                      onEditZoneChange={setEditZone}
                      onEditPackageChange={setEditPackage}
                      onStartEdit={() => startEdit(w)}
                      onSaveEdit={saveEdit}
                      onCancelEdit={() => setEditingId(null)}
                      onArchive={() => archive(w.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function WorkfaceRow({
  row,
  zones,
  packages,
  editing,
  editName,
  editStage,
  editZone,
  editPackage,
  onEditNameChange,
  onEditStageChange,
  onEditZoneChange,
  onEditPackageChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onConfirm,
  onArchive,
}: {
  row: WorkfaceRow;
  zones: ZoneOption[];
  packages: PackageOption[];
  editing: boolean;
  editName: string;
  editStage: string;
  editZone: string;
  editPackage: string;
  onEditNameChange: (v: string) => void;
  onEditStageChange: (v: string) => void;
  onEditZoneChange: (v: string) => void;
  onEditPackageChange: (v: string) => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onConfirm?: () => void;
  onArchive: () => void;
}) {
  const fieldClass =
    "w-full rounded-sm border border-white/15 bg-black/50 px-2 py-1.5 font-mono text-xs text-foreground outline-none focus:border-alert";

  if (editing) {
    return (
      <div className="rounded-md border border-alert/60 bg-black/50 p-2.5">
        <input
          value={editName}
          onChange={(e) => onEditNameChange(e.target.value)}
          className={fieldClass}
          placeholder="Workface name"
        />
        <select
          value={editZone}
          onChange={(e) => onEditZoneChange(e.target.value)}
          className={`${fieldClass} mt-1.5`}
        >
          <option value="">Work zone (required)…</option>
          {zones.map((z) => (
            <option key={z.id} value={z.id}>
              {z.name}
              {z.level ? ` · ${z.level}` : ""}
            </option>
          ))}
        </select>
        <select
          value={editPackage}
          onChange={(e) => onEditPackageChange(e.target.value)}
          className={`${fieldClass} mt-1.5`}
        >
          <option value="">Trade package (required)…</option>
          {packages.map((p) => (
            <option key={p.id} value={p.id}>
              {packageLabel(p)}
            </option>
          ))}
        </select>
        <input
          value={editStage}
          onChange={(e) => onEditStageChange(e.target.value)}
          className={`${fieldClass} mt-1.5`}
          placeholder="Stage (optional) — e.g. First Fix"
        />
        <div className="mt-1.5 flex gap-1.5">
          <button
            type="button"
            onClick={onSaveEdit}
            className="rounded-sm border border-emerald-400/60 bg-emerald-400/10 px-2 py-1 font-mono text-[0.55rem] uppercase tracking-widest text-emerald-200 hover:bg-emerald-400/20"
          >
            Save
          </button>
          <button
            type="button"
            onClick={onCancelEdit}
            className="rounded-sm border border-white/20 px-2 py-1 font-mono text-[0.55rem] uppercase tracking-widest text-foreground/60 hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  const zoneName = row.work_zones?.name;
  const companyName = row.subcontractor_invites?.company_name;

  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-white/10 bg-black/40 px-2.5 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate font-mono text-xs text-foreground/90">{row.name}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-widest ${
              zoneName
                ? "border-sky-400/40 text-sky-200"
                : "border-destructive/60 text-destructive-foreground"
            }`}
          >
            <MapPin size={9} /> {zoneName ?? "No zone"}
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-widest ${
              companyName
                ? "border-alert/50 text-alert"
                : "border-destructive/60 text-destructive-foreground"
            }`}
          >
            <Package size={9} /> {companyName ?? "No package"}
          </span>
          {row.stage && (
            <span className="rounded-sm border border-white/15 px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-widest text-foreground/60">
              {row.stage}
            </span>
          )}
          <span className="font-mono text-[0.55rem] uppercase tracking-widest text-foreground/40">
            via {row.source.replace("auto_", "").replace("_", " ")}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {onConfirm && (
          <button
            type="button"
            onClick={onConfirm}
            title="Confirm"
            className="rounded-sm border border-emerald-400/60 p-1 text-emerald-300 hover:bg-emerald-400/20"
          >
            <Check size={11} />
          </button>
        )}
        <button
          type="button"
          onClick={onStartEdit}
          title="Edit zone / package / name"
          className="rounded-sm border border-white/20 p-1 text-foreground/60 hover:text-foreground"
        >
          <Pencil size={11} />
        </button>
        <button
          type="button"
          onClick={onArchive}
          title="Archive"
          className="rounded-sm border border-destructive/60 p-1 text-destructive-foreground hover:bg-destructive/20"
        >
          <Archive size={11} />
        </button>
      </div>
    </div>
  );
}
