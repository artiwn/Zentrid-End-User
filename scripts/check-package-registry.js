const { existsSync, readFileSync } = require('fs');
const { join } = require('path');

const root = process.cwd();
const lockPath = join(root, 'package-lock.json');
const failures = [];

if (!existsSync(lockPath)) {
  failures.push('Missing package-lock.json.');
} else {
  let lock;
  try {
    lock = JSON.parse(readFileSync(lockPath, 'utf8'));
  } catch (error) {
    failures.push(`package-lock.json is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (lock) {
    const packages = lock.packages && typeof lock.packages === 'object' ? lock.packages : {};
    for (const [packagePath, metadata] of Object.entries(packages)) {
      if (!metadata || typeof metadata !== 'object') continue;
      const resolved = metadata.resolved;
      if (typeof resolved !== 'string' || !/^https?:\/\//i.test(resolved)) continue;

      let hostname = '';
      try {
        hostname = new URL(resolved).hostname;
      } catch {
        failures.push(`Invalid resolved URL in package-lock.json (${packagePath || '<root>'}): ${resolved}`);
        continue;
      }

      if (hostname !== 'registry.npmjs.org') {
        failures.push(`Non-public npm registry URL in package-lock.json (${packagePath || '<root>'}): ${resolved}`);
      }
    }
  }
}

if (failures.length) {
  console.error('Package registry check failed.');
  failures.forEach(message => console.error(`  ${message}`));
  process.exit(1);
}

console.log('Package registry OK: package-lock.json uses registry.npmjs.org only.');
