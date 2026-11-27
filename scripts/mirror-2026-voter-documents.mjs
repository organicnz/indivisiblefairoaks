#!/usr/bin/env bun
/**
 * Mirror the four 2026 voter documents from Google Drive into the public
 * `legacy-documents` bucket.
 *
 * Why a dedicated script instead of `legacy-import.mjs`: that importer works
 * from a full Google Sites audit manifest, and the four files it needs are
 * already indexed as `legacy_assets` rows with a `drive_id`. Re-running the
 * whole site import to move four files would re-download every page, image and
 * document. This script touches only these four.
 *
 * The Drive fallback stays the source of truth until a copy is proven. For each
 * document, in order:
 *
 *   1. download and check the bytes are a PDF (magic `%PDF-`), never a Drive
 *      HTML confirmation page;
 *   2. (commit only) upload to `legacy-documents/documents/voter/<slug>.pdf`;
 *   3. (commit only) fetch the *public* URL and compare its sha256 and length
 *      with the bytes that were uploaded;
 *   4. only then write `legacy_documents.file_path`. A row whose `file_path` is
 *      null keeps rendering the Drive fallback, which is the state all four are
 *      in today.
 *
 * If step 3 fails, the uploaded object is removed and the row is left alone, so
 * a bad copy can never replace a working Drive link.
 *
 * Usage:
 *   bun scripts/mirror-2026-voter-documents.mjs             # read-only dry run
 *   bun scripts/mirror-2026-voter-documents.mjs --commit    # upload + verify + point
 *   bun scripts/mirror-2026-voter-documents.mjs --revert    # unpoint + delete objects
 *
 * `--commit` and `--revert` require NEXT_PUBLIC_SUPABASE_URL and
 * SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY). The key is never printed.
 */
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal } from './load-env-local.mjs';

const BUCKET = 'legacy-documents';
const MIME = 'application/pdf';

/**
 * `source` is the URL that returns the document's actual bytes.
 *
 * Three are Drive files. The fourth is a Google Doc: its Drive download is a
 * `.docx`, while the archive row records `application/pdf` and the Drive
 * fallback opens a rendered preview — so the owned copy is the PDF export, which
 * keeps the reading experience identical.
 */
const DOCUMENTS = [
  {
    driveId: '10XEUyMoyGUI_UktPVwB0RJo-6w3lN0Uy',
    slug: 'calmatters-2026-voter-guide-non-partisan-2026-1tf9z6kn',
    title: 'CalMatters 2026 Voter Guide (Nonpartisan)',
    source: 'https://drive.usercontent.google.com/download?id=10XEUyMoyGUI_UktPVwB0RJo-6w3lN0Uy&export=download',
  },
  {
    driveId: '1JW2rg5dVBZBqezG3hd9QBu0znt3XsMaN',
    slug: 'ca-voter-information-guide-2026-2bqhekvi',
    title: 'CA Voter Information Guide 2026',
    source: 'https://drive.usercontent.google.com/download?id=1JW2rg5dVBZBqezG3hd9QBu0znt3XsMaN&export=download',
  },
  {
    driveId: '11Cv8yyuI_jtNet_IFSYHDN5xFr1axfg2',
    slug: 'hands-off-our-vote-2026-toolkit-3r709bjc',
    title: 'Hands Off Our Vote 2026 Toolkit',
    source: 'https://drive.usercontent.google.com/download?id=11Cv8yyuI_jtNet_IFSYHDN5xFr1axfg2&export=download',
  },
  {
    driveId: '1XyqCKsSKaQqrrzX7CSl3G3v0ChUtH98U',
    slug: 'key-dates-for-the-election-3e0tig0n',
    title: 'Key Dates for the Election',
    source: 'https://docs.google.com/document/d/1XyqCKsSKaQqrrzX7CSl3G3v0ChUtH98U/export?format=pdf',
  },
];

