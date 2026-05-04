# Nodelux | ObjectWire's Real-Time CMS Architecture & Upgrade Plan

> **What this is.** A single reference for how ObjectWire's Supabase-backed real-time CMS works today, how the same pattern generalizes from articles to every other piece of the site (heroes, nav, themes, media, hubs), and the staged upgrade plan to make publishing faster, safer, and more SEO-aware.

---

## Part 1 | How the Real-Time CMS Works Today

### 1.1 The Read Path (server-side, every request)

```
User hits /clothing/new-balance/energy-arc-fuelcell-supercomp
        ↓
Next.js renders app/.../page.tsx (export const dynamic = 'force-dynamic')
        ↓
page.tsx returns <NewsArticleDB slug="clothing-new-balance-..." />
        ↓
NewsArticleDB (server component) calls Supabase:
   SELECT * FROM articles WHERE slug = $1
        ↓
Renders the row's title, subtitle, content_html, thumbnail, tags
        ↓
SEOWrapper reads content_registry → injects JSON-LD
        ↓
HTML returned to browser
```

Three things make it real-time:

1. **`dynamic = 'force-dynamic'`** on every page — no static cache, always fetches Supabase on request.
2. **`createClient` from `@/lib/supabase/server`** — server-only Supabase client using the service role key.
3. **The Supabase row IS the source of truth.** The `page.tsx` file is just a 10-line stub pointing at a slug.

### 1.2 The Write Path (publish)

```
You write app/.../page.tsx with full <NewsArticle>...</NewsArticle> JSX
        ↓
npm run wiki:publish -- --file app/.../page.tsx
        ↓
scripts/wiki-publish.ts:
  - regex-parses JSX into column values
  - upserts into articles / jack_articles / article_pages /
    creator_articles / alysa_articles
  - appends to lib/content-registry.ts AND content_registry table
  - rewrites the .tsx file to a stub: <NewsArticleDB slug="..." />
        ↓
Next request to that URL fetches the fresh row
```

That is the whole loop. **The page file becomes a router; the database becomes the CMS.**

### 1.3 Component → Table Routing

| Component | Table | Use For |
|---|---|---|
| `NewsArticleDB` | `articles` | News, breaking, gaming, tech, features, analysis |
| `JackArticleDB` | `jack_articles` | Research reports, premium long-form |
| `ArticlePageDB` | `article_pages` | Profiles, wiki-style, evergreen reference |
| `CreatorArticleDB` | `creator_articles` | Influencer / creator profiles |
| `AlysaArticleDB` | `alysa_articles` | Athlete profiles (Olympics legacy) |

### 1.4 What Makes This a Real CMS

- **5 specialized tables** for different article shapes with hand-tuned column layouts per type
- **Content registry** as a second source of truth feeding sitemap + JSON-LD + related-articles
- **Build-time guards** ([scripts/validate-canonicals.ts](../scripts/validate-canonicals.ts), [scripts/validate-public.ts](../scripts/validate-public.ts), [scripts/audit-internal-links.ts](../scripts/audit-internal-links.ts)) catch SEO regressions
- **Zero client-side Supabase calls** in articles — no auth leaks, no flash of unloaded content

### 1.5 What's Missing for True Real-Time

- No `revalidatePath` or webhook → edits to Supabase don't push live until a page is re-requested AND any upstream caches expire
- No Supabase Realtime subscriptions → no UI updates when rows change
- No CDN purge integration
- No IndexNow / Google Indexing API auto-submission on publish
- No quality gate that blocks weak SEO before it ships
- No in-app row editor (everything is CLI today)

---

## Part 2 | Generalizing the Pattern Beyond Articles

The pattern is generalizable: **anything currently hardcoded in a `.tsx` file becomes a Supabase row referenced by a stub component.**

### 2.1 Targets, Ranked by Leverage

