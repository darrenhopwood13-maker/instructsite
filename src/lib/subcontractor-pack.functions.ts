import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TOOLBOX_TOPICS = [
  "Manual Handling",
  "Working at Height",
  "Slips/Trips",
  "Fire Safety",
  "Waste Segregation",
  "Spill Control",
  "Hot Weather",
  "Confined Spaces",
  "Hot Works",
  "Excavations",
] as const;

const REGISTER_TYPES = ["PUWER", "LOLER", "HAVS", "Plant"] as const;

async function ensureSubcontractor(
  supabase: any,
  projectId: string,
  companyName: string,
): Promise<string> {
  const name = companyName.trim();
  const { data: existing } = await supabase
    .from("subcontractors")
    .select("id")
    .eq("project_id", projectId)
    .ilike("company_name", name)
    .maybeSingle();
  if (existing?.id) return existing.id as string;
  const { data: created, error } = await supabase
    .from("subcontractors")
    .insert({ project_id: projectId, company_name: name })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return created.id as string;
}

export const getMyCompanyForProject = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ projectId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: inv } = await context.supabase
      .from("subcontractor_invites")
      .select("company_name")
      .eq("project_id", data.projectId)
      .eq("accepted_by", context.userId)
      .order("accepted_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return { companyName: (inv?.company_name as string | null) ?? null };
  });

export const getSubcontractorPack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        companyName: z.string().trim().min(1).max(200),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const subId = await ensureSubcontractor(context.supabase, data.projectId, data.companyName);
    const [subRes, workersRes, registersRes, talksRes, aheadsRes] = await Promise.all([
      context.supabase.from("subcontractors").select("*").eq("id", subId).single(),
      context.supabase
        .from("workers")
        .select("*")
        .eq("subcontractor_id", subId)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("registers")
        .select("*")
        .eq("subcontractor_id", subId)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("toolbox_talks")
        .select("*")
        .eq("subcontractor_id", subId)
        .order("date", { ascending: false })
        .limit(10),
      context.supabase
        .from("look_aheads")
        .select("*")
        .eq("subcontractor_id", subId)
        .order("date", { ascending: false })
        .limit(5),
    ]);
    return {
      subcontractor: subRes.data,
      workers: workersRes.data ?? [],
      registers: registersRes.data ?? [],
      toolboxTalks: talksRes.data ?? [],
      lookAheads: aheadsRes.data ?? [],
    };
  });

export const addWorker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        subcontractorId: z.string().uuid(),
        name: z.string().trim().min(1).max(120),
        role: z.string().trim().max(80).optional().nullable(),
        competencyCardUrl: z.string().trim().max(500).optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("workers").insert({
      subcontractor_id: data.subcontractorId,
      name: data.name,
      role: data.role || null,
      competency_card_url: data.competencyCardUrl || null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addRegister = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        subcontractorId: z.string().uuid(),
        type: z.enum(REGISTER_TYPES),
        assetName: z.string().trim().max(200).optional().nullable(),
        inspectionDate: z.string().trim().optional().nullable(),
        certificateUrl: z.string().trim().max(500).optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("registers").insert({
      subcontractor_id: data.subcontractorId,
      type: data.type,
      asset_name: data.assetName || null,
      inspection_date: data.inspectionDate || null,
      certificate_url: data.certificateUrl || null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addToolboxTalk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        subcontractorId: z.string().uuid(),
        topic: z.enum(TOOLBOX_TOPICS),
        attendees: z.array(z.string().trim().min(1)).max(200),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("toolbox_talks").insert({
      subcontractor_id: data.subcontractorId,
      topic: data.topic,
      attendance_list: data.attendees,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addLookAhead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        subcontractorId: z.string().uuid(),
        workPlan: z.string().trim().max(4000),
        isHighRisk: z.boolean().default(false),
        permitRequired: z.boolean().default(false),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("look_aheads").insert({
      subcontractor_id: data.subcontractorId,
      work_plan: data.workPlan,
      is_high_risk: data.isHighRisk,
      permit_required: data.permitRequired,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getComplianceSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ path: z.string().trim().min(1).max(1000) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: sig, error } = await context.supabase.storage
      .from("compliance-docs")
      .createSignedUrl(data.path, 60 * 10);
    if (error) throw new Error(error.message);
    return { url: sig.signedUrl };
  });

export const getManagerPack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ projectId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: subs, error } = await context.supabase
      .from("subcontractors")
      .select("id, company_name, manager_name, created_at")
      .eq("project_id", data.projectId)
      .order("company_name", { ascending: true });
    if (error) throw new Error(error.message);
    const rows = subs ?? [];
    const detailed = await Promise.all(
      rows.map(async (s: any) => {
        const [w, r, t, l] = await Promise.all([
          context.supabase.from("workers").select("id,name,role,competency_card_url,created_at").eq("subcontractor_id", s.id).order("created_at", { ascending: false }),
          context.supabase.from("registers").select("id,type,asset_name,inspection_date,certificate_url,created_at").eq("subcontractor_id", s.id).order("created_at", { ascending: false }),
          context.supabase.from("toolbox_talks").select("id,topic,attendance_list,date").eq("subcontractor_id", s.id).order("date", { ascending: false }).limit(5),
          context.supabase.from("look_aheads").select("id,work_plan,is_high_risk,permit_required,date").eq("subcontractor_id", s.id).order("date", { ascending: false }).limit(3),
        ]);
        return {
          ...s,
          workers: w.data ?? [],
          registers: r.data ?? [],
          toolboxTalks: t.data ?? [],
          lookAheads: l.data ?? [],
        };
      }),
    );
    return { subcontractors: detailed };
  });

export const checkWorkerDuplicate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        subcontractorId: z.string().uuid(),
        name: z.string().trim().min(1).max(120),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const today = new Date().toISOString().slice(0, 10);
    const { data: rows } = await context.supabase
      .from("workers")
      .select("id, competency_card_url, created_at")
      .eq("subcontractor_id", data.subcontractorId)
      .ilike("name", data.name);
    const same = (rows ?? []) as any[];
    return {
      exists: same.length > 0,
      hasCard: same.some((r) => !!r.competency_card_url),
      sameDay: same.some((r) => (r.created_at ?? "").slice(0, 10) === today),
    };
  });

export const checkRegisterDuplicate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        subcontractorId: z.string().uuid(),
        type: z.enum(REGISTER_TYPES),
        assetName: z.string().trim().max(200).optional().nullable(),
        inspectionDate: z.string().trim().optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("registers")
      .select("id, certificate_url, inspection_date")
      .eq("subcontractor_id", data.subcontractorId)
      .eq("type", data.type);
    if (data.assetName) q = q.ilike("asset_name", data.assetName);
    if (data.inspectionDate) q = q.eq("inspection_date", data.inspectionDate);
    const { data: rows } = await q;
    const same = (rows ?? []) as any[];
    return {
      exists: same.length > 0,
      hasCert: same.some((r) => !!r.certificate_url),
    };
  });

export const TOOLBOX_TOPIC_OPTIONS = TOOLBOX_TOPICS;
export const REGISTER_TYPE_OPTIONS = REGISTER_TYPES;

