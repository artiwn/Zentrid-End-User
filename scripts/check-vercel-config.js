const { existsSync, readFileSync } = require('fs');
const { join } = require('path');

const root = process.cwd();
const configPath = join(root, 'vercel.json');
const failures = [];

if (!existsSync(configPath)) {
  failures.push('Missing vercel.json in the project root.');
} else {
  let config;
  try {
    config = JSON.parse(readFileSync(configPath, 'utf8'));
  } catch (error) {
    failures.push(`vercel.json is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (config) {
    if (config.framework !== null) failures.push('vercel.json framework must be null (Other).');
    const expectedInstallCommand = 'node scripts/check-package-registry.js && npm ci --registry=https://registry.npmjs.org/';
    if (config.installCommand !== expectedInstallCommand) failures.push(`vercel.json installCommand must be "${expectedInstallCommand}".`);
    if (config.buildCommand !== 'npm run build:vercel') failures.push('vercel.json buildCommand must be "npm run build:vercel".');
    if (config.outputDirectory !== 'dist') failures.push('vercel.json outputDirectory must be "dist".');

    const expectedRewrites = [
      ['/api/Auth/:path*', 'https://fleetosauth.unisys.am/api/Auth/:path*'],
      ['/.well-known/:path*', 'https://fleetosauth.unisys.am/.well-known/:path*'],
      ['/api/:path*', 'https://fleetosapi.unisys.am/api/:path*']
    ];
    const rewrites = Array.isArray(config.rewrites) ? config.rewrites : [];
    expectedRewrites.forEach(([source, destination], index) => {
      const rewrite = rewrites[index];
      if (!rewrite || rewrite.source !== source || rewrite.destination !== destination) {
        failures.push(`Vercel rewrite ${index + 1} must map ${source} to ${destination}.`);
      }
    });
    if (rewrites.length !== expectedRewrites.length) {
      failures.push(`vercel.json must contain exactly ${expectedRewrites.length} API rewrites.`);
    }

    const protectedSources = new Set(['/api/:path*', '/.well-known/:path*']);
    const headerRules = Array.isArray(config.headers) ? config.headers : [];
    const globalRule = headerRules.find(item => item && item.source === '/(.*)');
    const globalHeaders = Array.isArray(globalRule?.headers) ? globalRule.headers : [];
    const globalHeader = key => globalHeaders.find(header => String(header?.key || '').toLowerCase() === key.toLowerCase())?.value || '';
    if (!globalHeader('Content-Security-Policy').includes("script-src-elem 'self'")) failures.push('Global Vercel CSP must restrict script elements to self.');
    if (globalHeader('X-Content-Type-Options') !== 'nosniff') failures.push('Global Vercel headers must set X-Content-Type-Options: nosniff.');
    if (globalHeader('X-Frame-Options') !== 'DENY') failures.push('Global Vercel headers must deny framing.');
    if (globalHeader('Referrer-Policy') !== 'strict-origin-when-cross-origin') failures.push('Global Vercel headers must set strict referrer policy.');
    for (const source of protectedSources) {
      const rule = headerRules.find(item => item && item.source === source);
      const headers = Array.isArray(rule?.headers) ? rule.headers : [];
      const noRewriteCache = headers.some(header => header?.key === 'x-vercel-enable-rewrite-caching' && header?.value === '0');
      const noStore = headers.some(header => header?.key === 'Cache-Control' && header?.value === 'no-store');
      if (!noRewriteCache) failures.push(`${source} must disable Vercel external rewrite caching.`);
      if (!noStore) failures.push(`${source} must return Cache-Control: no-store.`);
    }
  }
}

if (failures.length) {
  console.error('Vercel configuration check failed.');
  failures.forEach(message => console.error(`  ${message}`));
  process.exit(1);
}

console.log('Vercel configuration OK: static dist deployment with uncached Zentrid Auth/Data API rewrites.');
