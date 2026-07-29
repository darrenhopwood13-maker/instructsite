import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { HIGH_RISK_CATEGORIES, detectHazards } from "./high-risk";

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

describe("high-risk vocabulary", () => {
  it("detects the new categories the old regexes missed", () => {
    expect(detectHazards("Mobile crane lift of precast panels")).toContain(
      "lifting_operations",
    );
    expect(detectHazards("Working in proximity to 11kV overhead line")).toContain(
      "overhead_powerlines",
    );
    expect(detectHazards("Soft strip demolition of Level 2")).toContain(
      "demolition",
    );
    expect(detectHazards("Deep trench with shoring")).toEqual(
      expect.arrayContaining(["excavation", "deep_excavation"]),
    );
    expect(detectHazards("Snagging paintwork")).toEqual([]);
  });

  it.runIf(Boolean(url && key))(
    "matches public.high_risk_categories() in the database",
    async () => {
      const supabase = createClient(url!, key!, {
        auth: { persistSession: false },
      });
      const { data, error } = await supabase.rpc("high_risk_categories");
      expect(error).toBeNull();
      expect([...(data as string[])].sort()).toEqual(
        [...HIGH_RISK_CATEGORIES].sort(),
      );
    },
  );
});
