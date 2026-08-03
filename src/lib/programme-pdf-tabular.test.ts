import { describe, expect, it } from "vitest";
import { parseTabularTextToTasks, reflowNumberedRows } from "./programme-compiler.server";

// Shape produced by PDF text extraction: whole table collapsed onto one line.
const FLAT =
  "ID ACTIVITY START FINISH DUR PRED " +
  "1 Site set-up and welfare 03/08/2026 07/08/2026 5 - " +
  "2 Site strip and reduce dig 10/08/2026 21/08/2026 10 1 " +
  "3 Foundation excavation 24/08/2026 04/09/2026 10 1,2 " +
  "4 Concrete foundations 07/09/2026 11/09/2026 5 3 " +
  "5 Snagging, clean and handover 14/09/2026 18/09/2026 5 3,4 " +
  "NOTES Terminal float 10 working days held by the contractor. Critical path: foundations.";

describe("PDF tabular programme parsing", () => {
  it("reflows a single-line table back into rows", () => {
    expect(reflowNumberedRows(FLAT).split("\n").length).toBeGreaterThan(4);
  });

  it("extracts task refs, dates, durations and predecessors", () => {
    const tasks = parseTabularTextToTasks(FLAT);
    expect(tasks).toHaveLength(5);
    const byRef = new Map(tasks.map((t) => [t.taskRef, t]));
    expect(byRef.get("1")?.predecessors).toEqual([]);
    expect(byRef.get("3")?.predecessors).toEqual(["1", "2"]);
    expect(byRef.get("5")?.predecessors).toEqual(["3", "4"]);
    expect(byRef.get("4")?.durationDays).toBe(5);
    expect(byRef.get("2")?.taskName).toContain("Site strip");
  });
});
