## What's broken

`/tooling` (and any page rendering `ToolingResults.tsx` / `ui/markdown.tsx`) crashes at load with:

```
SyntaxError: The requested module '/node_modules/style-to-js/cjs/index.js' does not provide an export named 'default'
```

That module is a transitive dep of `react-markdown@10`. It ships an ESM build with a real `default` export and a CJS build without one. Vite's dep-optimizer occasionally resolves the CJS entry when `style-to-js` isn't pre-bundled, and the ESM `import defaultFn from 'style-to-js'` in `react-markdown`'s chain then fails at runtime — exactly what the console shows. That kills the route and the root error boundary shows "This page didn't load".

Nothing on the server side is at fault; the earlier `snags.functions.ts` typecheck fix is unrelated.

## Fix

Force Vite to pre-bundle `style-to-js` (and its sibling `style-to-object`) so the ESM entry is always used.

1. Edit `vite.config.ts` — add to `optimizeDeps.include`:
   - `style-to-js`
   - `style-to-object`
   - `react-markdown`
   - `remark-gfm`
   (Including the parents guarantees the resolver walks them through the ESM path.)
2. Restart the dev server so the optimizer re-runs (delete `node_modules/.vite` cache as part of the restart).
3. Reload `/tooling` and confirm the cockpit renders and streams.

If pre-bundling alone doesn't clear it, fall back to pinning a resolution: add `"overrides": { "style-to-js": "1.1.16" }` in `package.json` and reinstall — 1.1.16 is the last version whose CJS build still exposed `default`.

## Verification

- Preview `/tooling` loads without the error boundary.
- Console is free of the `style-to-js` SyntaxError.
- Trigger one Oracle action; markdown output renders (headings, lists, "BY OTHERS" cards).

## Out of scope

No changes to Oracle prompts, streaming route, viewer, or UI layout.
