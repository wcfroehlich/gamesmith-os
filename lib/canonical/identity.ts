import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type WorkspaceContext = {
  workspaceId: string;
  actorId: string;
};

export type RequestActorContext = WorkspaceContext & {
  authUserId: string;
  role: string;
};

const EDITOR_ROLES = new Set(["owner", "editor_in_chief", "editor", "system_admin"]);

export class AuthorizationError extends Error {
  status = 401;
}

export class ForbiddenError extends Error {
  status = 403;
}

function bearerToken(request: Request) {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

export async function getDefaultWorkspaceId() {
  const { data, error } = await supabaseAdmin
    .from("workspaces")
    .select("id")
    .eq("slug", "gamesmith-news")
    .single();

  if (error || !data) {
    throw new Error("Gamesmith workspace has not been seeded.");
  }

  return data.id as string;
}

export async function getSystemActorContext(): Promise<WorkspaceContext> {
  const workspaceId = await getDefaultWorkspaceId();

  const { data, error } = await supabaseAdmin
    .from("actors")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("actor_type", "system")
    .eq("display_name", "Gamesmith Import System")
    .single();

  if (error || !data) {
    throw new Error("Gamesmith import system actor has not been seeded.");
  }

  return {
    workspaceId,
    actorId: data.id as string,
  };
}

export async function requireWorkspaceActor(
  request: Request,
  allowedRoles = EDITOR_ROLES
): Promise<RequestActorContext> {
  const token = bearerToken(request);

  if (!token) {
    throw new AuthorizationError("Missing bearer token.");
  }

  const { data: userData, error: userError } =
    await supabaseAdmin.auth.getUser(token);

  if (userError || !userData.user) {
    throw new AuthorizationError("Invalid bearer token.");
  }

  const workspaceId = await getDefaultWorkspaceId();

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from("workspace_memberships")
    .select("actor_id,role,status")
    .eq("workspace_id", workspaceId)
    .eq("auth_user_id", userData.user.id)
    .eq("status", "active")
    .single();

  if (membershipError || !membership) {
    throw new ForbiddenError("No active Gamesmith workspace membership.");
  }

  const role = membership.role as string;

  if (!allowedRoles.has(role)) {
    throw new ForbiddenError("Workspace role is not authorized for this action.");
  }

  return {
    workspaceId,
    actorId: membership.actor_id as string,
    authUserId: userData.user.id,
    role,
  };
}

export function jsonError(error: unknown) {
  const status =
    error instanceof AuthorizationError || error instanceof ForbiddenError
      ? error.status
      : 500;

  return Response.json(
    {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    },
    { status }
  );
}
