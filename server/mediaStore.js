/**
 * mediaStore.js
 *
 * All Supabase storage operations for the shared "media" bucket.
 *
 * Folder layout in the bucket:
 *   media/{siteId}/{folder}/{filename}
 *   e.g. media/williamb-construction/uploads/front-exterior.jpg
 *
 * Reads  → public CDN (no auth header needed)
 * Writes → service-role key (this server only)
 */

const { getSupabaseClient } = require('./supabase');

const BUCKET = 'media';

/**
 * List all image files under media/{siteId}/ recursively (one folder deep).
 * Returns an array of: { name, folder, path, url, size, contentType }
 *
 * @param {string} siteId  e.g. "williamb-construction"
 */
async function listSiteMedia(siteId) {
  const supabase = getSupabaseClient();

  // List top-level items under siteId (could be files or sub-folders)
  const { data: topLevel, error: topErr } = await supabase.storage
    .from(BUCKET)
    .list(siteId, { limit: 100, sortBy: { column: 'name', order: 'asc' } });

  if (topErr) throw new Error('[MediaStore] list failed: ' + topErr.message);

  const images = [];

  for (const item of topLevel || []) {
    const isFile = Boolean(item.metadata);

    if (isFile) {
      // Root-level file (no sub-folder)
      const storagePath = `${siteId}/${item.name}`;
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
      images.push({
        name:        item.name,
        folder:      null,
        path:        storagePath,
        url:         urlData.publicUrl,
        size:        item.metadata.size,
        contentType: item.metadata.mimetype,
      });
    } else {
      // Sub-folder — list its contents
      const folderPath = `${siteId}/${item.name}`;
      const { data: files, error: fErr } = await supabase.storage
        .from(BUCKET)
        .list(folderPath, { limit: 200, sortBy: { column: 'name', order: 'asc' } });

      if (fErr) {
        console.warn('[MediaStore] Could not list folder', folderPath, ':', fErr.message);
        continue;
      }

      for (const file of files || []) {
        if (!file.metadata) continue; // skip nested sub-folders

        const storagePath = `${folderPath}/${file.name}`;
        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
        images.push({
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

  return images;
}

/**
 * Upload an image to Supabase storage.
 * Overwrites if a file at the same path already exists.
 *
 * @param {string} siteId      e.g. "williamb-construction"
 * @param {string} folder      e.g. "uploads"
 * @param {string} filename    e.g. "new-photo.jpg"
 * @param {Buffer} buffer      raw image bytes
 * @param {string} contentType e.g. "image/jpeg"
 * @returns {{ path: string, url: string }}
 */
async function uploadMedia(siteId, folder, filename, buffer, contentType) {
  const supabase    = getSupabaseClient();
  const storagePath = `${siteId}/${folder}/${filename}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType, upsert: true });

  if (error) throw new Error('[MediaStore] upload failed: ' + error.message);

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return { path: storagePath, url: urlData.publicUrl };
}

/**
 * Delete an image from Supabase storage.
 *
 * @param {string} storagePath  Full path within the bucket, e.g. "williamb-construction/uploads/file.jpg"
 */
async function deleteMedia(storagePath) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.storage.from(BUCKET).remove([storagePath]);
  if (error) throw new Error('[MediaStore] delete failed: ' + error.message);
  return { ok: true };
}

module.exports = { listSiteMedia, uploadMedia, deleteMedia };