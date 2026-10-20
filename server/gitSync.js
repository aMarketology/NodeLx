const { Octokit } = require('@octokit/rest');
const { getToken } = require('./siteTokens');

/**
 * GitSync — pushes content files to any GitHub repository so a stateless
 * deployment (e.g. Vercel) can rebuild on every commit.
 *
 * The PAT never touches the React frontend. It lives either:
 *   - per-site, in content/.site-tokens.json (gitignored), collected during
 *     onboarding, OR
 *   - globally, in the server env as GITHUB_PAT.
 *
 * Every operation is scoped to an explicit { owner, repo, branch } so a single
 * NodeLx deployment can manage many client sites.
 */
class GitSync {
  constructor() {
    this.token = process.env.GITHUB_PAT || '';
    this.octokit = this.token ? new Octokit({ auth: this.token }) : null;
  }

  isConfigured() {
    return Boolean(this.token && this.octokit);
  }

  /**
   * Resolve the effective token for a site: per-site token wins, else env.
   * @param {object} site { id, repo, owner?, repoName?, branch?, _pat?, patEnvVar? }
   * @returns {string}
   */
  resolveToken(site = {}) {
      if (site._pat) return site._pat; // one-off token from onboarding verify
      const siteToken = site.id ? getToken(site.id) : null;
      if (siteToken) return siteToken;
      // Durable per-site token via env var (survives ephemeral hosts like Railway).
      // e.g. site.patEnvVar = "MODERN_PAT" → reads process.env.MODERN_PAT.
      if (site.patEnvVar && process.env[site.patEnvVar]) return process.env[site.patEnvVar];
      return this.token;
    }

  /**
   * Build an Octokit client for a specific site (per-site token aware).
   * @param {object} site
   * @returns {Octokit|null}
   */
  clientFor(site = {}) {
    const token = this.resolveToken(site);
    return token ? new Octokit({ auth: token }) : null;
  }

  /**
   * Resolve owner/repo/branch from a site object, falling back to env defaults.
   * @param {object} site { repo, owner?, repoName?, branch? }
   */
  resolveTarget(site = {}) {
    const fallbackRepo = process.env.GITHUB_OWNER && process.env.GITHUB_REPO
      ? `${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}`
      : '/';
    const [owner, repo] = (site.repo || fallbackRepo).split('/');
    return {
      owner: site.owner || owner || process.env.GITHUB_OWNER,
      repo: site.repoName || repo || process.env.GITHUB_REPO,
      branch: site.branch || process.env.GITHUB_BRANCH || 'main',
    };
  }

  /**
   * Verify the PAT can read a repo (used by onboarding connectivity check).
   * Uses the per-site token if provided, else the env token.
   * @param {object} site
   * @returns {Promise<{ok, fullName?, defaultBranch?, error?}>}
   */
  async verifyRepo(site = {}) {
    const client = this.clientFor(site);
    if (!client) {
      return { ok: false, error: 'No GitHub token configured for this site' };
    }
    const { owner, repo } = this.resolveTarget(site);
    try {
      const { data } = await client.repos.get({ owner, repo });
      return { ok: true, fullName: data.full_name, defaultBranch: data.default_branch };
    } catch (err) {
      return {
        ok: false,
        error: err.status === 404
          ? `Repository ${owner}/${repo} not found, or the token lacks access to it`
          : err.message,
      };
    }
  }

  /**
   * Get the SHA of an existing file, or null if it doesn't exist.
   */
  async getFileSha(client, owner, repo, branch, path) {
    try {
      const { data } = await client.repos.getContent({ owner, repo, path, ref: branch });
      return data.sha || null;
    } catch (err) {
      if (err.status === 404) return null;
      throw err;
    }
  }

  /**
     * Read a file's raw contents from the repo (base64-decoded).
       *
       * The Contents API omits `content` for files > 1 MB (returns empty string
       * with `encoding: "none"`). For those we fall back to the Git Data API
       * (`git.getBlob`) using the blob SHA returned by `getContent`.
       *
       * @param {object} site site object
       * @param {string} repoPath path inside the repo (e.g. "content/home.json")
       * @returns {Promise<{content: string, sha: string}>}
       */
      async readFile(site, repoPath) {
        const client = this.clientFor(site);
        if (!client) {
          throw new Error('No GitHub token configured for this site');
        }
        const { owner, repo, branch } = this.resolveTarget(site);
        const path = repoPath.replace(/^\/+/, '');
        const { data } = await client.repos.getContent({ owner, repo, path, ref: branch });

        let content;
        if (data.content) {
          content = Buffer.from(data.content, 'base64').toString('utf-8');
        } else if (data.sha) {
          // File exceeds the Contents API 1 MB limit — fetch the blob directly.
          const blob = await client.git.getBlob({ owner, repo, file_sha: data.sha });
          content = Buffer.from(blob.data.content, 'base64').toString('utf-8');
        } else {
          content = '';
        }
        return { content, sha: data.sha };
      }

