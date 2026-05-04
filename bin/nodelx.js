#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const NodeLxServer = require('../server');
const DevServer = require('../server/devServer');

const HELP = `
NodeLx — visual editor for Node.js websites

Usage:
  nodelx start [options]              Spawn dev server + start NodeLx editor
  nodelx attach [options]             Start NodeLx but don't spawn (site already running)
  nodelx --help                       Show this message

Options:
  --project <path>      Path to the target project (default: cwd)
  --port <n>            Port for the NodeLx editor (default: 3001)
  --site-port <n>       Port the dev server is on (only with 'attach', or override detection)
  --script <name>       npm script to run (default: auto-detect dev/start/serve)
  --no-spawn            Same as 'attach' — don't run npm script

Examples:
  cd my-nextjs-site && nodelx start
  nodelx start --project ../my-vite-app
  nodelx attach --site-port 3000
`;

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') args.help = true;
    else if (a === '--no-spawn') args.noSpawn = true;
    else if (a === '--project' && argv[i + 1]) args.project = argv[++i];
    else if (a === '--port' && argv[i + 1]) args.port = parseInt(argv[++i], 10);
    else if (a === '--site-port' && argv[i + 1]) args.sitePort = parseInt(argv[++i], 10);
    else if (a === '--script' && argv[i + 1]) args.script = argv[++i];
    else if (!a.startsWith('--')) args._.push(a);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(HELP);
    process.exit(0);
  }

  const command = args._[0] || 'start';
  if (!['start', 'attach'].includes(command)) {
    console.error(`Unknown command: ${command}\n${HELP}`);
    process.exit(1);
  }

  const projectPath = path.resolve(args.project || process.cwd());

  if (!fs.existsSync(path.join(projectPath, 'package.json'))) {
    console.error(`No package.json found at ${projectPath}`);
    console.error(`Run nodelx from inside a Node.js project, or pass --project.`);
    process.exit(1);
  }

  const shouldSpawn = command === 'start' && !args.noSpawn;
  let devServer = null;
  let sitePort = args.sitePort || 3000;

  if (shouldSpawn) {
    devServer = new DevServer(projectPath, { script: args.script });
    try {
      sitePort = await devServer.start();
    } catch (err) {
      console.error(`[NodeLx] Failed to spawn dev server: ${err.message}`);
      process.exit(1);
    }
  } else {
    console.log(`[NodeLx] Attach mode — assuming dev server on port ${sitePort}`);
  }

  const nodelx = new NodeLxServer({
    port: args.port || 3001,
    sitePort,
    projectPath
  });

  await nodelx.initialize();
  nodelx.start();

  const shutdown = async (signal) => {
    console.log(`\n[NodeLx] ${signal} received, shutting down...`);
    if (devServer) await devServer.stop();
    await nodelx.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[NodeLx] Startup failed:', err);
  process.exit(1);
});
