const { rmSync } = require('fs');
const { join } = require('path');
rmSync(join(process.cwd(), 'dist'), { recursive: true, force: true });
console.log('Cleaned dist.');
