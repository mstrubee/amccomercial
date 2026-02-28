import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ProjectFolder {
  id: string;
  name: string;
  parent_id: string | null;
  drive_folder_id: string | null;
  children?: ProjectFolder[];
}

async function getAccessToken(): Promise<string> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth credentials not configured");
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data: setting } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", "google_refresh_token")
    .single();

  if (!setting?.value) {
    throw new Error("NO_REFRESH_TOKEN");
  }

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: setting.value,
      grant_type: "refresh_token",
    }),
  });

  const data = await resp.json();
  if (!resp.ok) {
    console.error("Token refresh failed:", JSON.stringify(data));
    throw new Error(`Token refresh failed: ${data.error_description || data.error}`);
  }
  return data.access_token;
}

async function findOrCreateFolder(
  accessToken: string,
  name: string,
  parentId: string | null,
  sharedDriveId: string
): Promise<string> {
  let query = `name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  }

  const searchResp = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=drive&driveId=${sharedDriveId}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const searchData = await searchResp.json();
  
  if (!searchResp.ok) {
    console.error("Drive search failed:", JSON.stringify(searchData));
    throw new Error(`Drive search failed: ${searchData.error?.message || 'Unknown'}`);
  }
  
  if (searchData.files?.length > 0) {
    return searchData.files[0].id;
  }

  const createResp = await fetch("https://www.googleapis.com/drive/v3/files?supportsAllDrives=true", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId || sharedDriveId],
    }),
  });

  const created = await createResp.json();
  if (!createResp.ok) {
    console.error("Drive create failed:", JSON.stringify(created));
    throw new Error(`Failed to create folder '${name}': ${created.error?.message || 'Unknown'}`);
  }
  return created.id;
}

function buildTree(flat: ProjectFolder[]): ProjectFolder[] {
  const map = new Map<string, ProjectFolder>();
  const roots: ProjectFolder[] = [];

  for (const item of flat) {
    map.set(item.id, { ...item, children: [] });
  }
  for (const node of map.values()) {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id)!.children!.push(node);
    } else {
      roots.push(node);
    }
  }
  const sort = (nodes: ProjectFolder[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name));
    nodes.forEach((n) => sort(n.children || []));
  };
  sort(roots);
  return roots;
}

async function renameDriveFolder(accessToken: string, folderId: string, newName: string) {
  const resp = await fetch(
    `https://www.googleapis.com/drive/v3/files/${folderId}?supportsAllDrives=true`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: newName }),
    }
  );
  const data = await resp.json();
  if (!resp.ok) {
    console.error("Drive rename failed:", JSON.stringify(data));
  }
}

async function getDriveFolderName(accessToken: string, folderId: string): Promise<string | null> {
  const resp = await fetch(
    `https://www.googleapis.com/drive/v3/files/${folderId}?supportsAllDrives=true&fields=name`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!resp.ok) return null;
  const data = await resp.json();
  return data.name || null;
}

async function syncRecursive(
  admin: ReturnType<typeof createClient>,
  accessToken: string,
  nodes: ProjectFolder[],
  driveParentId: string,
  sharedDriveId: string,
  stats: { created: number; updated: number; skipped: number }
) {
  for (const node of nodes) {
    let driveFolderId = node.drive_folder_id;

    if (!driveFolderId) {
      driveFolderId = await findOrCreateFolder(accessToken, node.name, driveParentId, sharedDriveId);
      await admin
        .from("project_folders")
        .update({ drive_folder_id: driveFolderId })
        .eq("id", node.id);
      stats.created++;
    } else {
      // Check if name changed and update in Drive
      const currentName = await getDriveFolderName(accessToken, driveFolderId);
      if (currentName && currentName !== node.name) {
        await renameDriveFolder(accessToken, driveFolderId, node.name);
        stats.updated++;
      } else {
        stats.skipped++;
      }
    }

    if (node.children && node.children.length > 0) {
      await syncRecursive(admin, accessToken, node.children, driveFolderId, sharedDriveId, stats);
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    let sharedDriveId = Deno.env.get("GOOGLE_SHARED_DRIVE_ID");

    if (!sharedDriveId) {
      throw new Error("GOOGLE_SHARED_DRIVE_ID not configured");
    }

    // Extract ID from URL if a full URL was provided
    const folderMatch = sharedDriveId.match(/\/folders\/([^/?]+)/);
    if (folderMatch) {
      sharedDriveId = folderMatch[1];
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      console.error("Auth error:", userErr?.message);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, project_id, project_name } = await req.json();

    if (action === "sync") {
      if (!project_id || !project_name) {
        throw new Error("project_id and project_name are required");
      }

      console.log(`Starting sync for project: ${project_name} (${project_id})`);

      const accessToken = await getAccessToken();

      // 1. Find or create "AMC Repositorio" root
      const amcRootId = await findOrCreateFolder(accessToken, "AMC Repositorio", null, sharedDriveId);
      // 2. Find or create project subfolder under AMC Repositorio
      const projectFolderId = await findOrCreateFolder(accessToken, project_name, amcRootId, sharedDriveId);
      console.log(`AMC Repositorio: ${amcRootId}, Project folder: ${projectFolderId}`);

      // 3. Get project folders using service role to bypass RLS for updates
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const admin = createClient(supabaseUrl, serviceRoleKey);

      const { data: folders, error: fErr } = await admin
        .from("project_folders")
        .select("id, name, parent_id, drive_folder_id")
        .eq("project_id", project_id)
        .order("orden", { ascending: true });

      if (fErr) throw fErr;
      if (!folders || folders.length === 0) {
        return new Response(JSON.stringify({ message: "No hay carpetas para sincronizar", created: 0, skipped: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const tree = buildTree(folders as ProjectFolder[]);
      const stats = { created: 0, updated: 0, skipped: 0 };

      // 4. Sync recursively under project folder
      await syncRecursive(admin, accessToken, tree, projectFolderId, sharedDriveId, stats);

      console.log(`Sync complete: ${stats.created} created, ${stats.updated} updated, ${stats.skipped} skipped`);

      return new Response(
        JSON.stringify({ message: "Sincronización completada", ...stats }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error("Invalid action");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("sync-drive error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: message === "NO_REFRESH_TOKEN" ? 400 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
