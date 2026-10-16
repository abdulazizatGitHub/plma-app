// Runs the end-of-period jobs once (normally hourly): group goal results and rewards, podiums.
// `npm run jobs:finalize -w @life/api` — useful after maintenance or in tests.
import postgres from "postgres";
import { finalizeGroupGoals, finalizeGroupPodiums } from "../src/groups/service.js";
import { finalizePodiums } from "../src/social/service.js";
import { databaseUrl } from "./load-env.mjs";

const sql = postgres(databaseUrl!, { ssl: databaseUrl!.includes("supabase") ? "require" : undefined, max: 1, prepare: !databaseUrl!.includes(":6543") });
try {
  const goals = await finalizeGroupGoals(sql);
  const podiums = await finalizePodiums(sql);
  const groupPodiums = await finalizeGroupPodiums(sql);
  console.log(JSON.stringify({ goalRewards: goals, podiums, groupPodiums }));
} finally {
  await sql.end();
}