| # | Target | Today | Real-Time Version |
|---|---|---|---|
| 1 | **Hub pages** (e.g. `/video-games/gta-6`) | Hand-edited `.tsx` with hardcoded subarticle cards | `hubs` table; sub-article cards auto-populated by `articles WHERE category=... AND tags @> ...`. **Highest SEO unlock — kills cluster rot.** |
| 2 | **Hero images, banners, promo strips** | Hardcoded in homepage / category pages | `site_blocks` table with `<SiteBlockDB blockKey="homepage-hero" />` |
| 3 | **Featured-article slots** (homepage rail, breaking strip, sidebar trending) | Manually curated arrays in [app/page.tsx](../app/page.tsx) | `featured_slots` table with `expires_at` |
| 4 | **Navigation menu, footer links** | Hardcoded arrays in [components/nav/](../components/nav/) | `nav_items` table; `<NavDB section="header" />` |
| 5 | **Author bios, byline cards** | Each [/authors/[slug]](../app/authors/) page hardcoded | `authors` table; `<AuthorCardDB slug="jack-sterling" />` |
| 6 | **Image library** | Each article hardcodes Unsplash URLs; no central library | `media_assets` table on top of the existing Supabase Storage `articles` bucket |
| 7 | **Color theme, typography, design tokens** | [tailwind.config.ts](../tailwind.config.ts) — requires rebuild | `design_tokens` table; layout emits a `:root { --color-accent: ... }` style tag |
| 8 | **Newsletter content, email templates, RSS body** | [components/newsletter/](../components/newsletter/) hardcoded | `newsletter_blocks` table |

### 2.2 The Unifying Abstraction

Every one of the above is the same pattern:

```tsx
// Server component pattern (one file per content type)
export async function XxxDB({ key }: { key: string }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('table')
    .select('*')
    .eq('key', key)
    .single();
  if (!data) return null;
  return <XxxRenderer {...data} />;
}
```

Combined with `wiki:publish`-style CLI tools that upsert from local files, plus the planned revalidate webhook, you get a **headless CMS for the entire site** where:

- Writers edit articles via terminal (or future editor)
- Designers edit hero blocks, themes, nav from the same CLI
- All changes go live in seconds via the revalidate route
- Git history still tracks every change because each upsert comes from a file commit (or the CLI logs it to `publish_log`)

---

## Part 3 | The Upgrade Plan

### Step 0 | Generic site-block primitive (proof of concept)
Build the generic `site_blocks` table + `<SiteBlockDB>` component. Migrate the **homepage hero** and the **global nav** as the first two consumers. Everything after this re-uses the same wiring.

**Verify:** edit homepage hero copy in Supabase via CLI, see it live within 5 seconds without redeploy.

### Step 1 | Real-time publish (kill the redeploy)
- New `app/api/revalidate/route.ts` accepting `{ paths, tags }` + `REVALIDATION_SECRET` header.
- `wiki:publish` calls it after every successful upsert with the article path **plus** the cluster hub, the category index, `/sitemap.xml`, `/news-sitemap.xml`.
- New `scripts/wiki-edit.ts` (CLI-only edit tool with `--pull` / `--push` / `--field` modes) calls the same endpoint.
- Configure Supabase Database Webhooks on UPDATE for all 5 article tables → POST to `/api/revalidate` so direct DB edits also propagate.

**Verify:** publish an article, hit the URL in 5s, see content live without a Railway redeploy.

### Step 2 | Auto-submit to Google + Bing on publish
- **IndexNow** (Bing, Yandex, Naver) — single POST, key file at `/public/<key>.txt`.
- **Google Indexing API** (`URL_UPDATED`) — service-account JWT, requires Search Console verification.
- Re-ping Google's news sitemap on publish via `https://www.google.com/ping?sitemap=...`.
- Failures log to a new `publish_log` table for retry.

**Verify:** publish, check Bing Webmaster Tools "URL Submission" + Google Search Console "URL Inspection" within 30 minutes.

