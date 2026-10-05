const { Octokit } = require('@octokit/rest');

/**
 * GitSync — pushes content files to any GitHub repository so a stateless
 * deployment (e.g. Vercel) can rebuild on every commit.
 *
 * The PAT never touches the React frontend. It lives only in the server env
 * as GITHUB_PAT (a fine-grained token with "Contents: Read/write").
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
   * @param {object} site
   * @returns {Promise<{ok, fullName?, defaultBranch?, error?}>}
   */
  async verifyRepo(site = {}) {
    if (!this.isConfigured()) {
      return { ok: false, error: 'GITHUB_PAT is not configured on the server' };
    }
    const { owner, repo } = this.resolveTarget(site);
    try {
      const { data } = await this.octokit.repos.get({ owner, repo });
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
  async getFileSha(owner, repo, branch, path) {
    try {
      const { data } = await this.octokit.repos.getContent({ owner, repo, path, ref: branch });
      return data.sha || null;
    } catch (err) {
      if (err.status === 404) return null;
      throw err;
    }
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
    if (!this.isConfigured()) {
      throw new Error('GITHUB_PAT is not configured on the server');
    }

    const { owner, repo, branch } = this.resolveTarget(site);
    const path = repoPath.replace(/^\/+/, '');

    const existingSha = await this.getFileSha(owner, repo, branch, path);
    const { data } = await this.octokit.repos.createOrUpdateFileContents({
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