## Fix Snag scan (upload does nothing)

Two bugs in `src/lib/snags.functions.ts` → `analyzeSnag`:

### 1. Provider rejects system role
Current code puts the Oracle prompt inside `messages` as `{ role: "system", content: systemPrompt }`. The gateway returns: *"Invalid prompt: System messages are not allowed in the prompt or messages fields. Use the instructions option instead."*

Fix: pass it via AI SDK's top-level `system` parameter on `generateText`, leaving only the user (text + image) message in `messages`.

### 2. `NoObjectGeneratedError` reference crashes the catch block
The catch block calls `NoObjectGeneratedError.isInstance(error)`. At runtime the named export isn't defined in this bundle, producing "NoObjectGeneratedError is not defined" — which masks the real error and shows the user nothing useful.

Fix: drop the `NoObjectGeneratedError` import and its salvage branch. Rely on `Output.object({ schema })` for structured output; on failure just clean up the uploaded photo and throw the underlying message.

### Files
- `src/lib/snags.functions.ts`
  - Remove `NoObjectGeneratedError` from the `ai` import.
  - `analyzeSnag`: move `systemPrompt` from a `messages` entry to `system: systemPrompt` on `generateText`.
  - Replace the `NoObjectGeneratedError.isInstance(...)` block with straight cleanup + rethrow.

### Verification
- Re-upload a snag photo from `/snags/new`; expect the Oracle report to render.
- If the model call fails, the toast should now show the real gateway error instead of a `ReferenceError`.
