import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { findEntry, loadCatalogue, resolveWithin, sha256 } from './catalogue.mjs';

const PROVENANCE_FILE = 'better-commerce.source.json';

export async function installEntry({
  entryId,
  version,
  repositoryRoot,
  targetDirectory = 'src',
}) {
  const root = resolve(repositoryRoot);
  const targetRoot = resolveWithin(root, targetDirectory, 'target directory');
  const { manifest, root: catalogueRoot } = await loadCatalogue(version);
  const entry = findEntry(manifest, entryId);
  const provenancePath = resolve(root, PROVENANCE_FILE);
  const provenance = await readProvenance(provenancePath);

  if (provenance.entries[entry.id]) {
    throw new Error(`Catalogue entry is already installed: ${entry.id}`);
  }
  for (const dependency of entry.entryDependencies ?? []) {
    if (!provenance.entries[dependency]) {
      throw new Error(
        `Catalogue entry ${entry.id} requires ${dependency}; install it first`,
      );
    }
  }

  const plan = await Promise.all(
    entry.files.map(async (file) => {
      const sourcePath = resolveWithin(catalogueRoot, file.source, 'catalogue source');
      const targetPath = resolveWithin(targetRoot, file.target, 'merchant target');
      if (await exists(targetPath)) {
        throw new Error(`Refusing to overwrite existing file: ${relative(root, targetPath)}`);
      }
      return {
        content: await readFile(sourcePath),
        relativeTarget: portableRelativePath(root, targetPath),
        targetPath,
      };
    }),
  );

  for (const file of plan) {
    await mkdir(dirname(file.targetPath), { recursive: true });
    await writeFile(file.targetPath, file.content, { flag: 'wx' });
  }

  provenance.entries[entry.id] = {
    catalogueVersion: version,
    files: plan.map((file) => ({
      path: file.relativeTarget.replaceAll('\\', '/'),
      sha256: sha256(file.content),
    })),
    runtimeDependencies: entry.runtimeDependencies,
    targetDirectory,
  };
  await writeFile(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`, 'utf8');

  return {
    entry,
    files: plan.map(({ relativeTarget }) => relativeTarget),
    provenancePath,
  };
}

function portableRelativePath(root, targetPath) {
  return relative(root, targetPath).replaceAll('\\', '/');
}

export async function getStatus(repositoryRoot) {
  const root = resolve(repositoryRoot);
  const provenance = await readProvenance(resolve(root, PROVENANCE_FILE));
  const entries = [];

  for (const [entryId, installed] of Object.entries(provenance.entries)) {
    const files = await Promise.all(
      installed.files.map(async (file) => {
        const path = resolveWithin(root, file.path, 'recorded merchant target');
        if (!(await exists(path))) return { path: file.path, state: 'missing' };
        const content = await readFile(path);
        return {
          path: file.path,
          state: sha256(content) === file.sha256 ? 'unchanged' : 'modified',
        };
      }),
    );
    entries.push({
      id: entryId,
      catalogueVersion: installed.catalogueVersion,
      files,
      runtimeDependencies: installed.runtimeDependencies,
    });
  }

  return { entries };
}

export async function getProvenance(repositoryRoot) {
  const root = resolve(repositoryRoot);
  return {
    root,
    provenance: await readProvenance(resolve(root, PROVENANCE_FILE)),
  };
}

async function readProvenance(path) {
  if (!(await exists(path))) {
    return { schemaVersion: 1, entries: {} };
  }
  const value = JSON.parse(await readFile(path, 'utf8'));
  if (value.schemaVersion !== 1 || !value.entries || typeof value.entries !== 'object') {
    throw new Error(`Unsupported provenance manifest: ${path}`);
  }
  return value;
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') return false;
    throw error;
  }
}