### Step 3 | Quality gate inside `wiki:publish`
Add `lib/cms/seo-gate.ts` invoked before upsert. Hard fails on:
- `meta.title` > 60 chars or < 30 chars
- `meta.description` outside 130–155 chars
- No `openGraph.images[0]` (required for Top Stories)
- `imageWidth` < 1200 or `imageHeight` < 675
- Internal links below per-type minimum (NewsArticle 4, JackArticle 5, etc.) — reuse [scripts/audit-internal-links.ts](../scripts/audit-internal-links.ts)
- No hub backlink in first 3 paragraphs (regex against `lib/cms/pillars.ts`)
- Em dash, en dash, `&` in headings (OStandard guard)

`--force` flag exists for emergencies but logs a warning to `publish_log`.

**Verify:** publish without `openGraph.images` → blocked with actionable error.

### Step 4 | Auto-fill the SEO gaps writers always miss
Inside `wiki:publish`, when the source file is missing a field, **generate it** rather than fail:
- **OG image missing** → call `/api/og/[slug]` (using `next/og` `ImageResponse`) to render branded 1200×675 PNG, upload to Storage, set `og_image_url`.
- **Internal links below minimum** → query `content_registry` for same-category entries, insert `<aside>` "Related coverage" block above first H2.
- **Tags empty** → extract proper-noun candidates from H2s + bold terms.
- **`meta_description` missing** → generate from first paragraph trimmed to 145 chars.

**Verify:** publish a stub with only title + content_html, see populated OG image, tags, description, related-links block on live page.

### Step 5 | Cluster intelligence (highest-leverage SEO win)
Internal linking is the biggest underused lever. Make it automatic:
- Every publish triggers recompute of its cluster's interlink graph → store in `cluster_links` table.
- `RelatedArticles` component reads from this table instead of computing live.
- New `scripts/cluster-fix.ts` walks every article in a pillar (e.g. GTA 6) and:
  - Inserts hub backlink if missing
  - Inserts 2 cluster-sibling links if below minimum
  - Adds the new article to the hub's "Latest" grid
- Run nightly via Railway cron + on every publish.

**Verify:** publish a new GTA 6 sub-article, watch the GTA 6 hub auto-update with the new card and reciprocal links appear in two siblings within 60s.

### Step 6 | Schedule + drip-publish
- Add `scheduled_publish_at TIMESTAMPTZ` column to all 5 tables.
- `wiki:publish --schedule "2026-04-30T14:00:00Z"` writes the row with `status='draft'` + timestamp.
- Railway cron every minute flips eligible drafts to `published`, then triggers Step 1's revalidation + Step 2's IndexNow ping.

**Verify:** schedule 2 minutes out, walk away, confirm live + appearing in Bing's submitted URLs by the 5-minute mark.

### Step 7 | Writer-side: auto-prompt with what's already ranking
`scripts/wiki-suggest.ts <topic>`:
- Queries Google Search Console API for queries you currently rank #11–30 for (the "almost-ranking" zone)
- Cross-references `content_registry` to find pillars with thin coverage
- Outputs ranked "write this next" suggestions with target keyword, hub URL, competing URLs
- `--draft` flag generates a starter `page.tsx` with metadata, hub backlink, 3 H2 stubs filled in

**Verify:** `wiki-suggest.ts gta-6` returns 10 missing sub-topics with current rank + target hub.

---

## Part 4 | Relevant Files

### Existing (read / extend)
- [scripts/wiki-publish.ts](../scripts/wiki-publish.ts) — main pipeline, gets quality gate + auto-fill + IndexNow + revalidate calls
- [scripts/audit-internal-links.ts](../scripts/audit-internal-links.ts) — refactor to export pure functions for the gate
- [scripts/audit-metadata.ts](../scripts/audit-metadata.ts) — same refactor
- [components/articles/RelatedArticles.tsx](../components/articles/RelatedArticles.tsx) — switch to `cluster_links` table
- [components/SEOWrapper.tsx](../components/SEOWrapper.tsx) — consume new SEO columns once added
- [app/news-sitemap.xml/route.ts](../app/news-sitemap.xml/route.ts) — already dynamic, needs IndexNow ping caller
- [components/nav/](../components/nav/) — Step 0 migration target
- [app/page.tsx](../app/page.tsx) — Step 0 migration target (homepage hero)

