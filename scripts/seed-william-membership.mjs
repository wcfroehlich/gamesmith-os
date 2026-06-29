import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const williamAuthUserId = process.env.WILLIAM_AUTH_USER_ID;

if (!supabaseUrl || !serviceRoleKey || !williamAuthUserId) {
  throw new Error(
    "SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and WILLIAM_AUTH_USER_ID are required."
  );
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const { data: workspace, error: workspaceError } = await supabase
  .from("workspaces")
  .select("id")
  .eq("slug", "gamesmith-news")
  .single();

if (workspaceError || !workspace) {
  throw workspaceError || new Error("Gamesmith workspace not found.");
}

const { data: actor, error: actorError } = await supabase
  .from("actors")
  .select("id")
  .eq("workspace_id", workspace.id)
  .eq("actor_type", "human")
  .eq("display_name", "William")
  .single();

if (actorError || !actor) {
  throw actorError || new Error("William actor not found.");
}

const { data, error } = await supabase
  .from("workspace_memberships")
  .upsert(
    {
      workspace_id: workspace.id,
      actor_id: actor.id,
      auth_user_id: williamAuthUserId,
      role: "editor_in_chief",
      status: "active",
      revoked_at: null,
    },
    { onConflict: "workspace_id,actor_id" }
  )
  .select("id,workspace_id,actor_id,auth_user_id,role,status")
  .single();

if (error) throw error;

console.log(JSON.stringify({ ok: true, membership: data }, null, 2));
