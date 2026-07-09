import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";
import {
  buildProgrammePlaybookRows,
  type ProgrammeTask,
} from "@/lib/programme-compiler.server";

const TaskSchema = z.object({
  task_name: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  trade: z.string().default(""),
  location: z.string().default(""),
});

const CallbackSchema = z.object({
  job_id: z.string().uuid(),
  project_id: z.string().uuid(),
  status: z.enum(["parsing", "writing", "complete", "failed"]),
  stage: z.string().optional(),
  progress: z.number().min(0).max(100).optional(),
  strategy: z.string().optional(),
  error: z.string().optional(),
  stats: z.record(z.string(), z.any()).optional(),
  tasks: z.array(TaskSchema).optional(),
});

function verify(secret: string, signature: string, body: string): boolean {
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export const Route = createFileRoute("/api/public/hooks/programme-ingest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.PROGRAMME_PARSER_SECRET;
        if (!secret) {
          return new Response("Parser secret not configured", { status: 500 });
        }
        const signature = request.headers.get("x-signature") ?? "";
        const body = await request.text();
        if (!signature || !verify(secret, signature, body)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let parsed: z.infer<typeof CallbackSchema>;
        try {
          parsed = CallbackSchema.parse(JSON.parse(body));
        } catch (err) {
          const message = err instanceof Error ? err.message : "Invalid payload";
          return new Response(message, { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Progress-only callbacks (no tasks yet)
        if (parsed.status === "parsing" || (parsed.status === "writing" && !parsed.tasks)) {
          await supabaseAdmin
            .from("programme_jobs")
            .update({
              status: parsed.status,
              stage: parsed.stage ?? null,
              progress: parsed.progress ?? undefined,
              strategy: parsed.strategy ?? undefined,
            })
            .eq("id", parsed.job_id);
          return new Response("ok");
        }

        if (parsed.status === "failed") {
          await supabaseAdmin
            .from("programme_jobs")
            .update({
              status: "failed",
              stage: parsed.stage ?? "failed",
              progress: 100,
              error: parsed.error ?? "Parser reported failure",
              stats: parsed.stats ?? {},
            })
            .eq("id", parsed.job_id);
          return new Response("ok");
        }

        // Terminal write: tasks + playbooks
        const rawTasks = parsed.tasks ?? [];
        const tasks: ProgrammeTask[] = rawTasks.map((t) => ({
          taskName: t.task_name,
          startDate: t.start_date,
          endDate: t.end_date,
          trade: t.trade ?? "",
          location: t.location ?? "",
        }));

        // Look up the upload row this job points at
        const { data: jobRow, error: jobErr } = await supabaseAdmin
          .from("programme_jobs")
          .select("upload_id, project_id")
          .eq("id", parsed.job_id)
          .maybeSingle();
        if (jobErr || !jobRow?.upload_id) {
          return new Response("Job or upload missing", { status: 404 });
        }
        const uploadId = jobRow.upload_id;
        const projectId = jobRow.project_id;

        if (tasks.length === 0) {
          await supabaseAdmin
            .from("programme_jobs")
            .update({
              status: "failed",
              stage: "no-tasks",
              progress: 100,
              error:
                "Randall could not find dated activities. Try a text-based PDF or an XER / XML / CSV export.",
              stats: parsed.stats ?? {},
              strategy: parsed.strategy,
            })
            .eq("id", parsed.job_id);
          return new Response("ok");
        }

        const taskRows = tasks.map((t) => ({
          programme_upload_id: uploadId,
          project_id: projectId,
          task_name: t.taskName || "Untitled task",
          plain_english: t.taskName || "Task",
          start_date: t.startDate,
          end_date: t.endDate,
          location: t.location || null,
          trade: t.trade || null,
        }));

        // Replace tasks for this upload (idempotent re-ingest)
        await supabaseAdmin
          .from("programme_reference_tasks")
          .delete()
          .eq("programme_upload_id", uploadId);




        try {
          const batchSize = 200;
          for (let i = 0; i < taskRows.length; i += batchSize) {
            const { error } = await supabaseAdmin
              .from("programme_reference_tasks")
              .insert(taskRows.slice(i, i + batchSize));
            if (error) throw new Error(`programme_reference_tasks insert failed: ${error.message}`);
          }

          const playbookRows = buildProgrammePlaybookRows({
            projectId,
            uploadId,
            tasks,
          });

          await supabaseAdmin
            .from("daily_programme_playbooks")
            .delete()
            .eq("project_id", projectId);

          for (let i = 0; i < playbookRows.length; i += batchSize) {
            const { error } = await supabaseAdmin
              .from("daily_programme_playbooks")
              .insert(playbookRows.slice(i, i + batchSize));
            if (error) throw new Error(`daily_programme_playbooks insert failed: ${error.message}`);
          }


          await supabaseAdmin
            .from("programme_uploads")
            .update({ task_count: tasks.length, status: "ready" })
            .eq("id", uploadId);

          await supabaseAdmin
            .from("programme_jobs")
            .update({
              status: "complete",
              stage: "done",
              progress: 100,
              strategy: parsed.strategy,
              stats: {
                ...(parsed.stats ?? {}),
                task_count: tasks.length,
                day_count: playbookRows.length,
                first_date: playbookRows[0]?.playbook_date ?? null,
                last_date: playbookRows[playbookRows.length - 1]?.playbook_date ?? null,
              },
            })
            .eq("id", parsed.job_id);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Ingest write failed";
          await supabaseAdmin
            .from("programme_jobs")
            .update({ status: "failed", error: message, progress: 100 })
            .eq("id", parsed.job_id);
          return new Response(message, { status: 500 });
        }

        return new Response("ok");
      },
    },
  },
});
