import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { getStatus, installEntry } from '../src/installer.mjs';
import { compareEntryUpdate } from '../src/updates.mjs';

test('installs merchant-owned source and records provenance without changing dependencies', async () => {
  const root = await mkdtemp(join(tmpdir(), 'better-commerce-source-'));
  try {
    const result = await installEntry({
      entryId: 'product-grid',
      version: '1.0.0',
      repositoryRoot: root,
    });

    assert.deepEqual(result.files, [
      'src/components/better-commerce/product-grid/ProductGrid.tsx',
      'src/components/better-commerce/product-grid/product-grid.css',
    ]);
    const provenance = JSON.parse(
      await readFile(join(root, 'better-commerce.source.json'), 'utf8'),
    );
    assert.equal(provenance.entries['product-grid'].catalogueVersion, '1.0.0');
    assert.equal((await getStatus(root)).entries[0].files[0].state, 'unchanged');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('refuses overwrites and reports later merchant edits', async () => {
  const root = await mkdtemp(join(tmpdir(), 'better-commerce-source-'));
  try {
    await installEntry({
      entryId: 'product-grid',
      version: '1.0.0',
      repositoryRoot: root,
    });
    const component = join(
      root,
      'src/components/better-commerce/product-grid/ProductGrid.tsx',
    );
    await writeFile(component, '// merchant customization\n', 'utf8');

    const status = await getStatus(root);
    assert.equal(status.entries[0].files[0].state, 'modified');
    await assert.rejects(
      installEntry({
        entryId: 'product-grid',
        version: '1.0.0',
        repositoryRoot: root,
      }),
      /already installed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('compares installed source, merchant changes, and a newer catalogue release without writing', async () => {
  const root = await mkdtemp(join(tmpdir(), 'better-commerce-source-'));
  try {
    await installEntry({
      entryId: 'product-grid',
      version: '1.0.0',
      repositoryRoot: root,
    });
    const initial = await compareEntryUpdate({
      entryId: 'product-grid',
      repositoryRoot: root,
      targetVersion: '1.0.1',
    });
    assert.deepEqual(
      initial.files.map((file) => file.state),
      ['unchanged', 'clean-update'],
    );

    await writeFile(
      join(root, 'src/components/better-commerce/product-grid/product-grid.css'),
      '/* merchant customization */\n',
      'utf8',
    );
    const modified = await compareEntryUpdate({
      entryId: 'product-grid',
      repositoryRoot: root,
      targetVersion: '1.0.1',
    });
    assert.equal(modified.files[1].state, 'modified-with-upstream-change');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('requires portable block dependencies before installing a framework recipe', async () => {
  const root = await mkdtemp(join(tmpdir(), 'better-commerce-source-'));
  try {
    await assert.rejects(
      installEntry({
        entryId: 'next-product-grid-page',
        version: '1.0.1',
        repositoryRoot: root,
      }),
      /requires product-grid/,
    );
    await installEntry({
      entryId: 'product-grid',
      version: '1.0.1',
      repositoryRoot: root,
    });
    const recipe = await installEntry({
      entryId: 'next-product-grid-page',
      version: '1.0.1',
      repositoryRoot: root,
    });
    assert.deepEqual(recipe.files, ['src/app/products/page.tsx']);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