const args = process.argv.slice(2);
const COMMIT = args.includes('--commit');
const REVERT = args.includes('--revert');
if (COMMIT && REVERT) throw new Error('Choose one of --commit or --revert.');

await loadEnvLocal({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = String(Bun.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
const secret = Bun.env.SUPABASE_SECRET_KEY || Bun.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !secret) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required.');
}
const host = new URL(supabaseUrl).host;
if (!host.endsWith('.supabase.co')) {
  throw new Error(`Refusing to write to an unexpected Supabase host: ${host}`);
}

const db = createClient(supabaseUrl, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function objectPathFor(slug) {
  return `documents/voter/${slug}.pdf`;
}

function publicUrlFor(objectPath) {
  const encoded = objectPath.split('/').map(encodeURIComponent).join('/');
  return `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${encoded}`;
}

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function isPdf(bytes) {
  return (
    bytes.length > 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  );
}

function driveConfirmation(text) {
  if (!/Google Drive - Virus scan warning|download_warning|confirm=/i.test(text)) return null;
  return {
    uuid: text.match(/name="uuid"\s+value="([^"]+)"/i)?.[1] ?? null,
    confirm: text.match(/name="confirm"\s+value="([^"]+)"/i)?.[1] ?? 't',
  };
}

async function download(spec) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(spec.source, {
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
        Accept: '*/*',
      },
      signal: AbortSignal.timeout(120_000),
    });
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (response.status >= 400) throw new Error(`HTTP ${response.status}`);
    if (isPdf(bytes)) return bytes;

    // A Drive file that is too large or was scanned answers with an HTML
    // confirmation page on the first request. Retry once with its token.
    const confirmation = driveConfirmation(new TextDecoder().decode(bytes.slice(0, 20_000)));
    if (attempt === 0 && confirmation && spec.source.includes('drive.usercontent.google.com')) {
      const retry = new URL(spec.source);
      retry.searchParams.set('confirm', confirmation.confirm ?? 't');
      if (confirmation.uuid) retry.searchParams.set('uuid', confirmation.uuid);
      spec = { ...spec, source: retry.toString() };
      continue;
    }
    throw new Error(`not a PDF (${response.headers.get('content-type') ?? 'unknown type'})`);
  }
  throw new Error('unreachable');
}

async function fetchRow(spec) {
  const { data: asset, error: assetError } = await db
    .from('legacy_assets')
    .select('id, drive_id, rights, status')
    .eq('drive_id', spec.driveId)
    .maybeSingle();
  if (assetError) throw new Error(`asset lookup failed: ${assetError.message}`);
  if (!asset) throw new Error('no legacy_assets row for this drive id');

  const { data: document, error: documentError } = await db
    .from('legacy_documents')
    .select('id, slug, title, rights, status, file_path, public_url, external_url')
    .eq('asset_id', asset.id)
    .maybeSingle();
  if (documentError) throw new Error(`document lookup failed: ${documentError.message}`);
  if (!document) throw new Error('no legacy_documents row for this asset');

  return { asset, document };
}

