import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileProgrammeFile } from "./programme-compiler.server";

describe("WBH real PDF", () => {
  it("parses", async () => {
    const buf = readFileSync("/tmp/wbh.pdf");
    const r = await compileProgrammeFile({
      fileName: "wbh.pdf",
      mimeType: "application/pdf",
      dataBase64: buf.toString("base64"),
    });
    console.log(r.source, r.tasks.length);
    console.log(JSON.stringify(r.tasks.slice(0, 30), null, 1));
    expect(r.tasks.length).toBeGreaterThan(0);
  }, 60_000);
});
