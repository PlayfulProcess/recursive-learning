#!/usr/bin/env node
/**
 * export-grammars.mjs — re-export this channel's PUBLIC grammars from recursive.eco
 * into `grammars/<slug>/grammar.json`, in the exact shape the app's own sync writes.
 *
 * The shape is not invented here. It mirrors
 *   recursive-eco/apps/flow/src/lib/grammar/document-data-to-grammar-json.ts
 * which is the ONE serializer for "app's current grammar -> repo grammar.json":
 *   file = document_data, verbatim,
 *          minus NON_CONTENT_APP_KEYS (top level) and NON_CONTENT_ITEM_KEYS (per item),
 *          plus the two `_recursive_eco_*` back-link pointers,
 *          printed with short primitive arrays inline (the authored repo style).
 * So a future `import-from-github` / sync PR sees a byte-shaped file it already understands.
 *
 * ONE addition of our own: `ai_personality_prompt` is never written to this repo.
 *
 * Reads only. Nothing here writes to recursive.eco.
 *
 * Usage:
 *   node scripts/export-grammars.mjs                 # uses ../recursive-eco/apps/flow/.env.local
 *   ENV_FILE=/path/to/.env.local node scripts/export-grammars.mjs
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/export-grammars.mjs
 *
 * The anon key is read at runtime and never stored in this repo.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const APP_URL = 'https://flow.recursive.eco';

// ── the channel's grammars: repo slug -> recursive.eco grammar id ────────────────
// Keep in sync with `grammars/_eco_ids.json` and `recursive-eco.json`.
const IDS = JSON.parse(readFileSync(join(ROOT, 'grammars', '_eco_ids.json'), 'utf8')).ids;

// ── the serializer's key lists (copied verbatim from the app) ───────────────────
const NON_CONTENT_APP_KEYS = new Set([
  '_github_url', '_backup_repo_url', '_forked_from_url',
  'editors', 'editor_roles', 'editor_role_source', '_detected_categories', '_github_source_url',
  '_community_folder', '_community_slug', '_original_creator', '_sync_unlinked',
]);
const NON_CONTENT_ITEM_KEYS = new Set(['origin', '_original_image_url']);
// Never leave the app. Not part of the app's list — this repo's own rule.
const NEVER_EXPORT_KEYS = new Set(['ai_personality_prompt']);

function stringifyGrammar(value, level = 0, indentSize = 2) {
  const pad = ' '.repeat(indentSize * level);
  const pad1 = ' '.repeat(indentSize * (level + 1));
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    if (value.every(v => v === null || typeof v !== 'object')) {
      const inline = '[' + value.map(v => JSON.stringify(v)).join(', ') + ']';
      if (inline.length <= 80) return inline; // short primitive array -> one line
    }
    return '[\n' + value.map(v => pad1 + stringifyGrammar(v, level + 1, indentSize)).join(',\n') + '\n' + pad + ']';
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 0) return '{}';
    return '{\n' + keys.map(k =>
      pad1 + JSON.stringify(k) + ': ' + stringifyGrammar(value[k], level + 1, indentSize),
    ).join(',\n') + '\n' + pad + '}';
  }
  return JSON.stringify(value);
}

function serialize(documentData, documentId) {
  const out = {};
  for (const k of Object.keys(documentData)) {
    if (NON_CONTENT_APP_KEYS.has(k) || NEVER_EXPORT_KEYS.has(k)) continue;
    if (k === 'items' && Array.isArray(documentData.items)) {
      out.items = documentData.items.map(it => {
        if (!it || typeof it !== 'object' || Array.isArray(it)) return it;
        const o = {};
        for (const ik of Object.keys(it)) if (!NON_CONTENT_ITEM_KEYS.has(ik)) o[ik] = it[ik];
        return o;
      });
      continue;
    }
    out[k] = documentData[k];
  }
  if (out.is_published === 'true') out.is_published = true;
  else if (out.is_published === 'false') out.is_published = false;
  out._recursive_eco_url = `${APP_URL}/g/${documentId}?view=reading`;
  out._recursive_eco_edit_url = `${APP_URL}/create/dashboard/unified/new?id=${documentId}`;
  return stringifyGrammar(out) + '\n';
}

// ── credentials (runtime only) ──────────────────────────────────────────────────
function creds() {
  let url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  let key = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    const envFile = process.env.ENV_FILE
      || resolve(ROOT, '..', 'recursive-eco', 'apps', 'flow', '.env.local');
    const text = readFileSync(envFile, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const v = m[2].replace(/^["']|["']$/g, '');
      if (!url && (m[1] === 'NEXT_PUBLIC_SUPABASE_URL' || m[1] === 'SUPABASE_URL')) url = v;
      if (!key && (m[1] === 'NEXT_PUBLIC_SUPABASE_ANON_KEY' || m[1] === 'SUPABASE_ANON_KEY')) key = v;
    }
  }
  if (!url || !key) throw new Error('No Supabase URL / anon key (set SUPABASE_URL + SUPABASE_ANON_KEY or ENV_FILE).');
  return { url: url.replace(/\/+$/, ''), key };
}

const { url, key } = creds();
let wrote = 0, skipped = 0;
for (const [slug, id] of Object.entries(IDS)) {
  const res = await fetch(
    `${url}/rest/v1/user_documents?id=eq.${id}&is_public=is.true&select=document_data`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  );
  if (!res.ok) { console.error(`  ! ${slug}: HTTP ${res.status}`); skipped++; continue; }
  const rows = await res.json();
  if (!rows.length) {
    // Anon can only read is_public=true. An empty row = not published (or unpublished since).
    console.error(`  - ${slug}: not public on recursive.eco — skipped (see grammars/PRIVATE.md)`);
    skipped++; continue;
  }
  const body = serialize(rows[0].document_data, id);
  const dir = join(ROOT, 'grammars', slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'grammar.json'), body, 'utf8');
  console.log(`  ok ${slug}  ${(Buffer.byteLength(body) / 1024).toFixed(0)} KB`);
  wrote++;
}
console.log(`\n${wrote} written, ${skipped} skipped.`);
