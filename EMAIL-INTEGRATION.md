# NODELKX email campaigns: first integration

The client site's `/admin/email` owns the visual editor. NODELKX stores editable blocks and design settings privately in Supabase. Resend holds separate broadcast snapshots and delivery analytics. Saving a NODELKX draft never creates or sends a broadcast. A snapshot must be created explicitly; later edits do not change that snapshot.

## Setup

1. Apply `supabase/email-campaigns.sql` to the NODELKX Supabase project, using its SQL editor or your approved migration process. This creates a private table with row-level security and no public policies.
2. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` on the NODELKX server. Deploy/restart NODELKX after applying the migration and deploy its built admin. Register the client site in NODELKX.
3. Configure the same `NODELX_API_KEY` on NODELKX and the client site's server, plus `NODELX_URL` and `NODELX_SITE_ID` on the client site. Use HTTPS outside local development. These are server-only secrets. The current shared bridge key is trusted across all registered sites; do not expose it to browsers or distribute it to untrusted tenants.
4. On the site, visit `/admin/email`. Import the existing holiday newsletter once; subsequent edits and duplicates are ordinary NODELKX records. NODELKX's `/admin/email` lists site campaigns and links to the site's editor. These use separate login sessions.
5. To prepare a Resend draft, set the site's Resend key and segment, verify public HTTPS image URLs, save the editable draft, and explicitly choose **Create Resend draft**. Review the snapshot before sending.

The existing built-in holiday starter is imported only when requested; it is never automatically saved to NODELKX or Resend. Importing preserves the current code-backed starter, not previously unsaved browser edits. Existing HTML-only Resend broadcasts cannot be converted back into structured blocks. Revision checks reject conflicting saves instead of overwriting another editor. The report and snapshot are not yet linked to a NODELKX revision; each explicit snapshot creates a separate Resend broadcast. Avoid retrying an ambiguous snapshot request without checking Resend first.
