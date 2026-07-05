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
    console.error("[FOLDER_SYNC] Token refresh failed:", JSON.stringify(data));
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
  const escapedName = name.replace(/'/g, "\\'");
  let query = `name='${escapedName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  }

  // Use corpora=allDrives for reliable search (sharedDriveId may be a folder ID, not a drive ID)
  const searchResp = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=allDrives&fields=files(id,name,createdTime)&orderBy=createdTime`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const searchData = await searchResp.json();
  
  if (!searchResp.ok) {
    console.error("[FOLDER_SYNC] Drive search failed:", JSON.stringify(searchData));
    throw new Error(`Drive search failed: ${searchData.error?.message || 'Unknown'}`);
  }
  
  if (searchData.files?.length > 0) {
    if (searchData.files.length > 1) {
      console.log(`[FOLDER_SYNC] Multiple folders found for "${name}" under parent ${parentId}: ${searchData.files.map((f: any) => f.id).join(", ")}. Using oldest.`);
    }
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
    console.error("[FOLDER_SYNC] Drive create failed:", JSON.stringify(created));
    throw new Error(`Failed to create folder '${name}': ${created.error?.message || 'Unknown'}`);
  }
  console.log(`[FOLDER_SYNC] Created folder "${name}" -> ${created.id}`);
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
    console.error("[FOLDER_SYNC] Drive rename failed:", JSON.stringify(data));
  }
}

/** List the non-folder files directly inside a Drive folder (paginated). */
async function listFilesInFolder(
  accessToken: string,
  folderId: string
): Promise<Array<{ id: string; name: string; createdTime: string }>> {
  const files: Array<{ id: string; name: string; createdTime: string }> = [];
  let pageToken: string | undefined;
  do {
    const q = `'${folderId}' in parents and mimeType!='application/vnd.google-apps.folder' and trashed=false`;
    const url =
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}` +
      `&supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=allDrives` +
      `&fields=nextPageToken,files(id,name,createdTime)&orderBy=createdTime&pageSize=200` +
      `${pageToken ? `&pageToken=${pageToken}` : ""}`;
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await resp.json();
    if (!resp.ok) {
      console.log(`[DEDUP_FILES] Failed to list files in ${folderId}: ${JSON.stringify(data?.error || data)}`);
      break;
    }
    if (data.files) files.push(...data.files);
    pageToken = data.nextPageToken;
  } while (pageToken);
  return files;
}

/** Check if a Drive folder exists and return its name + parents. Returns null if not found/broken. */
async function getDriveFolderInfo(
  accessToken: string,
  folderId: string
): Promise<{ name: string; parents?: string[] } | null> {
  const resp = await fetch(
    `https://www.googleapis.com/drive/v3/files/${folderId}?supportsAllDrives=true&fields=name,parents,trashed`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!resp.ok) {
    console.log(`[FOLDER_SYNC] Folder ${folderId} not accessible (status ${resp.status})`);
    return null;
  }
  const data = await resp.json();
  if (data.trashed) {
    console.log(`[FOLDER_SYNC] Folder ${folderId} is trashed`);
    return null;
  }
  return { name: data.name || null, parents: data.parents || [] };
}

/** Move files from an old Drive folder to a new one and update drive_files records */
async function resolveProjectDriveFolderId(
  admin: ReturnType<typeof createClient>,
  accessToken: string,
  projectId: string,
  projectName: string,
  sharedDriveId: string
): Promise<{ amcRootId: string; projectDriveFolderId: string; source: "mapped_parent" | "name_lookup" }> {
  const amcRootId = await findOrCreateFolder(accessToken, "AMC Repositorio", null, sharedDriveId);

  // Prefer deriving the project root from already-mapped ROOT folders (parent_id IS NULL)
  const { data: mappedRootFolders } = await admin
    .from("project_folders")
    .select("drive_folder_id")
    .eq("project_id", projectId)
    .is("parent_id", null)
    .not("drive_folder_id", "is", null)
    .limit(5);

  for (const folder of mappedRootFolders || []) {
    if (!folder.drive_folder_id) continue;
    const info = await getDriveFolderInfo(accessToken, folder.drive_folder_id);
    const parentId = info?.parents?.[0];
    if (parentId) {
      console.log(`[RESOLVE] Project root derived from mapped root folder (drive_parent=${parentId})`);
      return { amcRootId, projectDriveFolderId: parentId, source: "mapped_parent" };
    }
  }

  // Fallback: name-based lookup/create under AMC root
  const projectDriveFolderId = await findOrCreateFolder(accessToken, projectName, amcRootId, sharedDriveId);
  return { amcRootId, projectDriveFolderId, source: "name_lookup" };
}

