import type jsPDF from "jspdf";

type Worker = { name: string; role?: string | null; competency_card_url?: string | null; created_at: string };
type Register = { type: string; asset_name?: string | null; inspection_date?: string | null; certificate_url?: string | null; created_at: string };
type ToolboxTalk = { topic: string; attendance_list?: unknown; date?: string | null; created_at: string };
type LookAhead = { work_plan: string; is_high_risk?: boolean; permit_required?: boolean; date?: string | null; created_at: string };

export type WeeklyPackInput = {
  projectName: string;
  companyName: string;
  workers: Worker[];
  registers: Register[];
  toolboxTalks: ToolboxTalk[];
  lookAheads: LookAhead[];
  /** Optional resolver that turns a stored path/URL into a temporary fetchable URL (e.g. Supabase signed URL). */
  resolveUrl?: (path: string) => Promise<string>;
};

type ImageAsset = { dataUrl: string; format: "PNG" | "JPEG"; width: number; height: number };

async function fetchAsImage(url: string): Promise<ImageAsset | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const type = (res.headers.get("content-type") || "").toLowerCase();
    if (!type.startsWith("image/")) return null; // skip PDFs / non-images
    const blob = await res.blob();
    const dataUrl: string = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
    const dims = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve({ w: 800, h: 600 });
      img.src = dataUrl;
    });
    const format: "PNG" | "JPEG" = type.includes("png") ? "PNG" : "JPEG";
    return { dataUrl, format, width: dims.w, height: dims.h };
  } catch {
    return null;
  }
}


function currentWeekRange(now = new Date()): { start: Date; end: Date; label: string } {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 Sun..6 Sat
  const diffToMonday = (day + 6) % 7;
  const start = new Date(d);
  start.setDate(d.getDate() - diffToMonday);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  const fmt = (x: Date) => x.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  return { start, end, label: `${fmt(start)} – ${fmt(end)}` };
}

function withinWeek(iso: string | null | undefined, start: Date, end: Date): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= start.getTime() && t <= end.getTime();
}

function safeFile(s: string) {
  return s.replace(/[^\w.\-]+/g, "_").replace(/_+/g, "_");
}

async function loadPdfLibs() {
  const [{ default: JsPDF }, autoTableMod] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const autoTable = (autoTableMod as any).default ?? (autoTableMod as any);
  return { JsPDF, autoTable };
}

