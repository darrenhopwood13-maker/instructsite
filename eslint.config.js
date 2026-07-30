import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", ".output", ".vinxi"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
          ],
        },
      ],
      // Native modal dialogs block the renderer and are silently suppressed
      // inside the published app's sandboxed iframe — use
      // `useConfirm()` from @/components/ui/confirm-dialog and sonner toasts.
      "no-restricted-globals": [
        "error",
        { name: "confirm", message: "Use useConfirm() from @/components/ui/confirm-dialog." },
        { name: "alert", message: "Use a sonner toast instead." },
        { name: "prompt", message: "Use an in-app dialog instead." },
      ],
      "no-restricted-properties": [
        "error",
        { object: "window", property: "confirm", message: "Use useConfirm() from @/components/ui/confirm-dialog." },
        { object: "window", property: "alert", message: "Use a sonner toast instead." },
        { object: "window", property: "prompt", message: "Use an in-app dialog instead." },
      ],
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  eslintPluginPrettier,
);
