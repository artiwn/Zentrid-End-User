const { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } = require('fs');
const { dirname, join, relative } = require('path');
const ts = require('typescript');
const root = process.cwd();
const sourceFiles = [];
function walk(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (entry.isFile() && path.endsWith('.ts') && !path.endsWith('.d.ts')) sourceFiles.push(path);
  }
}
walk(join(root, 'assets', 'js'));
for (const sourcePath of sourceFiles.sort()) {
  const outputPath = join(root, 'dist', relative(root, sourcePath).replace(/\.ts$/, '.js'));
  const original = readFileSync(sourcePath, 'utf8').replace(/^\s*export\s*\{\s*\};\s*\r?\n?/m, '');
  const result = ts.transpileModule(original, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None, lib: ['ES2022','DOM','DOM.Iterable'], alwaysStrict: true },
    fileName: sourcePath,
    reportDiagnostics: true
  });
  const errors = (result.diagnostics || []).filter(item => item.category === ts.DiagnosticCategory.Error);
  if (errors.length) throw new Error(errors.map(item => ts.flattenDiagnosticMessageText(item.messageText, '\n')).join('\n'));
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, result.outputText, 'utf8');
}
console.log(`Browser build OK: ${sourceFiles.length} End User scripts.`);