async function migrateFilesToNewFolder(
  admin: ReturnType<typeof createClient>,
  accessToken: string,
  oldFolderId: string,
  newFolderId: string,
  projectFolderId: string
) {
  // Get drive_files records pointing to the old folder
  const { data: files } = await admin
    .from("drive_files")
    .select("id, drive_file_id, file_name")
    .eq("project_folder_id", projectFolderId)
    .eq("drive_folder_id", oldFolderId);

  if (!files || files.length === 0) return;

  console.log(`[FOLDER_SYNC] Migrating ${files.length} file(s) from ${oldFolderId} to ${newFolderId}`);

  for (const file of files) {
    try {
      // Try to move file in Drive (remove old parent, add new parent)
      const moveResp = await fetch(
        `https://www.googleapis.com/drive/v3/files/${file.drive_file_id}?addParents=${newFolderId}&removeParents=${oldFolderId}&supportsAllDrives=true`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        }
      );

      if (moveResp.ok) {
        // Update drive_files record
        await admin.from("drive_files").update({ drive_folder_id: newFolderId }).eq("id", file.id);
        console.log(`[FOLDER_SYNC] Moved file "${file.file_name}" to new folder`);
      } else {
        // File might be trashed/inaccessible — just update the DB record so it doesn't point to dead folder
        const errText = await moveResp.text();
        console.log(`[FOLDER_SYNC] Could not move file "${file.file_name}" (status ${moveResp.status}): ${errText}. Updating DB record.`);
        await admin.from("drive_files").update({ drive_folder_id: newFolderId }).eq("id", file.id);
      }
    } catch (e) {
      console.error(`[FOLDER_SYNC] Error migrating file "${file.file_name}":`, (e as Error).message);
    }
  }

  // Also update any pending_sync records pointing to old folder
  await admin.from("pending_sync").update({ drive_folder_id: newFolderId }).eq("drive_folder_id", oldFolderId);
}

