import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const tsc = require.resolve('typescript/bin/tsc');

const packageRoot = new URL('..', import.meta.url);

run(process.execPath, [tsc, '-p', 'tsconfig.json']);
run(process.execPath, [tsc, '-p', 'fixtures/tsconfig.json']);
run(process.execPath, [
  fileURLToPath(new URL('runtime-verify.mjs', import.meta.url)),
]);

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: packageRoot,
    stdio: 'inherit',
  });

  if (result.status !== 0) process.exit(result.status ?? 1);
}
