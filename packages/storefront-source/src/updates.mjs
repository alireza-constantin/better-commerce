import { readFile, stat } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { findEntry, loadCatalogue, resolveWithin, sha256 } from './catalogue.mjs';
import { getProvenance } from './installer.mjs';

/**
 * Builds a three-way source comparison without writing to merchant files.
 * The installed catalogue version is the base, the merchant file is local,
 * and the requested catalogue version is the proposed upstream version.
 */
export async function compareEntryUpdate({
  entryId,
  repositoryRoot,
  targetVersion,
}) {
  const { root, provenance } = await getProvenance(repositoryRoot);
  const installed = provenance.entries[entryId];
  if (!installed) throw new Error(`Catalogue entry is not installed: ${entryId}`);

  const [fromCatalogue, toCatalogue] = await Promise.all([
    loadCatalogue(installed.catalogueVersion),
    loadCatalogue(targetVersion),
  ]);
  const fromEntry = findEntry(fromCatalogue.manifest, entryId);
  const toEntry = findEntry(toCatalogue.manifest, entryId);
  const targetDirectory = installed.targetDirectory ?? 'src';
  const fromFiles = new Map(fromEntry.files.map((file) => [file.target, file]));
  const toFiles = new Map(toEntry.files.map((file) => [file.target, file]));
  const targets = [...new Set([...fromFiles.keys(), ...toFiles.keys()])].sort();
  const files = [];

  for (const target of targets) {
    const original = fromFiles.get(target);
    const proposed = toFiles.get(target);
    const localPath = resolveWithin(
      root,
      `${targetDirectory}/${target}`,
      'merchant target',
    );
    const local = await localFileHash(localPath);

    files.push({
      path: relative(root, localPath).replaceAll('\\', '/'),
      state: classify({ original, proposed, local }),
    });
  }

  return {
    entryId,
    fromVersion: installed.catalogueVersion,
    toVersion: targetVersion,
    files,
  };
}

function classify({ original, proposed, local }) {
  if (!original && proposed) return local ? 'new-file-conflict' : 'new-file';
  if (original && !proposed) return local ? 'removed-upstream' : 'missing-locally';
  if (!local) return 'missing-locally';
  if (local === original.sha256) {
    return original.sha256 === proposed.sha256 ? 'unchanged' : 'clean-update';
  }
  return original.sha256 === proposed.sha256
    ? 'modified-no-upstream-change'
    : 'modified-with-upstream-change';
}

async function localFileHash(path) {
  try {
    await stat(path);
    return sha256(await readFile(path));
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') return undefined;
    throw error;
  }
}
