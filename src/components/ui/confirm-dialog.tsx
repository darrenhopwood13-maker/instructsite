import { useCallback, useRef, useState } from "react";

/**
 * Non-blocking replacement for window.confirm() / window.alert().
 *
 * NEVER use window.confirm, window.alert or window.prompt in this app.
 * They halt the renderer's main thread, and inside the published app's
 * sandboxed iframe (no `allow-modals`) Chrome suppresses them entirely — the
 * tab looks frozen and the guarded action silently never runs. ESLint blocks
 * them; use this hook instead.
 *
 *   const { confirm, dialog } = useConfirm();
 *   ...
 *   if (!(await confirm("Delete this?", "Delete"))) return;
 *   ...
 *   return (<>{dialog} ...</>)
 */

const overlayCls = "fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4";
const cancelCls =
  "inline-flex items-center justify-center gap-2 rounded-md border border-white/15 px-3 py-2 text-[0.65rem] uppercase tracking-widest text-foreground/70 hover:border-alert hover:text-alert";
const okCls =
  "inline-flex items-center justify-center gap-2 rounded-md border-2 border-alert bg-alert/10 px-4 py-2.5 text-xs font-extrabold uppercase tracking-widest text-alert transition-colors hover:bg-alert hover:text-black";

export function useConfirm() {
  const [message, setMessage] = useState<string | null>(null);
  const [confirmLabel, setConfirmLabel] = useState("Confirm");
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback((msg: string, label = "Confirm") => {
    setMessage(msg);
    setConfirmLabel(label);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = useCallback((v: boolean) => {
    setMessage(null);
    const r = resolver.current;
    resolver.current = null;
    r?.(v);
  }, []);

  const dialog = message ? (
    <div className={overlayCls} role="dialog" aria-modal="true">
      <div className="glass-panel w-full max-w-md p-5">
        <p className="text-[0.6rem] font-bold uppercase tracking-[0.35em] text-alert">Verify</p>
        <pre className="mt-3 max-h-[50vh] overflow-y-auto whitespace-pre-wrap font-mono text-xs text-foreground/85">
          {message}
        </pre>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => settle(false)} className={cancelCls}>
            Cancel
          </button>
          <button type="button" onClick={() => settle(true)} className={okCls}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, dialog };
}
