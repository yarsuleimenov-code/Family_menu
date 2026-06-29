import { copyFileSync } from 'node:fs';
import { resolve } from 'node:path';

const docsDir = resolve(import.meta.dirname, '..', 'docs');
copyFileSync(resolve(docsDir, 'index.html'), resolve(docsDir, '404.html'));