async function syncRecursive(
  admin: ReturnType<typeof createClient>,
  accessToken: string,
  nodes: ProjectFolder[],
  driveParentId: string,
  sharedDriveId: string,
  stats: { created: number; updated: number; skipped: number; repaired: number }
) {
  for (const node of nodes) {
    let driveFolderId = node.drive_folder_id;
    const oldDriveFolderId = driveFolderId; // Keep reference for file migration

    if (!driveFolderId) {
      // No drive_folder_id — create or find
      driveFolderId = await findOrCreateFolder(accessToken, node.name, driveParentId, sharedDriveId);
      await admin
        .from("project_folders")
        .update({ drive_folder_id: driveFolderId })
        .eq("id", node.id);
      stats.created++;
      console.log(`[FOLDER_SYNC] Linked "${node.name}" (${node.id}) -> ${driveFolderId}`);
    } else {
      // Has drive_folder_id — verify it's still valid and under the correct parent
      const info = await getDriveFolderInfo(accessToken, driveFolderId);

      if (!info) {
        // Folder is broken/deleted/trashed — recreate under correct parent
        console.log(`[FOLDER_SYNC] Broken folder detected for "${node.name}" (old: ${driveFolderId}). Repairing...`);
        driveFolderId = await findOrCreateFolder(accessToken, node.name, driveParentId, sharedDriveId);
        await admin
          .from("project_folders")
          .update({ drive_folder_id: driveFolderId })
          .eq("id", node.id);
        // Migrate existing files from old folder to new folder
        if (oldDriveFolderId && oldDriveFolderId !== driveFolderId) {
          await migrateFilesToNewFolder(admin, accessToken, oldDriveFolderId, driveFolderId, node.id);
        }
        stats.repaired++;
        console.log(`[FOLDER_SYNC] Repaired "${node.name}" -> ${driveFolderId}`);
      } else {
        // Folder exists — check if it's under the right parent
        const isUnderCorrectParent = info.parents && info.parents.includes(driveParentId);

        if (!isUnderCorrectParent) {
          console.log(`[FOLDER_SYNC] Folder "${node.name}" (${driveFolderId}) is under wrong parent. Repairing...`);
          driveFolderId = await findOrCreateFolder(accessToken, node.name, driveParentId, sharedDriveId);
          await admin
            .from("project_folders")
            .update({ drive_folder_id: driveFolderId })
            .eq("id", node.id);
          if (oldDriveFolderId && oldDriveFolderId !== driveFolderId) {
            await migrateFilesToNewFolder(admin, accessToken, oldDriveFolderId, driveFolderId, node.id);
          }
          stats.repaired++;
        } else if (info.name !== node.name) {
          await renameDriveFolder(accessToken, driveFolderId, node.name);
          stats.updated++;
        } else {
          stats.skipped++;
        }
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
      console.error("[FOLDER_SYNC] Auth error:", userErr?.message);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, project_id, project_name, drive_folder_id: reqDriveFolderId } = body;

    if (action === "sync") {
      if (!project_id || !project_name) {
        throw new Error("project_id and project_name are required");
      }

      console.log(`[FOLDER_SYNC] Starting sync for project: ${project_name} (${project_id})`);

      const accessToken = await getAccessToken();
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const admin = createClient(supabaseUrl, serviceRoleKey);

      const { amcRootId, projectDriveFolderId, source } = await resolveProjectDriveFolderId(
        admin,
        accessToken,
        project_id,
        project_name,
        sharedDriveId
      );
      console.log(`[FOLDER_SYNC] AMC Repositorio: ${amcRootId}, Project folder: ${projectDriveFolderId} (source=${source})`);

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
      const stats = { created: 0, updated: 0, skipped: 0, repaired: 0 };

      await syncRecursive(admin, accessToken, tree, projectDriveFolderId, sharedDriveId, stats);

      console.log(`[FOLDER_SYNC] Sync complete: ${stats.created} created, ${stats.updated} updated, ${stats.skipped} skipped, ${stats.repaired} repaired`);

      return new Response(
        JSON.stringify({ message: "Sincronización completada", ...stats }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "repair_orphaned_files") {
      if (!project_id) throw new Error("project_id is required");

      console.log(`[FOLDER_SYNC] Repairing orphaned files for project ${project_id}`);
      const accessToken = await getAccessToken();
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const admin = createClient(supabaseUrl, serviceRoleKey);

      // Get all project folders with their current drive_folder_id
      const { data: folders } = await admin
        .from("project_folders")
        .select("id, drive_folder_id")
        .eq("project_id", project_id);

      if (!folders) throw new Error("No folders found");

      let repaired = 0;
      for (const folder of folders) {
        if (!folder.drive_folder_id) continue;

        // Find drive_files for this project_folder that have a different (old) drive_folder_id
        const { data: orphaned } = await admin
          .from("drive_files")
          .select("id, drive_file_id, file_name, drive_folder_id")
          .eq("project_folder_id", folder.id)
          .neq("drive_folder_id", folder.drive_folder_id);

        if (!orphaned || orphaned.length === 0) continue;

        for (const file of orphaned) {
          try {
            // Try to move the file in Drive
            const moveResp = await fetch(
              `https://www.googleapis.com/drive/v3/files/${file.drive_file_id}?addParents=${folder.drive_folder_id}&removeParents=${file.drive_folder_id}&supportsAllDrives=true`,
              {
                method: "PATCH",
                headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
              }
            );

            if (moveResp.ok) {
              await admin.from("drive_files").update({ drive_folder_id: folder.drive_folder_id }).eq("id", file.id);
              console.log(`[FOLDER_SYNC] Moved orphaned file "${file.file_name}" to correct folder`);
              repaired++;
            } else {
              // File may be inaccessible — just update the DB record
              console.log(`[FOLDER_SYNC] Could not move "${file.file_name}" in Drive, updating DB only`);
              await admin.from("drive_files").update({ drive_folder_id: folder.drive_folder_id }).eq("id", file.id);
              repaired++;
            }
          } catch (e) {
            console.error(`[FOLDER_SYNC] Error repairing file "${file.file_name}":`, (e as Error).message);
          }
        }
      }

      console.log(`[FOLDER_SYNC] Repaired ${repaired} orphaned file(s)`);
      return new Response(
        JSON.stringify({ message: "Archivos huérfanos reparados", repaired }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "delete_folder") {
      if (!reqDriveFolderId) throw new Error("drive_folder_id is required");

      const accessToken = await getAccessToken();

      // Delete folder from Drive (and all its contents)
      const delResp = await fetch(
        `https://www.googleapis.com/drive/v3/files/${reqDriveFolderId}?supportsAllDrives=true`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!delResp.ok && delResp.status !== 404) {
        const errData = await delResp.json().catch(() => ({}));
        console.error("[FOLDER_SYNC] Drive folder delete failed:", JSON.stringify(errData));
        throw new Error(`Drive delete failed: ${(errData as any).error?.message || delResp.statusText}`);
      }
      if (delResp.status !== 204) {
        await delResp.text();
      }

      // Clean up drive_files referencing this drive_folder_id
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const admin = createClient(supabaseUrl, serviceRoleKey);
      await admin.from("drive_files").delete().eq("drive_folder_id", reqDriveFolderId);

      console.log(`[FOLDER_SYNC] Deleted Drive folder: ${reqDriveFolderId}`);

      return new Response(
        JSON.stringify({ message: "Carpeta eliminada de Drive" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "get_project_drive_id") {
      if (!project_id || !project_name) throw new Error("project_id and project_name are required");

      const accessToken = await getAccessToken();
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const admin = createClient(supabaseUrl, serviceRoleKey);
      const { projectDriveFolderId } = await resolveProjectDriveFolderId(
        admin,
        accessToken,
        project_id,
        project_name,
        sharedDriveId
      );

      return new Response(
        JSON.stringify({ drive_folder_id: projectDriveFolderId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "reverse_sync") {
      if (!project_id || !project_name) throw new Error("project_id and project_name are required");

      console.log(`[REVERSE_SYNC] Starting reverse sync for project: ${project_name} (${project_id})`);

      const accessToken = await getAccessToken();
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const admin = createClient(supabaseUrl, serviceRoleKey);

      // Get the project root folder in Drive
      const { projectDriveFolderId } = await resolveProjectDriveFolderId(
        admin,
        accessToken,
        project_id,
        project_name,
        sharedDriveId
      );

      // Get all project folders from DB
      const { data: dbFolders } = await admin
        .from("project_folders")
        .select("id, name, parent_id, drive_folder_id")
        .eq("project_id", project_id);

      if (!dbFolders) throw new Error("Could not read project folders");

      const stats = { folders_added: 0, folders_removed: 0, files_added: 0, files_removed: 0 };

      // Fallback target for files uploaded directly to the project root in Drive.
      // If there is no DB folder mapped to the project root folder itself, use the first root folder in DB.
      const projectRootDbFolderId =
        dbFolders
          .filter((f) => f.parent_id === null)
          .sort((a, b) => a.name.localeCompare(b.name))[0]?.id ?? null;
      async function listDriveChildren(parentDriveId: string): Promise<Array<{ id: string; name: string; mimeType: string; size?: string }>> {
        type DriveItem = { id: string; name: string; mimeType: string; size?: string };

        const fetchChildren = async (
          mode: "scoped_drive" | "unscoped" | "all_drives"
        ): Promise<DriveItem[]> => {
          const items: DriveItem[] = [];
          let pageToken: string | undefined;

          do {
            const q = `'${parentDriveId}' in parents and trashed=false`;
            const base =
              `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}` +
              `&supportsAllDrives=true&includeItemsFromAllDrives=true&spaces=drive` +
              `&fields=nextPageToken,incompleteSearch,files(id,name,mimeType,size)` +
              `&pageSize=100${pageToken ? `&pageToken=${pageToken}` : ""}`;

            const modeSuffix =
              mode === "scoped_drive"
                ? `&corpora=drive&driveId=${sharedDriveId}`
                : mode === "all_drives"
                ? `&corpora=allDrives`
                : "";

            const url = `${base}${modeSuffix}`;
            const resp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
            const data = await resp.json();

            if (!resp.ok) {
              console.log(`[REVERSE_SYNC] listDriveChildren(${mode}) error for ${parentDriveId}: ${JSON.stringify(data?.error || data)}`);
              break;
            }

            if (data.incompleteSearch) {
              console.log(`[REVERSE_SYNC] listDriveChildren(${mode}) incompleteSearch=true for ${parentDriveId}`);
            }

            if (data.files) items.push(...data.files);
            pageToken = data.nextPageToken;
          } while (pageToken);

          return items;
        };

        const scoped = await fetchChildren("scoped_drive");
        const unscoped = await fetchChildren("unscoped");
        const allDrives = await fetchChildren("all_drives");

        const merged = new Map<string, DriveItem>();
        for (const item of [...scoped, ...unscoped, ...allDrives]) {
          merged.set(item.id, item);
        }

        console.log(
          `[REVERSE_SYNC] listDriveChildren(${parentDriveId}) scoped=${scoped.length}, unscoped=${unscoped.length}, allDrives=${allDrives.length}, merged=${merged.size}`
        );

        return Array.from(merged.values());
      }

      // Process folders recursively: sync Drive folders into DB
      async function reverseSyncFolder(driveFolderId: string, dbParentId: string | null) {
        const driveChildren = await listDriveChildren(driveFolderId);
        const driveFolders = driveChildren.filter(c => c.mimeType === "application/vnd.google-apps.folder");
        const driveFiles = driveChildren.filter(c => c.mimeType !== "application/vnd.google-apps.folder");

        console.log(`[REVERSE_SYNC] Scanning Drive folder ${driveFolderId}: ${driveFolders.length} folders, ${driveFiles.length} files (dbParentId=${dbParentId})${driveFiles.length > 0 ? ` — files: ${driveFiles.map(f => f.name).join(", ")}` : ""}`);

        // Get DB folders under this parent
        const dbChildFolders = dbFolders!.filter(f => f.parent_id === dbParentId);
        // Get DB folder that maps to this drive folder
        const dbFolderForThis = dbFolders!.find(f => f.drive_folder_id === driveFolderId);
        const isProjectRootDriveFolder = driveFolderId === projectDriveFolderId;

        // Fallback order:
        // 1) exact DB folder mapped to this Drive folder
        // 2) current DB parent in recursion
        // 3) project root DB folder (for files uploaded directly in project root folder in Drive)
        const targetFolderId = dbFolderForThis?.id || dbParentId || (isProjectRootDriveFolder ? projectRootDbFolderId : null);

        // --- FOLDERS: Import from Drive ---
        for (const df of driveFolders) {
          const existing = dbFolders!.find(f => f.drive_folder_id === df.id);
          if (!existing) {
            // New folder in Drive not in DB — create it
            const { data: inserted } = await admin
              .from("project_folders")
              .insert({ name: df.name, project_id, parent_id: dbParentId, drive_folder_id: df.id, orden: 0 })
              .select("id, name, parent_id, drive_folder_id")
              .single();
            if (inserted) {
              dbFolders!.push(inserted);
              stats.folders_added++;
              console.log(`[REVERSE_SYNC] Added folder from Drive: "${df.name}"`);
              // Recurse into the new folder
              await reverseSyncFolder(df.id, inserted.id);
            }
          } else {
            // Already exists — recurse
            await reverseSyncFolder(df.id, existing.id);
          }
        }

        // --- FOLDERS: Remove from DB if deleted in Drive ---
        for (const dbChild of dbChildFolders) {
          if (dbChild.drive_folder_id) {
            const stillInDrive = driveFolders.some(df => df.id === dbChild.drive_folder_id);
            if (!stillInDrive) {
              // Folder was deleted from Drive — remove from DB (cascade: files + subfolders)
              console.log(`[REVERSE_SYNC] Removing folder "${dbChild.name}" (deleted from Drive)`);
              // Delete drive_files for this folder
              await admin.from("drive_files").delete().eq("project_folder_id", dbChild.id);
              // Delete pending_sync for this folder
              await admin.from("pending_sync").delete().eq("project_folder_id", dbChild.id);
              // Delete the folder record
              await admin.from("project_folders").delete().eq("id", dbChild.id);
              stats.folders_removed++;
            }
          }
        }

        // --- FILES: Import from Drive ---
        if (targetFolderId && driveFiles.length > 0) {
          // Get existing drive_files for this target folder AND this specific drive folder
          const { data: existingFiles } = await admin
            .from("drive_files")
            .select("id, drive_file_id")
            .eq("project_folder_id", targetFolderId)
            .eq("drive_folder_id", driveFolderId);

          const existingFileIds = new Set((existingFiles || []).map(f => f.drive_file_id));

          for (const df of driveFiles) {
            if (!existingFileIds.has(df.id)) {
              await admin.from("drive_files").insert({
                project_folder_id: targetFolderId,
                drive_file_id: df.id,
                drive_folder_id: driveFolderId,
                file_name: df.name,
                mime_type: df.mimeType || "application/octet-stream",
                file_size: parseInt(df.size || "0", 10),
                created_by: user!.id,
              });
              stats.files_added++;
              console.log(`[REVERSE_SYNC] Added file from Drive: "${df.name}" -> folder ${targetFolderId}`);
            } else {
              console.log(`[REVERSE_SYNC] File already synced (skip): "${df.name}"`);
            }
          }
        } else if (!targetFolderId && driveFiles.length > 0) {
          console.log(`[REVERSE_SYNC] Skipping ${driveFiles.length} file(s) in Drive folder ${driveFolderId} — no matching DB folder`);
        }

        // --- FILES: Remove from DB if deleted in Drive (runs even for empty Drive folders) ---
        if (targetFolderId) {
          const { data: existingFilesForCleanup } = await admin
            .from("drive_files")
            .select("id, drive_file_id")
            .eq("project_folder_id", targetFolderId)
            .eq("drive_folder_id", driveFolderId);

          const driveFileIds = new Set(driveFiles.map(f => f.id));
          for (const ef of (existingFilesForCleanup || [])) {
            if (!driveFileIds.has(ef.drive_file_id)) {
              await admin.from("drive_files").delete().eq("id", ef.id);
              stats.files_removed++;
              console.log(`[REVERSE_SYNC] Removed file (deleted from Drive): ${ef.drive_file_id}`);
            }
          }
        }
      }

      // Start reverse sync from the project root folder
      await reverseSyncFolder(projectDriveFolderId, null);

      console.log(`[REVERSE_SYNC] Complete: +${stats.folders_added}/-${stats.folders_removed} folders, +${stats.files_added}/-${stats.files_removed} files`);

      return new Response(
        JSON.stringify({ message: "Sincronización inversa completada", ...stats }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "debug_list_folder") {
      const folderId = body.folder_id;
      const fileId = body.file_id;
      const accessToken = await getAccessToken();

      const results: Record<string, unknown> = {};

      // Direct file access check
      if (fileId) {
        const urlFile = `https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true&fields=id,name,parents,mimeType,size,driveId,capabilities,owners,sharingUser,shared`;
        const rFile = await fetch(urlFile, { headers: { Authorization: `Bearer ${accessToken}` } });
        const dFile = await rFile.json();
        results.file_direct_access = { status: rFile.status, data: dFile };
      }

      if (folderId) {
        const q = `'${folderId}' in parents and trashed=false`;
        const url1 = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=incompleteSearch,files(id,name,mimeType,size,parents)&pageSize=100`;
        const r1 = await fetch(url1, { headers: { Authorization: `Bearer ${accessToken}` } });
        results.children_unscoped = { status: r1.status, data: await r1.json() };

        const url4 = `https://www.googleapis.com/drive/v3/files/${folderId}?supportsAllDrives=true&fields=id,name,parents,mimeType,capabilities,driveId`;
        const r4 = await fetch(url4, { headers: { Authorization: `Bearer ${accessToken}` } });
        results.folder_info = await r4.json();
      }

      // Global name search
      const q3 = `name contains 'CSM' and trashed=false`;
      const url3 = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q3)}&supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=allDrives&fields=incompleteSearch,files(id,name,mimeType,size,parents,driveId)&pageSize=100`;
      const r3 = await fetch(url3, { headers: { Authorization: `Bearer ${accessToken}` } });
      results.global_csm_search = { status: r3.status, data: await r3.json() };

      return new Response(JSON.stringify(results, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "deduplicate") {
      console.log("[DEDUP] Starting deduplication of project folders in Drive");
      const accessToken = await getAccessToken();
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const admin = createClient(supabaseUrl, serviceRoleKey);

      // Find AMC Repositorio root
      const amcQuery = `name='AMC Repositorio' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
      const amcResp = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(amcQuery)}&supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=allDrives&fields=files(id,name)`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const amcData = await amcResp.json();
      if (!amcData.files?.length) {
        return new Response(JSON.stringify({ message: "No AMC Repositorio found", trashed: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const amcRootId = amcData.files[0].id;

      // List all children of AMC Repositorio
      let allChildren: Array<{ id: string; name: string; createdTime: string }> = [];
      let pageToken: string | undefined;
      do {
        const q = `'${amcRootId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=allDrives&fields=nextPageToken,files(id,name,createdTime)&orderBy=createdTime&pageSize=200${pageToken ? `&pageToken=${pageToken}` : ""}`;
        const resp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
        const data = await resp.json();
        if (data.files) allChildren.push(...data.files);
        pageToken = data.nextPageToken;
      } while (pageToken);

      console.log(`[DEDUP] Found ${allChildren.length} project folders under AMC Repositorio`);

      // Group by name
      const groups = new Map<string, typeof allChildren>();
      for (const child of allChildren) {
        const key = child.name.trim().toLowerCase();
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(child);
      }

      let trashed = 0;
      const details: string[] = [];

      for (const [name, folders] of groups.entries()) {
        if (folders.length <= 1) continue;

        // Sort by createdTime ascending — keep the oldest
        folders.sort((a, b) => a.createdTime.localeCompare(b.createdTime));
        const keeper = folders[0];
        const duplicates = folders.slice(1);

        console.log(`[DEDUP] "${name}": keeping ${keeper.id}, trashing ${duplicates.length} duplicate(s)`);

        for (const dup of duplicates) {
          // Check if dup folder has any contents
          const contentsResp = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`'${dup.id}' in parents and trashed=false`)}&supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=allDrives&fields=files(id)&pageSize=1`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          const contentsData = await contentsResp.json();
          const hasContents = (contentsData.files?.length || 0) > 0;

          if (hasContents) {
            console.log(`[DEDUP] Skipping "${dup.name}" (${dup.id}) — has contents, needs manual review`);
            details.push(`Skipped "${dup.name}" (${dup.id}) — has contents`);
            continue;
          }

          // Trash the empty duplicate
          const trashResp = await fetch(
            `https://www.googleapis.com/drive/v3/files/${dup.id}?supportsAllDrives=true`,
            {
              method: "PATCH",
              headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
              body: JSON.stringify({ trashed: true }),
            }
          );
          if (trashResp.ok) {
            trashed++;
            details.push(`Trashed "${dup.name}" (${dup.id})`);
            console.log(`[DEDUP] Trashed duplicate: "${dup.name}" (${dup.id})`);

            // Update any DB records pointing to this duplicate to point to keeper
            await admin
              .from("project_folders")
              .update({ drive_folder_id: keeper.id })
              .eq("drive_folder_id", dup.id);
          } else {
            console.log(`[DEDUP] Failed to trash "${dup.name}" (${dup.id}): ${trashResp.status}`);
          }
        }
      }

      console.log(`[DEDUP] Complete: ${trashed} duplicate(s) trashed`);
      return new Response(
        JSON.stringify({ message: `Deduplicación completada: ${trashed} duplicado(s) eliminado(s)`, trashed, details }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "deduplicate_files") {
      console.log("[DEDUP_FILES] Scheduling deduplication of files in Drive (background)");
      const accessToken = await getAccessToken();
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const admin = createClient(supabaseUrl, serviceRoleKey);

      const { data: folders } = await admin
        .from("project_folders")
        .select("id, drive_folder_id")
        .not("drive_folder_id", "is", null);

      const folderIds = (folders || [])
        .map((f: any) => f.drive_folder_id as string)
        .filter(Boolean);

      const task = (async () => {
        let filesTrashed = 0;
        const CONCURRENCY = 8;

        const processFolder = async (driveFolderId: string) => {
          try {
            const files = await listFilesInFolder(accessToken, driveFolderId);
            if (files.length === 0) return;

            const groups = new Map<string, typeof files>();
            for (const f of files) {
              const key = f.name.trim().toLowerCase();
              if (!groups.has(key)) groups.set(key, []);
              groups.get(key)!.push(f);
            }

            for (const [name, group] of groups.entries()) {
              if (group.length <= 1) continue;
              group.sort((a, b) => b.createdTime.localeCompare(a.createdTime));
              const duplicates = group.slice(1);
              console.log(`[DEDUP_FILES] "${name}" in ${driveFolderId}: trashing ${duplicates.length}`);

              await Promise.all(duplicates.map(async (dup) => {
                const trashResp = await fetch(
                  `https://www.googleapis.com/drive/v3/files/${dup.id}?supportsAllDrives=true`,
                  {
                    method: "PATCH",
                    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
                    body: JSON.stringify({ trashed: true }),
                  }
                );
                if (trashResp.ok) {
                  filesTrashed++;
                  await admin.from("drive_files").delete().eq("drive_file_id", dup.id);
                } else {
                  console.log(`[DEDUP_FILES] Failed ${dup.id}: ${trashResp.status}`);
                }
                await trashResp.text().catch(() => {});
              }));
            }
          } catch (e) {
            console.log(`[DEDUP_FILES] Folder ${driveFolderId} error:`, (e as Error).message);
          }
        };

        for (let i = 0; i < folderIds.length; i += CONCURRENCY) {
          const batch = folderIds.slice(i, i + CONCURRENCY);
          await Promise.all(batch.map(processFolder));
        }

        console.log(`[DEDUP_FILES] Background complete: ${filesTrashed} duplicate file(s) trashed across ${folderIds.length} folders`);
      })();

      // Fire-and-forget; keep the runtime alive until it finishes.
      // @ts-ignore - EdgeRuntime is available in Supabase edge runtime
      if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
        // @ts-ignore
        EdgeRuntime.waitUntil(task);
      }

      return new Response(
        JSON.stringify({
          message: `Deduplicación de archivos iniciada en segundo plano para ${folderIds.length} carpeta(s). Revisa los logs para ver el progreso.`,
          trashed: 0,
          details: [],
          background: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error("Invalid action");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[FOLDER_SYNC] error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: message === "NO_REFRESH_TOKEN" ? 400 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