### New
- `app/api/revalidate/route.ts` — Step 1
- `app/api/og/[slug]/route.tsx` — Step 4
- `scripts/wiki-edit.ts` — Step 1 (CLI edit tool, mirrors `wiki:publish`)
- `scripts/cluster-fix.ts` — Step 5
- `scripts/wiki-suggest.ts` — Step 7
- `lib/cms/seo-gate.ts` — Step 3
- `lib/cms/pillars.ts` — pillar registry shared by all SEO tools
- `lib/cms/indexnow.ts` — Step 2
- `lib/cms/google-indexing.ts` — Step 2
- `lib/cms/ostandard-guard.ts` — em/en dash + `&` in headings (shared guard)

### New migrations
- `add_site_blocks.sql` — Step 0
- `add_cluster_links.sql` — Step 5
- `add_publish_log.sql` — Step 2
- `add_scheduled_publish.sql` — Step 6
- `add_seo_columns_2026_05.sql` — `meta_title`, `meta_description`, `og_image_url`, `meta_keywords` on `articles` / `jack_articles` / `article_pages`

### New static
- `/public/<indexnow-key>.txt` — Step 2

---

## Part 5 | Decisions

- **Stay terminal-first.** Every upgrade is a script or build-time check, not a UI. A future admin portal can be layered on top later.
- **`wiki:publish` is the single quality gate** — no article reaches Supabase without passing.
- **Revalidation is decoupled via a webhook endpoint** so direct DB edits, scheduled publishes, and CLI publishes all use the same path.
- **Auto-fill > fail.** Writer should be able to ship with title + content + thumbnail and have everything else generated.
- **Keep `wiki:publish` as canonical file-first workflow.** `wiki-edit.ts` (the future edit tool) writes the same columns; both are peers.
- **Service-role key only** (server-side / CLI). Anon key gets zero write access once RLS is tightened.
- **Service-role key never touches the browser.**

---

## Part 6 | Further Considerations

1. **Auto-related-link insertion** — Option A (insert visibly as `<aside>`) / Option B (hidden `data-auto-link` attr only) / Option C (don't auto-insert, just block publish below minimum). *Recommend A: bonus engagement + SEO.*
2. **Google Indexing API** — only officially supports JobPosting + BroadcastEvent schemas, but works in practice for news. *Recommend: use it but rely on IndexNow + sitemap ping as fallback.*
3. **Cluster recompute** — Option A (every publish + nightly cron) / Option B (nightly only). *Recommend A so new articles immediately benefit.*
4. **Auth provider for any future admin portal** — Option A (magic-link email) / Option B (GitHub OAuth) / Option C (both). *Recommend C: magic-link for editors, OAuth for engineers.*
5. **Site-block scope (Step 0)** — start with homepage hero + nav only, or also include footer + theme tokens? *Recommend the first two; expand once revalidate proves stable.*

---

## Part 7 | Recommended Build Order

1. **Step 1 + Step 2 together** | `app/api/revalidate/route.ts` + IndexNow ping. Together they unlock "publish and see it in Google within minutes." Pure additive — no risk to existing pipeline.
2. **Step 3** | SEO gate. Stops bad articles before they ship.
3. **Step 4** | Auto-fill. Now the writer can move fast.
4. **Step 0** | Generic `site_blocks` proof. Migrate homepage hero.
5. **Step 5** | Cluster intelligence. The compounding SEO win.
6. **Step 6** | Scheduling.
7. **Step 7** | Writer suggestions.

Each step is independently shippable. Stop anywhere it feels like enough.