export async function generateWeeklyPackPdf(input: WeeklyPackInput): Promise<{ filename: string }> {
  const { JsPDF, autoTable } = await loadPdfLibs();
  const { start, end, label } = currentWeekRange();

  const workers = input.workers.filter((w) => withinWeek(w.created_at, start, end));
  const registers = input.registers.filter((r) => withinWeek(r.inspection_date ?? r.created_at, start, end));
  const talks = input.toolboxTalks.filter((t) => withinWeek(t.date ?? t.created_at, start, end));
  const aheads = input.lookAheads.filter((l) => withinWeek(l.date ?? l.created_at, start, end));

  const pdf = new JsPDF({ unit: "mm", format: "a4", orientation: "portrait" }) as jsPDF;
  const pageW = pdf.internal.pageSize.getWidth();
  const margin = 14;

  // Header band
  pdf.setFillColor(11, 30, 63); // Navy
  pdf.rect(0, 0, pageW, 30, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.text("WEEKLY SUBCONTRACTOR PACK", margin, 13);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text("InstructSite · Compliance & Labour Submission", margin, 19);
  pdf.setFontSize(8);
  pdf.text("MASTER CONTRACTOR LOGO", pageW - margin, 13, { align: "right" });
  pdf.setDrawColor(255, 122, 0);
  pdf.setLineWidth(0.6);
  pdf.rect(pageW - margin - 40, 16, 40, 10);
  pdf.text("[ Logo Placeholder ]", pageW - margin - 20, 22, { align: "center" });

  // Meta block
  let y = 38;
  pdf.setTextColor(20, 20, 20);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text(input.projectName || "Project", margin, y);
  y += 5;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(`Subcontractor: ${input.companyName || "—"}`, margin, y);
  y += 4.5;
  pdf.text(`Week: ${label}`, margin, y);
  y += 4.5;
  pdf.text(`Generated: ${new Date().toLocaleString("en-GB")}`, margin, y);
  y += 6;

  const sectionHeader = (title: string) => {
    pdf.setFillColor(11, 30, 63);
    pdf.rect(margin, y, pageW - margin * 2, 6, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.text(title, margin + 2, y + 4.2);
    pdf.setTextColor(20, 20, 20);
    y += 8;
  };

  const runTable = (head: string[][], body: (string | { content: string; styles?: any })[][], opts?: any) => {
    autoTable(pdf, {
      head,
      body: body.length ? body : [[{ content: "— No entries logged this week —", colSpan: head[0].length, styles: { halign: "center", textColor: [120, 120, 120], fontStyle: "italic" } }]],
      startY: y,
      theme: "grid",
      margin: { left: margin, right: margin },
      headStyles: { fillColor: [255, 122, 0], textColor: 255, fontStyle: "bold", fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: 30 },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      styles: { cellPadding: 2, lineColor: [200, 200, 200], lineWidth: 0.1 },
      ...opts,
    });
    y = (pdf as any).lastAutoTable.finalY + 8;
  };

  // Table 1 — Labour Roster
  sectionHeader("TABLE 1 · LABOUR ROSTER & COMPETENCY");
  runTable(
    [["#", "Name", "Role", "Competency Card", "Logged"]],
    workers.map((w, i) => [
      String(i + 1),
      w.name,
      w.role || "—",
      w.competency_card_url ? "On file" : "Missing",
      new Date(w.created_at).toLocaleDateString("en-GB"),
    ]),
    { columnStyles: { 0: { cellWidth: 8 }, 3: { cellWidth: 30 }, 4: { cellWidth: 22 } } },
  );

  // Table 2 — Safety Registers
  sectionHeader("TABLE 2 · SAFETY REGISTERS (PUWER / LOLER / HAVS / PLANT)");
  runTable(
    [["#", "Type", "Asset", "Inspection Date", "Certificate"]],
    registers.map((r, i) => [
      String(i + 1),
      r.type,
      r.asset_name || "—",
      r.inspection_date ? new Date(r.inspection_date).toLocaleDateString("en-GB") : "—",
      r.certificate_url ? "On file" : "Missing",
    ]),
    { columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 22 }, 3: { cellWidth: 30 }, 4: { cellWidth: 26 } } },
  );

  // Table 3 — Toolbox Talks
  sectionHeader("TABLE 3 · TOOLBOX TALKS");
  runTable(
    [["#", "Date", "Topic", "Attendees"]],
    talks.map((t, i) => {
      const attendees = Array.isArray(t.attendance_list) ? (t.attendance_list as unknown[]) : [];
      return [
        String(i + 1),
        new Date(t.date ?? t.created_at).toLocaleDateString("en-GB"),
        t.topic || "—",
        `${attendees.length} · ${attendees.slice(0, 6).map((a) => String(a)).join(", ")}${attendees.length > 6 ? "…" : ""}`,
      ];
    }),
    { columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 22 }, 2: { cellWidth: 45 } } },
  );

  // Table 4 — Look-Ahead
  sectionHeader("TABLE 4 · LOOK-AHEAD WORK PLAN");
  runTable(
    [["#", "Date", "Work Plan", "Flags"]],
    aheads.map((l, i) => {
      const flags: string[] = [];
      if (l.is_high_risk) flags.push("HIGH RISK");
      if (l.permit_required) flags.push("PERMIT REQUIRED");
      const flagText = flags.length ? flags.join(" · ") : "—";
      const flagged = flags.length > 0;
      return [
        String(i + 1),
        new Date(l.date ?? l.created_at).toLocaleDateString("en-GB"),
        l.work_plan,
        { content: flagText, styles: flagged ? { textColor: [200, 30, 30], fontStyle: "bold" } : {} },
      ];
    }),
    { columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 22 }, 3: { cellWidth: 40 } } },
  );

  // Footer on every page
  const pageCount = (pdf as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    const h = pdf.internal.pageSize.getHeight();
    pdf.setDrawColor(200, 200, 200);
    pdf.line(margin, h - 12, pageW - margin, h - 12);
    pdf.setFontSize(7);
    pdf.setTextColor(120, 120, 120);
    pdf.text(`${input.companyName} · ${label}`, margin, h - 7);
    pdf.text(`Page ${i} of ${pageCount}`, pageW - margin, h - 7, { align: "right" });
    pdf.text("Confidential — for issuing contractor use only", pageW / 2, h - 7, { align: "center" });
  }

  const dateStamp = new Date().toISOString().slice(0, 10);
  const filename = `${safeFile(input.companyName || "Subcontractor")}_Weekly_Pack_${dateStamp}.pdf`;
  pdf.save(filename);
  return { filename };
}
