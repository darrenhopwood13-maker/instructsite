import { compileProgrammeFile } from "@/lib/programme-compiler.server";
import fs from "node:fs";
const b64 = Buffer.from(fs.readFileSync("/tmp/stp/csv.txt")).toString("base64");
const r = await compileProgrammeFile({ fileName: "x.csv", mimeType: "text/csv", dataBase64: b64 });
console.log(r.source, r.tasks.length);
console.log(r.tasks.map((t:any)=>`${t.taskName} | ${t.startDate} | ${t.endDate}`).join("\n"));
