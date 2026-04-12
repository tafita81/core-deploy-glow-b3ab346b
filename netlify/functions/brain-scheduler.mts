import type { Config } from "@netlify/functions";

/**
 * Scheduled function that triggers the Supabase brain-pipeline every 6 hours.
 * This is the cron trigger that makes the Cerebro run 24/7 automatically.
 *
 * Required environment variables (set in Netlify UI):
 * - VITE_SUPABASE_URL: Supabase project URL
 * - SUPABASE_SERVICE_ROLE_KEY: Supabase service role key (for invoking edge functions)
 */
export default async (req: Request) => {
  const supabaseUrl = Netlify.env.get("VITE_SUPABASE_URL");
  const serviceRoleKey = Netlify.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables");
    return;
  }

  console.log(`[CérebroDani] 🧠 Triggering brain-pipeline at ${new Date().toISOString()}`);

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/brain-pipeline`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceRoleKey}`,
        "apikey": serviceRoleKey,
      },
      body: JSON.stringify({
        source: "netlify-scheduler",
        triggered_at: new Date().toISOString(),
      }),
    });

    const status = response.status;
    const body = await response.text();

    console.log(`[CérebroDani] brain-pipeline response: ${status}`);
    console.log(`[CérebroDani] Response body: ${body.substring(0, 500)}`);

    if (!response.ok) {
      console.error(`[CérebroDani] brain-pipeline failed with status ${status}: ${body.substring(0, 200)}`);
    }
  } catch (error) {
    console.error(`[CérebroDani] Error triggering brain-pipeline:`, error);
  }
};

export const config: Config = {
  schedule: "0 */6 * * *",
};
