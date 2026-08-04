import { describe, expect, it } from "vitest";
import { compileProgrammeFile } from "./programme-compiler.server";

const CSV = `Task ID,Task Name,Start Date,End Date,Duration (Days),Predecessors
T01,Site Est & Welfare Setup,2026-07-06,2026-07-08,3,
T02,Soft Strip Phase 1 & Waste Segregation,2026-07-09,2026-07-15,7,T01
T03,Erect 120mm twin-stud acoustic partitions w/ 2x15mm SoundBloc,2026-07-16,2026-07-25,10,T02
T04,1st Fix MEP - HVAC Acoustic Attenuation & Ducting,2026-07-20,2026-07-30,11,T02
T05,1st Fix AV - Pull Cat8 & Fibre Optic runs to Studio A/B,2026-07-26,2026-08-05,11,T03
T06,"Tape, Joint & Mist Coat - Control Rooms",2026-08-01,2026-08-08,8,T03
T07,2nd Fix MEP - Install Acoustic Baffles & Diffusers,2026-08-09,2026-08-18,10,"T04,T06"
T08,Terminate Cat8 AV/Data nodes to patch panel racks U1-U45,2026-08-12,2026-08-20,9,T05
T09,"FF&E Install - Studio Consoles, Rigging & Soundproofing Foam",2026-08-19,2026-08-25,7,"T07,T08"
T10,"Acoustic Testing, Commissioning & Client Handover",2026-08-26,2026-08-31,6,T09
`;

describe("CSV programme import", () => {
  it("parses task refs, dates, durations and dependency chains", async () => {
    const result = await compileProgrammeFile({
      fileName: "TEST-DRAFT-programme.csv",
      mimeType: "text/csv",
      dataBase64: Buffer.from(CSV, "utf-8").toString("base64"),
    });

    expect(result.source).toBe("csv");
    expect(result.tasks).toHaveLength(10);

    const byRef = new Map(result.tasks.map((t) => [t.taskRef, t]));
    expect([...byRef.keys()].sort()).toEqual([
      "T01", "T02", "T03", "T04", "T05", "T06", "T07", "T08", "T09", "T10",
    ]);

    expect(byRef.get("T01")).toMatchObject({
      startDate: "2026-07-06",
      endDate: "2026-07-08",
      durationDays: 3,
      predecessors: [],
    });
    expect(byRef.get("T04")?.taskName).toContain("1st Fix MEP");
    expect(byRef.get("T07")?.predecessors).toEqual(["T04", "T06"]);
    expect(byRef.get("T09")?.predecessors).toEqual(["T07", "T08"]);
    expect(byRef.get("T10")).toMatchObject({
      startDate: "2026-08-26",
      endDate: "2026-08-31",
      durationDays: 6,
      predecessors: ["T09"],
    });
  });
});

describe("CSV rows with unquoted commas", () => {
  it("keeps a task whose name contains an unquoted comma", async () => {
    const csv = [
      "Task Name,Start Date,End Date",
      "Site set-up & surface protection,2026-08-10,2026-08-10",
      "Snag, clean down and handover,2026-08-14,2026-08-14",
    ].join("\n");
    const result = await compileProgrammeFile({
      fileName: "overflow.csv",
      mimeType: "text/csv",
      dataBase64: Buffer.from(csv, "utf-8").toString("base64"),
    });
    expect(result.tasks).toHaveLength(2);
    expect(result.tasks.map((t) => t.taskName)).toContain("Snag, clean down and handover");
    expect(result.tasks.at(-1)).toMatchObject({ startDate: "2026-08-14", endDate: "2026-08-14" });
  });
});
