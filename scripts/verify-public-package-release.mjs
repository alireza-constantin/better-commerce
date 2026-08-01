import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repositoryRoot = resolve(import.meta.dirname, '..');
const repositoryUrl = 'git+https://github.com/alireza-constantin/better-commerce.git';
const packageDirectories = [
  'packages/sdk',
  'packages/storefront-core',
  'packages/storefront-source',
];
const expectedRegistry = 'https://registry.npmjs.org/';
const errors = [];

for (const directory of packageDirectories) {
  const packagePath = resolve(repositoryRoot, directory, 'package.json');
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
  const label = `${packageJson.name} (${directory})`;

  if (!packageJson.name?.startsWith('@better-commerce/')) {
    errors.push(`${label}: package name must use the @better-commerce scope.`);
  }

  if (packageJson.private === true) {
    errors.push(`${label}: publishable packages cannot set private: true.`);
  }

  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(packageJson.version ?? '')) {
    errors.push(`${label}: version must be a valid SemVer version.`);
  }

  if (packageJson.license !== 'MIT') {
    errors.push(`${label}: public packages must declare the MIT license.`);
  }

  if (packageJson.repository?.url !== repositoryUrl || packageJson.repository.directory !== directory) {
    errors.push(`${label}: repository metadata must identify its Better Commerce directory.`);
  }

  if (packageJson.publishConfig?.access !== 'public') {
    errors.push(`${label}: publishConfig.access must be public.`);
  }

  if (packageJson.publishConfig?.registry !== expectedRegistry) {
    errors.push(`${label}: publishConfig.registry must be ${expectedRegistry}`);
  }

  for (const file of packageJson.files ?? []) {
    if (!existsSync(resolve(repositoryRoot, directory, file))) {
      errors.push(`${label}: declared publish file '${file}' does not exist.`);
    }
  }

  if (!packageJson.scripts?.prepack) {
    errors.push(`${label}: prepack must build or validate the release artifact.`);
  }
}

const storefrontCore = JSON.parse(
  readFileSync(resolve(repositoryRoot, 'packages/storefront-core/package.json'), 'utf8'),
);

if (storefrontCore.dependencies?.['@better-commerce/sdk'] !== 'workspace:*') {
  errors.push('@better-commerce/storefront-core must depend on the SDK through workspace:*.');
}

if (errors.length > 0) {
  console.error('Public package release readiness failed:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exitCode = 1;
} else {
  console.log('Public package release metadata is ready.');
}
