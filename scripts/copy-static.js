const { copyFileSync, existsSync, mkdirSync, readdirSync } = require('fs');
const { dirname, join } = require('path');
const root = process.cwd();
const dist = join(root, 'dist');
function copy(source, target) { mkdirSync(dirname(target), { recursive: true }); copyFileSync(source, target); }
function tree(source, target) {
  if (!existsSync(source)) return;
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    const from = join(source, entry.name); const to = join(target, entry.name);
    if (entry.isDirectory()) tree(from, to); else copy(from, to);
  }
}
for (const file of ['index.html','login.html','favicon.ico']) copy(join(root, file), join(dist, file));
tree(join(root, 'pages'), join(dist, 'pages'));
console.log('Copied Zentrid End User static files.');
