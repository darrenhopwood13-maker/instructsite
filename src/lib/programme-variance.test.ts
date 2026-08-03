import { describe, expect, it } from "vitest";
import {
  buildVariance,
  fallbackNote,
  plannedPctAt,
  type VarianceDiary,
  type VarianceTask,
} from "./programme-variance";

const task = (o: Partial<VarianceTask> & { id: string; startDate: string; endDate: string }): VarianceTask => ({
  taskRef: null,
  taskName: "Task",
  trade: null,
  location: null,
  predecessors: [],
  ...o,
});

const diary = (o: Partial<VarianceDiary> & { id: string }): VarianceDiary => ({
  tradePackage: null,
  zoneName: null,
  checkoutTime: "2026-08-03T10:00:00Z",
  qsStatus: "approved",
  completionPct: null,
  managerCompletionPct: null,
  qsVerifiedPct: null,
  ...o,
});

describe("plannedPctAt", () => {
  it("is duration weighted and clamped", () => {
    const t = [task({ id: "a", startDate: "2026-08-01", endDate: "2026-08-10" })];
    expect(plannedPctAt(t, "2026-07-30")).toBe(0);
    expect(plannedPctAt(t, "2026-08-05")).toBe(50);
    expect(plannedPctAt(t, "2026-09-01")).toBe(100);
  });
});

describe("buildVariance", () => {
  const tasks = [
    task({
      id: "t1",
      taskRef: "T01",
      taskName: "Electrical first fix",
      trade: "Electrical",
      startDate: "2026-08-01",
      endDate: "2026-08-10",
    }),
    task({
      id: "t2",
      taskRef: "T02",
      taskName: "Plaster and skim",
      trade: "Plastering",
      startDate: "2026-08-11",
      endDate: "2026-08-20",
      predecessors: ["T01"],
    }),
  ];

  it("flags a package behind and inherits downstream risk", () => {
    const res = buildVariance({
      tasks,
      pins: [],
      diaries: [
        diary({ id: "d1", tradePackage: "Electrical first fix", qsVerifiedPct: 20 }),
      ],
      today: "2026-08-09",
    });
    const elec = res.find((r) => r.label === "Electrical")!;
    const plaster = res.find((r) => r.label === "Plastering")!;
    expect(elec.status).toBe("behind");
    expect(elec.actualPct).toBe(20);
    expect(elec.daysVariance).toBeGreaterThan(2);
    expect(plaster.downstreamRisk).toBe(true);
    expect(plaster.riskFrom).toContain("Electrical");
  });

  it("ignores diaries that are not QS approved", () => {
    const res = buildVariance({
      tasks,
      pins: [],
      diaries: [
        diary({ id: "d1", tradePackage: "Electrical first fix", qsStatus: "pending", qsVerifiedPct: 95 }),
      ],
      today: "2026-08-09",
    });
    const elec = res.find((r) => r.label === "Electrical")!;
    expect(elec.actualPct).toBe(0);
    expect(elec.unverifiedDiaryCount).toBe(1);
  });

  it("detects ahead of programme", () => {
    const res = buildVariance({
      tasks,
      pins: [],
      diaries: [diary({ id: "d1", tradePackage: "Electrical first fix", qsVerifiedPct: 90 })],
      today: "2026-08-03",
    });
    const elec = res.find((r) => r.label === "Electrical")!;
    expect(elec.status).toBe("ahead");
    expect(elec.daysVariance).toBeLessThan(0);
  });

  it("writes a grounded fallback note", () => {
    const res = buildVariance({
      tasks,
      pins: [],
      diaries: [diary({ id: "d1", tradePackage: "Electrical first fix", qsVerifiedPct: 20 })],
      today: "2026-08-09",
    });
    const note = fallbackNote(res.find((r) => r.label === "Electrical")!, "2026-08-09");
    expect(note).toContain("behind programme");
    expect(note).toContain("20%");
  });
});

describe("explicit package links", () => {
  const linkTasks = [
    task({
      id: "t1",
      taskRef: "T01",
      taskName: "Electrical first fix",
      trade: "Electrical",
      startDate: "2026-08-01",
      endDate: "2026-08-10",
    }),
  ];

  it("uses an explicit link even when the wording does not match", () => {
    const res = buildVariance({
      tasks: linkTasks,
      pins: [],
      diaries: [diary({ id: "d1", tradePackage: "Sparks Ltd package 4", qsVerifiedPct: 60 })],
      today: "2026-08-05",
      links: { "sparks ltd package 4": "electrical" },
    });
    expect(res[0].actualPct).toBe(60);
  });

  it("a linked package is excluded from other packages it would fuzzy-match", () => {
    const res = buildVariance({
      tasks: linkTasks,
      pins: [],
      diaries: [diary({ id: "d1", tradePackage: "Electrical first fix", qsVerifiedPct: 60 })],
      today: "2026-08-05",
      links: { "electrical first fix": "some other package" },
    });
    expect(res[0].actualPct).toBe(0);
    expect(res[0].verifiedDiaryIds).toHaveLength(0);
  });

  it("groups tasks by package_ref when set", () => {
    const res = buildVariance({
      tasks: [
        task({ id: "a", trade: "Electrical", packageRef: "MEP", startDate: "2026-08-01", endDate: "2026-08-10" }),
        task({ id: "b", trade: "Mechanical", packageRef: "MEP", startDate: "2026-08-01", endDate: "2026-08-10" }),
      ],
      pins: [],
      diaries: [],
      today: "2026-08-05",
    });
    expect(res).toHaveLength(1);
    expect(res[0].label).toBe("MEP");
  });
});
