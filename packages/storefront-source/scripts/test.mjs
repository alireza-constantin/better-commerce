import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Turborepo forwards Jest's --runInBand flag to every workspace test command.
// This package uses Node's test runner, so intentionally do not forward it.
const testFile = fileURLToPath(
  new URL('../test/installer.test.mjs', import.meta.url),
);
const result = spawnSync(process.execPath, ['--test', testFile], {
  cwd: new URL('..', import.meta.url),
  stdio: 'inherit',
});

process.exitCode = result.status ?? 1;
