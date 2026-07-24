const { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } = require('fs');
const { dirname, extname, relative, resolve, sep } = require('path');
const { createHash } = require('crypto');

const root = process.cwd();
const sourceRoot = resolve(root, 'assets', 'css', 'src');
const manifestPath = resolve(sourceRoot, 'manifest.json');
const distRoot = resolve(root, 'dist');

function fail(message) {
  console.error(`CSS build failed: ${message}`);
  process.exit(1);
}

if (!existsSync(manifestPath)) fail('assets/css/src/manifest.json is missing.');

let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
} catch (error) {
  fail(`cannot read manifest.json: ${error instanceof Error ? error.message : String(error)}`);
}

if (manifest?.version !== 1) fail('manifest version must be 1.');
if (!Array.isArray(manifest.sources) || manifest.sources.length === 0) {
  fail('manifest.sources must contain at least one CSS fragment.');
}
if (typeof manifest.output !== 'string' || manifest.output !== 'assets/css/styles.css') {
  fail('manifest.output must be assets/css/styles.css.');
}

const listedSources = [];
const listedNames = new Set();
for (const sourceName of manifest.sources) {
  if (typeof sourceName !== 'string' || extname(sourceName).toLowerCase() !== '.css') {
    fail(`invalid CSS source entry: ${String(sourceName)}`);
  }
  if (listedNames.has(sourceName)) fail(`duplicate CSS source entry: ${sourceName}`);
  listedNames.add(sourceName);

  const sourcePath = resolve(sourceRoot, sourceName);
  if (sourcePath !== sourceRoot && !sourcePath.startsWith(`${sourceRoot}${sep}`)) {
    fail(`CSS source escapes assets/css/src: ${sourceName}`);
  }
  if (!existsSync(sourcePath)) fail(`listed CSS source is missing: ${sourceName}`);
  listedSources.push(sourcePath);
}

function discoverCssSources(directory, prefix = '') {
  const discovered = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const relativeName = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolutePath = resolve(directory, entry.name);
    if (entry.isDirectory()) discovered.push(...discoverCssSources(absolutePath, relativeName));
    else if (entry.isFile() && entry.name.endsWith('.css')) discovered.push(relativeName);
  }
  return discovered.sort();
}

const discoveredSources = discoverCssSources(sourceRoot);
const unlistedSources = discoveredSources.filter(name => !listedNames.has(name));
if (unlistedSources.length) fail(`unlisted CSS source fragment(s): ${unlistedSources.join(', ')}`);

const buffers = listedSources.map(sourcePath => readFileSync(sourcePath));
const output = Buffer.concat(buffers);
const outputPath = resolve(distRoot, manifest.output);
if (!outputPath.startsWith(`${distRoot}${sep}`)) fail('CSS output escapes dist/.');

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, output);

const hash = createHash('sha256').update(output).digest('hex');
const lineCount = output.reduce((count, byte) => count + (byte === 10 ? 1 : 0), 0);
console.log(
  `CSS build OK: ${listedSources.length} ordered fragment(s), ${lineCount} line(s), ${output.length} byte(s), sha256 ${hash.slice(0, 12)}…`
);
