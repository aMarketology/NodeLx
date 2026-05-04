const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * DevServer — spawns and supervises the target project's dev server.
 * Detects the port from stdout, surfaces output to NodeLx, and cleans up
 * the child process on shutdown.
 */
class DevServer {
  constructor(projectPath, options = {}) {
    this.projectPath = path.resolve(projectPath);
    this.script = options.script || null;
    this.startTimeoutMs = options.startTimeoutMs || 30000;
    this.process = null;
    this.port = null;
    this.detected = false;
    this.onPortDetected = options.onPortDetected || (() => {});
    this.onLog = options.onLog || ((line) => process.stdout.write(`[site] ${line}`));
  }

  detectScript() {
    if (this.script) return this.script;

    const pkgPath = path.join(this.projectPath, 'package.json');
    if (!fs.existsSync(pkgPath)) {
      throw new Error(`No package.json found at ${this.projectPath}`);
    }

    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    const scripts = pkg.scripts || {};

    if (scripts.dev) return 'dev';
    if (scripts.start) return 'start';
    if (scripts.serve) return 'serve';

    throw new Error(
      `No "dev", "start", or "serve" script found in ${pkgPath}. ` +
      `Pass --script to override.`
    );
  }

  start() {
    return new Promise((resolve, reject) => {
      let script;
      try {
        script = this.detectScript();
      } catch (err) {
        return reject(err);
      }

      const isWindows = process.platform === 'win32';
      const npm = isWindows ? 'npm.cmd' : 'npm';

      console.log(`[NodeLx] Spawning: npm run ${script}`);
      console.log(`[NodeLx] Project:  ${this.projectPath}`);

      this.process = spawn(npm, ['run', script], {
        cwd: this.projectPath,
        env: { ...process.env, FORCE_COLOR: '1', BROWSER: 'none' },
        shell: isWindows
      });

      const portRegex = /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):(\d{2,5})/i;

      const handleOutput = (data) => {
        const text = data.toString();
        this.onLog(text);

        if (!this.detected) {
          const match = text.match(portRegex);
          if (match) {
            this.detected = true;
            this.port = parseInt(match[1], 10);
            console.log(`\n[NodeLx] Detected dev server on port ${this.port}\n`);
            this.onPortDetected(this.port);
            resolve(this.port);
          }
        }
      };

      this.process.stdout.on('data', handleOutput);
      this.process.stderr.on('data', handleOutput);

      this.process.on('exit', (code, signal) => {
        if (!this.detected) {
          reject(new Error(
            `Dev server exited before binding a port (code=${code}, signal=${signal})`
          ));
        }
      });

      this.process.on('error', (err) => {
        if (!this.detected) reject(err);
      });

      // Fallback: if we never see a port in stdout, give up after timeout.
      setTimeout(() => {
        if (!this.detected) {
          console.warn(
            `[NodeLx] Port not detected within ${this.startTimeoutMs}ms. ` +
            `Assuming default 3000. Pass --site-port to override.`
          );
          this.detected = true;
          this.port = 3000;
          this.onPortDetected(this.port);
          resolve(this.port);
        }
      }, this.startTimeoutMs);
    });
  }

  stop() {
    if (!this.process || this.process.killed) return Promise.resolve();

    return new Promise((resolve) => {
      const child = this.process;
      const finish = () => resolve();
      child.once('exit', finish);

      if (process.platform === 'win32') {
        // npm spawns a tree of processes (cmd → node → dev-server).
        // taskkill /T walks the tree.
        spawn('taskkill', ['/pid', child.pid, '/f', '/t'], { stdio: 'ignore' });
      } else {
        child.kill('SIGTERM');
        setTimeout(() => {
          if (!child.killed) child.kill('SIGKILL');
        }, 5000);
      }

      // Safety timeout in case the exit event never fires.
      setTimeout(finish, 8000);
    });
  }
}

module.exports = DevServer;
