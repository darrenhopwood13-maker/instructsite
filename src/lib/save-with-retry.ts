/**
 * Network-resilient save helper for server-function mutations.
 *
 * Background: on the "record on behalf" forms, roughly 1 in 10 saves failed
 * with a bare `TypeError: Failed to fetch`. That is a network-layer rejection
 * of the RPC POST (dropped connection, throttled/backgrounded tab, in-flight
 * request cancelled by a navigation or refetch) — never a validation or RLS
 * error, so the write may not have reached the server at all.
 *
 * Rules:
 *  - one automatic retry with a short backoff, for network-level failures only
 *    (server-side errors such as RLS or validation are never retried — they
 *    would fail identically and could double-write),
 *  - callers must NOT clear their form until the returned promise resolves.
 */

/** True for fetch/abort level failures, i.e. the server never answered. */
export function isNetworkError(e: unknown): boolean {
  if (e instanceof DOMException && e.name === "AbortError") return true;
  const msg = e instanceof Error ? e.message : String(e ?? "");
  return /failed to fetch|network ?error|load failed|networkerror|connection (closed|reset)|aborted|err_network|the operation was aborted/i.test(
    msg,
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Runs `attempt`, retrying once after a short backoff when the failure is
 * network-level. Rethrows a clear, record-specific error on final failure.
 *
 * @param recordType human label, e.g. "toolbox talk" — used in the message.
 */
export async function saveWithRetry<T>(
  attempt: () => Promise<T>,
  recordType: string,
  opts: { onRetry?: () => void; backoffMs?: number } = {},
): Promise<T> {
  try {
    return await attempt();
  } catch (first) {
    if (!isNetworkError(first)) throw first;
    opts.onRetry?.();
    await sleep(opts.backoffMs ?? 900);
    try {
      return await attempt();
    } catch (second) {
      if (isNetworkError(second)) {
        throw new Error(
          `The connection dropped while saving this ${recordType}. Nothing was lost — your entries are still here. Press RETRY THIS SAVE.`,
        );
      }
      throw second;
    }
  }
}

/** Message shown on a failed save, always naming the record type. */
export function saveFailureMessage(recordType: string, e: unknown): string {
  const msg = e instanceof Error ? e.message : "Save failed";
  return `Could not save this ${recordType} — ${msg}`;
}
