/**
 * mediaStore.js
 *
 * All Supabase storage operations. Each client site gets its OWN isolated
 * bucket, named media-<siteId> (e.g. media-williamb-construction).
 *
 * Folder layout inside a client's bucket:
 *   {folder}/{filename}
 *   e.g. uploads/front-exterior.jpg  or  videos/walkthrough.mp4
 *
 * Reads  → public CDN (no auth header needed)
 * Writes → service-role key (this server only)
 */

const { getSupabaseClient } = require('./supabase');

// Small images are committed to the client repo (via PAT); large images and
// videos are stored here in Supabase. Allow both image and video types.
const MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml',
  'video/mp4', 'video/webm', 'video/quicktime',
];

/**
 * Per-client bucket name. Sanitised siteId → media-<siteId>.
 */
const bucketName = (siteId) => `media-${siteId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

/**
 * Ensure a client's bucket exists and is public.
 * Called lazily on every media request (and at startup for registered sites)
 * so a fresh Supabase project needs no manual bucket setup.
 *
 * @param {string} siteId  e.g. "williamb-construction"
 * @returns {{ created: boolean, ok: boolean, error?: string }}
 */
async function ensureMediaBucket(siteId) {
  const supabase = getSupabaseClient();
  const name = bucketName(siteId);

  const { data: buckets, error: listErr } = await supabase.storage.listBuckets();
  if (listErr) return { ok: false, error: listErr.message };

  const exists = (buckets || []).some((b) => b.name === name);
  if (exists) {
    await supabase.storage.updateBucket(name, {
      public: true,
      allowedMimeTypes: MIME_TYPES,
    }).catch(() => {});
    return { created: false, ok: true };
  }

  const { error: createErr } = await supabase.storage.createBucket(name, {
    public: true,
    fileSizeLimit: '50MB',
    allowedMimeTypes: MIME_TYPES,
  });
  if (createErr) return { ok: false, error: createErr.message };
  return { created: true, ok: true };
}

/**
 * List all media files in a client's bucket (one folder deep).
 * Returns an array of: { name, folder, path, url, size, contentType }
 *
 * @param {string} siteId  e.g. "williamb-construction"
 */
async function listSiteMedia(siteId) {
  const supabase = getSupabaseClient();
  const bucket = bucketName(siteId);
  await ensureMediaBucket(siteId);

  // List top-level items (could be files or sub-folders)
  const { data: topLevel, error: topErr } = await supabase.storage
    .from(bucket)
    .list('', { limit: 200, sortBy: { column: 'name', order: 'asc' } });

  if (topErr) throw new Error('[MediaStore] list failed: ' + topErr.message);

  const media = [];

  for (const item of topLevel || []) {
    const isFile = Boolean(item.metadata);

    if (isFile) {
      // Root-level file (no sub-folder)
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(item.name);
      media.push({
        name:        item.name,
        folder:      null,
        path:        item.name,
        url:         urlData.publicUrl,
        size:        item.metadata?.size,
        contentType: item.metadata?.mimetype,
      });
    } else {
      // Sub-folder — list its contents
      const folderPath = item.name;
      const { data: files, error: fErr } = await supabase.storage
        .from(bucket)
        .list(folderPath, { limit: 200, sortBy: { column: 'name', order: 'asc' } });

      if (fErr) {
        console.warn('[MediaStore] Could not list folder', folderPath, ':', fErr.message);
        continue;
      }

      for (const file of files || []) {
        if (!file.metadata) continue; // skip nested sub-folders

        const storagePath = `${folderPath}/${file.name}`;
        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(storagePath);
        media.push({
          name:        file.name,
          folder:      item.name,
          path:        storagePath,
          url:         urlData.publicUrl,
          size:        file.metadata.size,
          contentType: file.metadata.mimetype,
        });
      }
    }
  }

  return media;
}

/**
 * Upload media to the client's Supabase bucket.
 * Overwrites if a file at the same path already exists.
 *
 * @param {string} siteId      e.g. "williamb-construction"
 * @param {string} folder      e.g. "uploads" | "videos"
 * @param {string} filename    e.g. "new-photo.jpg"
 * @param {Buffer} buffer      raw bytes
 * @param {string} contentType e.g. "image/jpeg" | "video/mp4"
 * @returns {{ path: string, url: string }}
 */
async function uploadMedia(siteId, folder, filename, buffer, contentType) {
  const supabase    = getSupabaseClient();
  const bucket      = bucketName(siteId);
  await ensureMediaBucket(siteId);

  const storagePath = folder ? `${folder}/${filename}` : filename;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(storagePath, buffer, { contentType, upsert: true });

  if (error) throw new Error('[MediaStore] upload failed: ' + error.message);

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(storagePath);
  return { path: storagePath, url: urlData.publicUrl };
}

/**
 * Delete media from the client's Supabase bucket.
 *
 * @param {string} siteId       e.g. "williamb-construction"
 * @param {string} storagePath  path within the bucket, e.g. "uploads/file.jpg"
 */
async function deleteMedia(siteId, storagePath) {
  const supabase = getSupabaseClient();
  const bucket   = bucketName(siteId);
  await ensureMediaBucket(siteId);

  const { error } = await supabase.storage.from(bucket).remove([storagePath]);
  if (error) throw new Error('[MediaStore] delete failed: ' + error.message);
  return { ok: true };
}

module.exports = { bucketName, listSiteMedia, uploadMedia, deleteMedia, ensureMediaBucket };