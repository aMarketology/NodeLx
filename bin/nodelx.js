#!/usr/bin/env node

const NodeLxServer = require('../server');

const HELP = `
NodeLx 2.0 — headless content backend

Usage:
  nodelx [options]                    Start the NodeLx server
  nodelx --help                       Show this message

Options:
  --port <n>            Port for the NodeLx server (default: 9000, or $PORT)
`;

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') args.help = true;
    else if (a === '--port' && argv[i + 1]) args.port = parseInt(argv[++i], 10);
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

  const nodelx = new NodeLxServer({ port: args.port || process.env.PORT || 9000 });
  await nodelx.initialize();
  nodelx.start();

  const shutdown = async (signal) => {
    console.log(`\n[NodeLx] ${signal} received, shutting down...`);
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