import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const catalogueRoot = resolve(packageRoot, 'catalogue');

export function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

export function getCatalogueRoot() {
  return catalogueRoot;
}

export async function loadCatalogue(version) {
  if (!/^[0-9]+\.[0-9]+\.[0-9]+$/.test(version)) {
    throw new Error(`Invalid catalogue version: ${version}`);
  }

  const root = resolve(catalogueRoot, version);
  const manifestPath = resolve(root, 'catalogue.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

  if (manifest.schemaVersion !== 1 || manifest.version !== version) {
    throw new Error(`Unsupported catalogue manifest: ${manifestPath}`);
  }
  if (!Array.isArray(manifest.entries)) {
    throw new Error(`Catalogue entries must be an array: ${manifestPath}`);
  }

  for (const entry of manifest.entries) {
    if (!entry || typeof entry.id !== 'string' || !Array.isArray(entry.files)) {
      throw new Error(`Invalid catalogue entry in ${manifestPath}`);
    }
    for (const file of entry.files) {
      const sourcePath = resolveWithin(root, file.source, 'catalogue source');
      const content = await readFile(sourcePath);
      if (typeof file.sha256 !== 'string' || file.sha256 !== sha256(content)) {
        throw new Error(`Integrity check failed for ${entry.id}:${file.source}`);
      }
      resolveWithin(resolve('source-root'), file.target, 'merchant target');
    }
  }

  return { manifest, root };
}

export function findEntry(manifest, entryId) {
  const entry = manifest.entries.find((candidate) => candidate.id === entryId);
  if (!entry) throw new Error(`Unknown catalogue entry: ${entryId}`);
  return entry;
}

export function resolveWithin(root, relativePath, label) {
  if (typeof relativePath !== 'string' || relativePath.length === 0) {
    throw new Error(`${label} path must be a non-empty string`);
  }
  const candidate = resolve(root, relativePath);
  const normalizedRoot = root.endsWith(sep) ? root : `${root}${sep}`;
  if (candidate !== root && !candidate.startsWith(normalizedRoot)) {
    throw new Error(`${label} path escapes its root: ${relativePath}`);
  }
  return candidate;
}