async function mirrorOne(spec) {
  const { document } = await fetchRow(spec);
  const bytes = await download(spec);
  const sha256 = await sha256Hex(bytes);
  const objectPath = objectPathFor(document.slug);
  const result = {
    driveId: spec.driveId,
    slug: document.slug,
    title: document.title,
    rights: document.rights,
    previousFile: document.file_path,
    objectPath,
    publicUrl: publicUrlFor(objectPath),
    bytes: bytes.length,
    sha256,
  };

  if (!COMMIT) return { ...result, status: 'dry-run' };

  const { error: uploadError } = await db.storage
    .from(BUCKET)
    .upload(objectPath, bytes, { upsert: true, contentType: MIME });
  if (uploadError) return { ...result, status: 'failed', note: `upload: ${uploadError.message}` };

  // Verify the copy the public can actually fetch, not the upload's 200.
  const verifyUrl = `${result.publicUrl}?v=${sha256.slice(0, 12)}`;
  const verified = await (async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const res = await fetch(verifyUrl, { signal: AbortSignal.timeout(60_000) });
        if (res.status === 200) {
          const fetched = new Uint8Array(await res.arrayBuffer());
          const fetchedSha = await sha256Hex(fetched);
          if (fetchedSha === sha256 && fetched.length === bytes.length) {
            return { ok: true, contentType: res.headers.get('content-type') ?? '' };
          }
          return {
            ok: false,
            note: `public copy differs (${fetched.length} bytes, sha ${fetchedSha.slice(0, 12)})`,
          };
        }
        if (res.status !== 404) return { ok: false, note: `public copy HTTP ${res.status}` };
      } catch (error) {
        if (attempt === 4) return { ok: false, note: `verification fetch: ${error.message}` };
      }
      await Bun.sleep(1_000);
    }
    return { ok: false, note: 'public copy did not appear' };
  })();

  if (!verified.ok) {
    // Never leave a broken copy behind, and never point a card at it.
    const { error: removeError } = await db.storage.from(BUCKET).remove([objectPath]);
    return {
      ...result,
      status: 'failed',
      note: `${verified.note}; uploaded object removed${removeError ? ` (remove failed: ${removeError.message})` : ''}`,
    };
  }

  // Update by id, not upsert: an upsert would attempt an insert if the row ever
  // disappeared, and `slug`/`title` are NOT NULL with no defaults.
  const { error: updateError } = await db
    .from('legacy_documents')
    .update({
      file_path: objectPath,
      public_url: null,
      mime_type: MIME,
      byte_size: bytes.length,
      sha256,
      updated_at: new Date().toISOString(),
    })
    .eq('id', document.id);
  if (updateError) {
    return { ...result, status: 'failed', note: `row update: ${updateError.message}` };
  }

  return { ...result, status: 'mirrored', contentType: verified.contentType };
}

async function revertOne(spec) {
  const { document } = await fetchRow(spec);
  const objectPath = document.file_path ?? objectPathFor(document.slug);
  const { error: removeError } = await db.storage.from(BUCKET).remove([objectPath]);
  const { error: updateError } = await db
    .from('legacy_documents')
    .update({ file_path: null, public_url: null, updated_at: new Date().toISOString() })
    .eq('id', document.id);
  if (updateError) throw new Error(`row revert failed: ${updateError.message}`);
  return {
    driveId: spec.driveId,
    slug: document.slug,
    status: removeError ? 'reverted-with-remove-error' : 'reverted',
    note: removeError?.message ?? null,
  };
}

const results = [];
for (const spec of DOCUMENTS) {
  try {
    results.push(REVERT ? await revertOne(spec) : await mirrorOne(spec));
  } catch (error) {
    results.push({ driveId: spec.driveId, status: 'failed', note: error.message });
  }
}

console.log(
  `\n${REVERT ? 'Revert' : COMMIT ? 'Commit' : 'Dry run'} — bucket ${BUCKET} on ${host}\n`
);
for (const result of results) {
  console.log(`${result.status.padEnd(10)} ${result.slug ?? result.driveId}`);
  if (result.rights) console.log(`           rights: ${result.rights}`);
  if (result.bytes) console.log(`           bytes:  ${result.bytes}`);
  if (result.sha256) console.log(`           sha256: ${result.sha256}`);
  if (result.objectPath) console.log(`           object: ${result.objectPath}`);
  if (result.note) console.log(`           note:   ${result.note}`);
}
const failed = results.filter((result) => result.status.startsWith('failed'));
console.log(
  `\n${results.length - failed.length}/${results.length} ${COMMIT ? 'mirrored' : REVERT ? 'reverted' : 'checked'}, ${failed.length} failed.`
);
process.exit(failed.length > 0 ? 1 : 0);
