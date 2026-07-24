const { existsSync, readdirSync, readFileSync } = require('fs');
const { dirname, join, relative, resolve } = require('path');

const root = join(process.cwd(), 'dist');
const targetArg = process.argv.find(value => value.startsWith('--target='));
const target = targetArg ? targetArg.slice('--target='.length) : 'local';
const failures = [];

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

if (!existsSync(root)) failures.push('Missing dist directory.');
const files = walk(root);
for (const file of files.filter(file => file.endsWith('.html'))) {
  const html = readFileSync(file, 'utf8');
  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const ref = match[1];
    if (/^(?:https?:|#|data:)/.test(ref)) continue;
    const clean = ref.split(/[?#]/)[0];
    if (clean && !existsSync(resolve(dirname(file), clean))) failures.push(`${relative(root, file)} -> ${ref}`);
  }
}

const manifestPath = join(root, 'assets', 'release-manifest.json');
if (!existsSync(manifestPath)) {
  failures.push('Missing dist/assets/release-manifest.json.');
} else {
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    if (manifest.target !== target) failures.push(`Release manifest target must be ${target}, received ${manifest.target}.`);
  } catch (error) {
    failures.push(`Release manifest is invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const proxyPath = join(root, 'proxy-server.js');
if (target === 'vercel' && existsSync(proxyPath)) failures.push('Vercel dist must not contain proxy-server.js.');
if (target === 'local' && !existsSync(proxyPath)) failures.push('Local dist must contain proxy-server.js.');

if (failures.length) {
  console.error('Dist validation failed:\n' + failures.join('\n'));
  process.exit(1);
}
console.log(`Dist references OK: ${files.filter(file => file.endsWith('.html')).length} HTML pages. Target: ${target}.`);
