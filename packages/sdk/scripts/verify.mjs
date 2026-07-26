import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const tsc = require.resolve('typescript/bin/tsc');
const result = spawnSync(
  process.execPath,
  [tsc, '--noEmit', '-p', 'tsconfig.json'],
  {
    cwd: new URL('..', import.meta.url),
    stdio: 'inherit',
  },
);

process.exitCode = result.status ?? 1;
