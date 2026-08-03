import { readFileSync } from "node:fs";
import { describe, it } from "vitest";
import { getDocumentProxy, extractText } from "unpdf";

describe("raw", () => {
  it("dump", async () => {
    const buf = new Uint8Array(readFileSync("/tmp/wbh.pdf"));
    const doc = await getDocumentProxy(buf);
    const { text } = await extractText(doc, { mergePages: true });
    console.log(JSON.stringify(String(text).slice(0, 2400)));
  }, 60_000);
});
