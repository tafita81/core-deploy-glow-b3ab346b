import type { Config } from "@netlify/functions";

/**
 * API endpoint to manually trigger the brain-pipeline and check its status.
 * GET  /api/brain/status  - Returns scheduler info
 * POST /api/brain/trigger - Triggers the brain-pipeline immediately
 */
export default async (req: Request) => {
  if (req.method === "GET") {
    return Response.json({
      status: "active",
      scheduler: "netlify-cron",
      schedule: "every 6 hours (0 */6 * * * UTC)",
      next_runs_utc: getNextRuns(),
      message: "Cerebro is running 24/7 automatically via Netlify Scheduled Functions",
    });
  }

  if (req.method === "POST") {
    const supabaseUrl = Netlify.env.get("VITE_SUPABASE_URL");
    const serviceRoleKey = Netlify.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return Response.json(
        { error: "Missing environment variables. Configure VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY." },
        { status: 500 }
      );
    }

    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/brain-pipeline`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceRoleKey}`,
          "apikey": serviceRoleKey,
        },
        body: JSON.stringify({
          source: "netlify-manual-trigger",
          triggered_at: new Date().toISOString(),
        }),
      });

      const body = await response.text();
      let parsed;
      try {
        parsed = JSON.parse(body);
      } catch {
        parsed = { raw: body.substring(0, 1000) };
      }

      return Response.json({
        success: response.ok,
        status: response.status,
        pipeline_response: parsed,
        triggered_at: new Date().toISOString(),
      }, { status: response.ok ? 200 : 502 });
    } catch (error) {
      return Response.json(
        { error: "Failed to trigger brain-pipeline", details: String(error) },
        { status: 500 }
      );
    }
  }

  return Response.json({ error: "Method not allowed" }, { status: 405 });
};

function getNextRuns(): string[] {
  const now = new Date();
  const runs: string[] = [];
  const current = new Date(now);
  current.setMinutes(0, 0, 0);

  // Find next hour divisible by 6
  while (current.getHours() % 6 !== 0 || current <= now) {
    current.setHours(current.getHours() + 1);
  }

  for (let i = 0; i < 4; i++) {
    runs.push(current.toISOString());
    current.setHours(current.getHours() + 6);
  }

  return runs;
}

export const config: Config = {
  path: ["/api/brain/status", "/api/brain/trigger"],
  method: ["GET", "POST"],
};
