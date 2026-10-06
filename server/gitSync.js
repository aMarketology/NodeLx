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
     * @param {object} site { id, repo, owner?, repoName?, branch?, _pat? }
   * @returns {string}
   */
  resolveToken(site = {}) {
      if (site._pat) return site._pat; // one-off token from onboarding verify
      const siteToken = site.id ? getToken(site.id) : null;
      return siteToken || this.token;
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
      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      return { content, sha: data.sha };
    }

    /**
     * Create or update a single file, committing it to the target branch.
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

    const existingSha = await this.getFileSha(client, owner, repo, branch, path);
    const { data } = await client.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message,
      content: Buffer.from(content, 'utf-8').toString('base64'),
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