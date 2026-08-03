import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { fallbackNote, type PackageVariance } from "@/lib/programme-variance";

/**
 * Plain-English position note per package, grounded strictly in the computed
 * variance numbers and the recent pin / verified-diary trail. Same AI-summary
 * pattern used for daily_programme_playbooks; deterministic fallback stands
 * when no key or the model misbehaves.
 */
export async function writePositionNotes(
  packages: PackageVariance[],
  today: string,
): Promise<void> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key || packages.length === 0) return;

  const facts = packages.map((p) => ({
    key: p.key,
    package: p.label,
    status: p.status,
    days_variance: p.daysVariance,
    verified_pct: p.actualPct,
    planned_pct: p.plannedPct,
    planned_window: `${p.plannedStart} to ${p.plannedEnd}`,
    verified_diaries: p.verifiedDiaryIds.length,
    diaries_awaiting_verification: p.unverifiedDiaryCount,
    last_verified_diary: p.lastVerifiedDiaryDate,
    last_pin_activity: p.lastPinDate,
    pin_count: p.pinIds.length,
    downstream_risk_from: p.riskFrom,
  }));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);
  try {
    const gateway = createLovableAiGatewayProvider(key);
    const result = await generateText({
      model: gateway("google/gemini-2.5-flash"),
      system:
        "You are a UK construction project controls analyst writing one-line position notes for a site manager. " +
        "Use only the supplied numbers and dates. Never invent activity, causes, or people. " +
        "Plain site English, no jargon padding, 1-2 sentences per package, max 45 words.",
      prompt:
        `Today is ${today}. For each package below write a short position note describing where it stands, ` +
        `citing the days variance, verified vs planned percentage, and whether pin activity or verified diaries have dried up. ` +
        `Return one JSON object only: {"notes":[{"key":"","note":""}]}.\n\n` +
        JSON.stringify(facts),
      maxOutputTokens: 4096,
      abortSignal: controller.signal,
    });

    const match = result.text.match(/\{[\s\S]*\}/);
    if (!match) return;
    const parsed = JSON.parse(match[0]) as { notes?: Array<{ key?: string; note?: string }> };
    const byKey = new Map(packages.map((p) => [p.key, p]));
    for (const n of parsed.notes ?? []) {
      if (!n.key || !n.note) continue;
      const pkg = byKey.get(n.key);
      if (pkg) pkg.note = n.note.trim();
    }
  } catch (err) {
    console.warn("[variance] falling back to deterministic notes:", err);
    for (const p of packages) if (!p.note) p.note = fallbackNote(p, today);
  } finally {
    clearTimeout(timer);
  }
}
