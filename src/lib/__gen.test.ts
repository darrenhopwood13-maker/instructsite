import { describe, it } from "vitest";
import { readFileSync, writeFileSync } from "fs";
import { compileProgrammeFile, buildProgrammePlaybookRows } from "@/lib/programme-compiler.server";

const CSV = readFileSync("/tmp/wbh.csv", "utf-8");
const PROJECT = "87b2d7c6-f217-45ec-bbc6-09977826e94f";
const q = (s: string | null) => (s === null ? "NULL" : `'${s.replace(/'/g, "''")}'`);

describe("gen", () => {
  it("emits sql", async () => {
    const r = await compileProgrammeFile({ fileName: "TEST-DRAFT-hoxton-studios-programme.csv", mimeType: "text/csv", dataBase64: Buffer.from(CSV).toString("base64") });
    const rows = r.tasks.map((t) => `(:UP, '${PROJECT}', ${q(t.taskName)}, ${q(t.taskName)}, '${t.startDate}', '${t.endDate}', ${q(t.taskRef ?? null)}, ARRAY[${(t.predecessors ?? []).map((p) => q(p)).join(",")}]::text[], ${t.durationDays ?? "NULL"}, ${q(t.trade || null)}, ${q(t.location || null)})`).join(",\n");
    const pb = buildProgrammePlaybookRows({ projectId: PROJECT, uploadId: "UPLOAD", tasks: r.tasks })
      .map((p) => `(:UP, '${PROJECT}', '${p.playbook_date}', ${q(p.ai_daily_summary)})`).join(",\n");
    writeFileSync("/tmp/tasks.sql", rows);
    writeFileSync("/tmp/pb.sql", pb);
    console.log("tasks", r.tasks.length);
  });
});
