import { describe, expect, it } from "vitest";
import {
  checkPromotable,
  durationOf,
  isSafeGenericType,
  normaliseTasks,
  shiftDay,
  slideTask,
  tidyTypeLabel,
  toVarianceTasks,
  withDuration,
} from "@/lib/short-term-programme";
import { buildVariance } from "@/lib/programme-variance";

describe("short-term programme task maths", () => {
  it("treats a same-day task as one day", () => {
    expect(durationOf({ startDate: "2026-08-03", endDate: "2026-08-03" })).toBe(1);
    expect(durationOf({ startDate: "2026-08-03", endDate: "2026-08-07" })).toBe(5);
  });

  it("sets duration by moving the end date only", () => {
    const t = withDuration({ startDate: "2026-08-03", endDate: "2026-08-03" }, 5);
    expect(t).toEqual({ startDate: "2026-08-03", endDate: "2026-08-07" });
  });

  it("slides a task preserving duration", () => {
    const t = slideTask({ startDate: "2026-08-03", endDate: "2026-08-07" }, 7);
    expect(t).toEqual({ startDate: "2026-08-10", endDate: "2026-08-14" });
  });

  it("normalises sequence, local refs and bad date ranges", () => {
    const tasks = normaliseTasks([
      { taskName: " Strip out ", startDate: "2026-08-03", endDate: "2026-08-01" },
      { taskName: "", startDate: "2026-08-04", endDate: "2026-08-05" },
      { taskName: "First fix", startDate: "2026-08-06", endDate: "2026-08-10", predecessors: ["1"] },
    ]);
    expect(tasks).toHaveLength(2);
    expect(tasks[0]).toMatchObject({ seq: 0, localRef: "1", taskName: "Strip out", endDate: "2026-08-03" });
    expect(tasks[1]).toMatchObject({ seq: 1, localRef: "2", predecessors: ["1"], status: "not_started" });
  });
});

describe("scoped variance reuse", () => {
  const tasks = normaliseTasks([
    { taskName: "Partition framing", startDate: "2026-07-20", endDate: "2026-07-24" },
    { taskName: "Boarding", startDate: "2026-07-27", endDate: "2026-07-31", predecessors: ["1"] },
  ]);

  it("collapses the mini programme into exactly one package", () => {
    const out = buildVariance({
      tasks: toVarianceTasks(tasks, "Drylining"),
      pins: [],
      diaries: [],
      today: "2026-08-03",
      links: { drylining: "drylining" },
    });
    expect(out).toHaveLength(1);
    expect(out[0].label).toBe("Drylining");
    expect(out[0].plannedPct).toBe(100);
    expect(out[0].actualPct).toBe(0);
    expect(out[0].status).toBe("behind");
  });

  it("counts only QS-approved diaries as verified progress", () => {
    const out = buildVariance({
      tasks: toVarianceTasks(tasks, "Drylining"),
      pins: [],
      diaries: [
        {
          id: "d1", tradePackage: "Drylining", zoneName: null,
          checkoutTime: "2026-07-30T16:00:00Z", qsStatus: "pending",
          completionPct: 90, managerCompletionPct: 90, qsVerifiedPct: null,
        },
        {
          id: "d2", tradePackage: "Drylining", zoneName: null,
          checkoutTime: "2026-07-31T16:00:00Z", qsStatus: "approved",
          completionPct: 100, managerCompletionPct: 100, qsVerifiedPct: 60,
        },
      ],
      today: "2026-08-03",
      links: { drylining: "drylining" },
    });
    expect(out[0].actualPct).toBe(60);
    expect(out[0].verifiedDiaryIds).toEqual(["d2"]);
  });
});

describe("activity library privacy guard", () => {
  it("blocks anything measured, numbered, branded or located", () => {
    const blocked = [
      "Install 15mm SoundBloc plasterboard to Studio B partitions",
      "Trench fill foundations to Block C",
      "Pour 25 m3 slab",
      "Level 4 ceiling grid",
      "Fit Rockwool RW3 insulation",
    ];
    for (const label of blocked) {
      expect(checkPromotable(label).promotable, label).toBe(false);
    }
  });

  it("allows clean generic activity types", () => {
    for (const label of ["Plasterboard Installation", "Trench Fill Foundations", "Steel erection"]) {
      expect(checkPromotable(label).promotable, label).toBe(true);
    }
  });

  it("re-checks whatever the AI proposes before it can reach the org library", () => {
    expect(isSafeGenericType("Plasterboard Installation")).toBe(true);
    expect(isSafeGenericType("Install 15mm plasterboard")).toBe(false);
    expect(isSafeGenericType("A")).toBe(false);
  });

  it("tidies labels consistently", () => {
    expect(tidyTypeLabel("  plasterboard   installation ")).toBe("Plasterboard Installation");
  });

  it("shifts days across month boundaries", () => {
    expect(shiftDay("2026-07-31", 1)).toBe("2026-08-01");
  });
});
