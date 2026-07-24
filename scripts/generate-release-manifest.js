const { mkdirSync, readFileSync, writeFileSync } = require('fs');
const { dirname, join, resolve } = require('path');
const root = process.cwd();
function argument(name, fallback = '') { const prefix = `--${name}=`; const found = process.argv.find(value => value.startsWith(prefix)); return found ? found.slice(prefix.length) : fallback; }
function main() {
  const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const target = argument('target', 'local');
  const output = resolve(argument('output', join(root, 'dist', 'assets', 'release-manifest.json')));
  const manifest = {
    schemaVersion: 1,
    app: 'Zentrid End User',
    workspace: 'end-user',
    version: String(packageJson.version),
    release: String(process.env.ZENTRID_RELEASE || packageJson.zentridRelease || 'v1.0'),
    channel: String(process.env.ZENTRID_RELEASE_CHANNEL || 'prototype'),
    environment: String(process.env.ZENTRID_ENVIRONMENT || 'local'),
    target,
    buildId: `end-user-${Date.now()}`,
    builtAt: new Date().toISOString()
  };
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Release manifest OK: ${manifest.release}`);
}
main();
