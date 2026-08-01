#!/usr/bin/env node
import { getStatus, installEntry } from '../src/installer.mjs';
import { getCatalogueRoot, loadCatalogue } from '../src/catalogue.mjs';
import { compareEntryUpdate } from '../src/updates.mjs';

const [command, ...arguments_] = process.argv.slice(2);
const entryId = command === 'add' ? arguments_.shift() : undefined;
const options = parseOptions(arguments_);
const root = options.root ?? process.cwd();

try {
  switch (command) {
    case 'list':
      await list(options.version ?? '1.0.0');
      break;
    case 'add':
      if (!entryId) throw new Error('Usage: better-commerce-storefront add <entry> --version <x.y.z>');
      await add(entryId, root, options);
      break;
    case 'status':
      await status(root);
      break;
    case 'diff':
      if (!entryId) throw new Error('Usage: better-commerce-storefront diff <entry> --to <x.y.z>');
      await diff(entryId, root, options);
      break;
    default:
      printUsage();
      process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Storefront source command failed');
  process.exitCode = 1;
}

async function list(version) {
  const { manifest } = await loadCatalogue(version);
  console.log(`Catalogue ${manifest.version} (${getCatalogueRoot()})`);
  for (const entry of manifest.entries) {
    console.log(`${entry.id}: ${entry.title} [${entry.kind}]`);
  }
}

async function add(id, root, options) {
  const result = await installEntry({
    entryId: id,
    version: required(options.version, '--version'),
    repositoryRoot: root,
    targetDirectory: options.target ?? 'src',
  });
  console.log(`Installed ${result.entry.id}:`);
  for (const file of result.files) console.log(`  ${file}`);
  console.log('Required runtime dependencies (install explicitly in the merchant repository):');
  for (const [name, range] of Object.entries(result.entry.runtimeDependencies)) {
    console.log(`  ${name}@${range}`);
  }
  console.log(`Recorded provenance in ${result.provenancePath}`);
}

async function status(root) {
  const result = await getStatus(root);
  if (result.entries.length === 0) {
    console.log('No Better Commerce source entries are installed.');
    return;
  }
  for (const entry of result.entries) {
    console.log(`${entry.id} (${entry.catalogueVersion})`);
    for (const file of entry.files) console.log(`  ${file.state}: ${file.path}`);
  }
}

async function diff(id, root, options) {
  const result = await compareEntryUpdate({
    entryId: id,
    repositoryRoot: root,
    targetVersion: required(options.to, '--to'),
  });
  console.log(`${result.entryId}: ${result.fromVersion} -> ${result.toVersion}`);
  for (const file of result.files) console.log(`  ${file.state}: ${file.path}`);
  console.log('No merchant files were changed. Resolve modified-with-upstream-change files manually.');
}

function parseOptions(values) {
  const result = {};
  for (let index = 0; index < values.length; index += 1) {
    const key = values[index];
    if (!key?.startsWith('--')) throw new Error(`Unexpected argument: ${key}`);
    const value = values[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${key}`);
    result[key.slice(2)] = value;
    index += 1;
  }
  return result;
}

function required(value, option) {
  if (!value) throw new Error(`Missing required ${option}`);
  return value;
}

function printUsage() {
  console.log('Usage:');
  console.log('  better-commerce-storefront list [--version <x.y.z>]');
  console.log('  better-commerce-storefront add <entry> --version <x.y.z> [--root <merchant-dir>] [--target <source-dir>]');
  console.log('  better-commerce-storefront status [--root <merchant-dir>]');
  console.log('  better-commerce-storefront diff <entry> --to <x.y.z> [--root <merchant-dir>]');
}