    /**
     * Create or update a single file, committing it to the target branch.
     *
         * Files ≤ 1 MB use the Contents API (`createOrUpdateFileContents`). Larger
         * files (e.g. a big content/blog.json) exceed that API's limit, so we fall
         * back to the Git Data API: create a blob, build a new tree, commit it, and
         * fast-forward the branch ref.
         *
         * @param {object} site site object (repo/owner/repoName/branch)
         * @param {string} repoPath path inside the repo (e.g. "content/home.json")
         * @param {string} content raw file contents
         * @param {string} message commit message
         * @returns {Promise<{path, sha, commitUrl}>}
         */
        async commitFile(site, repoPath, content, message) {
        const client = this.clientFor(site);
        if (!client) {
          throw new Error('No GitHub token configured for this site');
        }

        const { owner, repo, branch } = this.resolveTarget(site);
        const path = repoPath.replace(/^\/+/, '');

        const bytes = Buffer.byteLength(content, 'utf-8');
        const base64 = Buffer.from(content, 'utf-8').toString('base64');

        // Contents API caps payloads at 1 MB — use the Git Data API beyond that.
        if (bytes > 1024 * 1024) {
          return this.commitLargeFile(client, owner, repo, branch, path, base64, message);
        }

        const existingSha = await this.getFileSha(client, owner, repo, branch, path);
        const { data } = await client.repos.createOrUpdateFileContents({
          owner,
          repo,
          path,
          message,
          content: base64,
          branch,
          ...(existingSha ? { sha: existingSha } : {}),
        });

        return {
          path,
          sha: data.commit?.sha || null,
          commitUrl: data.commit?.html_url || null,
        };
      }

      /**
       * Commit a file larger than 1 MB via the Git Data API (blob → tree → commit → ref).
       */
      async commitLargeFile(client, owner, repo, branch, path, base64, message) {
        // 1. Create the blob.
        const blob = await client.git.createBlob({ owner, repo, content: base64, encoding: 'base64' });

        // 2. Resolve the current branch head (and its tree).
        const ref = await client.git.getRef({ owner, repo, ref: `heads/${branch}` });
        const baseCommitSha = ref.data.object.sha;
        const baseCommit = await client.git.getCommit({ owner, repo, commit_sha: baseCommitSha });
        const baseTreeSha = baseCommit.data.tree.sha;

        // 3. Build a new tree that adds/updates the target path.
        const tree = await client.git.createTree({
          owner,
          repo,
          base_tree: baseTreeSha,
          tree: [{ path, mode: '100644', type: 'blob', sha: blob.data.sha }],
        });

        // 4. Create the commit on top of the current head.
        const commit = await client.git.createCommit({
          owner,
          repo,
          message,
          tree: tree.data.sha,
          parents: [baseCommitSha],
        });

        // 5. Fast-forward the branch ref to the new commit.
        await client.git.updateRef({
          owner,
          repo,
          ref: `heads/${branch}`,
          sha: commit.data.sha,
        });

        return {
          path,
          sha: commit.data.sha,
          commitUrl: commit.data.html_url || null,
        };
      }

  /**
   * Create or update a single BINARY file (e.g. an image in public/), committing
   * it to the target branch. Unlike commitFile (UTF-8 text), this base64-encodes
   * the raw bytes so images/videos are not corrupted.
   *
   * @param {object} site site object (repo/owner/repoName/branch)
   * @param {string} repoPath path inside the repo (e.g. "public/uploads/photo.jpg")
   * @param {Buffer} buffer raw file bytes
   * @param {string} message commit message
   * @returns {Promise<{path, sha, commitUrl}>}
   */
  async commitBinaryFile(site, repoPath, buffer, message) {
    const client = this.clientFor(site);
    if (!client) {
      throw new Error('No GitHub token configured for this site');
    }

    const { owner, repo, branch } = this.resolveTarget(site);
    const path = repoPath.replace(/^\/+/, '');

    const existingSha = await this.getFileSha(client, owner, repo, branch, path);
    const { data } = await client.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message,
      content: buffer.toString('base64'),
      branch,
      ...(existingSha ? { sha: existingSha } : {}),
    });

    return {
      path,
      sha: data.commit?.sha || null,
      commitUrl: data.commit?.html_url || null,
    };
  }
}

module.exports = GitSync;