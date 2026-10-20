import { resolve } from 'node:path';
import { loadEnvLocal } from './load-env-local.mjs';
import { createClient } from '@supabase/supabase-js';
import { generateTotp, msRemainingInStep } from '../e2e/helpers/totp.ts';

/**
 * Seed the two e2e users the skipped suites need.
 *
 * `e2e/admin-authenticated.spec.ts` signs in with a password as a non-MFA
 * admin; `e2e/mfa-challenge.spec.ts` signs in as an admin with one verified
 * TOTP factor and answers the challenge with a code derived from the factor
 * secret. Both suites skip without their credentials, and a skipped suite is
 * not a passing one — until these users exist the CRM mutation path, the
 * contact editor's concurrency handshake and the AAL2 upgrade are unit-tested
 * only.
 *
 * What it does, per user:
 *   1. find-or-create the auth user (service_role), confirm the email, set a
 *      generated password;
 *   2. upsert `profiles` with `is_admin = true`;
 *   3. sign in as the user and remove every existing MFA factor (clean slate —
 *      the non-MFA admin must have none, the MFA admin gets exactly one);
 *   4. for the MFA admin only: enroll TOTP, answer the challenge with a
 *      locally computed code, leave the factor verified.
 *
 * The generated passwords and the TOTP secret are printed once (store them as
 * CI secrets) and written to the git-ignored `.env.local` for local runs. It
 * deliberately does NOT set E2E_ALLOW_DB_WRITES — the write test creates a row
 * in the real constituent directory, and that switch stays a separate opt-in.
 *
 * Usage: bun scripts/seed-e2e-users.mjs
 */

// `loadEnvLocal` rather than `process.loadEnvFile`: the latter is a Node
// builtin, and this project does not have a Node runtime. The loader also
// strips the surrounding quotes Bun's own `.env` parser strips.
await loadEnvLocal({ path: resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = Bun.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = Bun.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SERVICE_KEY = Bun.env.SUPABASE_SECRET_KEY ?? Bun.env.SUPABASE_SERVICE_ROLE_KEY;

for (const [name, value] of [
  ['NEXT_PUBLIC_SUPABASE_URL', SUPABASE_URL],
  ['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', ANON_KEY],
  ['SUPABASE_SECRET_KEY', SERVICE_KEY],
]) {
  if (!value) {
    console.error(`Missing ${name} — add it to .env.local first.`);
    process.exit(1);
  }
}

const USERS = [
  {
    key: 'ADMIN',
    email: 'e2e-admin@example.com',
    fullName: 'E2E Admin',
    enrollMfa: false,
    // Needs profiles.is_admin = true for /admin. The priv-esc trigger
    // (20260922050000) blocks service_role grants, so this step prints the
    // one-line grant for an existing admin session / dashboard SQL instead.
    wantsAdminProfile: true,
  },
  {
    key: 'MFA_ADMIN',
    email: 'e2e-mfa-admin@example.com',
    fullName: 'E2E MFA Admin',
    enrollMfa: true,
    // The MFA suite only visits /login → /auth/mfa → /account, which needs no
    // admin flag — a plain profile is enough.
    wantsAdminProfile: false,
  },
];

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function generatePassword() {
  // WebCrypto's `getRandomValues` rather than `node:crypto`'s `randomBytes` —
  // a Web standard, and the same CSPRNG either way.
  //
  // `toBase64({ alphabet: 'base64url' })` keeps the `=` padding, where Node's
  // `toString('base64url')` strips it, so the padding is removed here. The
  // generated value is then byte-identical to what this script produced
  // before, which matters for anything that has already been seeded with one.
  return crypto
    .getRandomValues(new Uint8Array(24))
    .toBase64({ alphabet: 'base64url' })
    .replace(/=+$/, '');
}

async function findUser(email) {
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (data.users.length < 100) return null;
    page += 1;
    if (page > 20) throw new Error('user list exceeds 2000 rows — refusing to page further');
  }
}

async function upsertProfile(userId, email, fullName, wantsAdmin) {
  const { error } = await admin.from('profiles').upsert(
    {
      id: userId,
      user_id: userId,
      email: email.toLowerCase(),
      full_name: fullName,
      is_admin: wantsAdmin,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );
  if (error) {
    // The priv-esc trigger (migration 20260922050000) rejects is_admin=true
    // from every key-based caller, including service_role — by design. Only an
    // existing admin's session (or dashboard SQL) can grant it.
    if (wantsAdmin && error.message.includes('is_admin escalation blocked')) {
      const retry = await admin.from('profiles').upsert(
        {
          id: userId,
          user_id: userId,
          email: email.toLowerCase(),
          full_name: fullName,
          is_admin: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );
      if (retry.error) throw new Error(`profile upsert failed for ${email}: ${retry.error.message}`);
      console.log('  profile upserted WITHOUT admin flag (escalation blocked for API callers)');
      console.log(`  MANUAL GRANT NEEDED for ${email}:`);
      console.log(`    update public.profiles set is_admin = true where email = '${email}';`);
      console.log('  Run that from an existing admin session or the dashboard SQL editor,');
      console.log('  then this user can reach /admin.');
      return 'grant-needed';
    }
    throw new Error(`profile upsert failed for ${email}: ${error.message}`);
  }
  console.log(`  profile upserted (is_admin=${wantsAdmin})`);
  return 'ok';
}

async function clearFactors(userClient, email) {
  const { data, error } = await userClient.auth.mfa.listFactors();
  if (error) throw new Error(`listFactors failed for ${email}: ${error.message}`);
  for (const factor of [...(data.totp ?? []), ...(data.phone ?? [])]) {
    const { error: unenrollError } = await userClient.auth.mfa.unenroll({ factorId: factor.id });
    if (unenrollError) {
      throw new Error(`unenroll failed for ${email}: ${unenrollError.message}`);
    }
    console.log(`  removed pre-existing ${factor.factor_type} factor (${factor.id})`);
  }
}

/** Enroll TOTP and verify it, returning the shared secret. Retries across a code rollover. */
async function enrollTotp(userClient, email) {
  const { data: enrollData, error: enrollError } = await userClient.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: 'e2e-seed',
  });
  if (enrollError) throw new Error(`enroll failed for ${email}: ${enrollError.message}`);
  const factorId = enrollData.id;
  const secret = enrollData.totp?.secret;
  if (!secret) throw new Error(`enroll returned no secret for ${email}`);

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    if (msRemainingInStep() < 5_000) {
      // `Bun.sleep` rather than a promise wrapped around `setTimeout`. It is
      // the same wait, expressed as the thing it is: a sleep.
      await Bun.sleep(msRemainingInStep() + 1000);
    }
    const { data: challengeData, error: challengeError } = await userClient.auth.mfa.challenge({
      factorId,
    });
    if (challengeError) throw new Error(`challenge failed for ${email}: ${challengeError.message}`);
    const code = await generateTotp(secret);
    const { error: verifyError } = await userClient.auth.mfa.verify({
      factorId,
      challengeId: challengeData.id,
      code,
    });
    if (!verifyError) return secret;
    console.log(`  verify attempt ${attempt} failed (${verifyError.message}) — retrying`);
  }
  throw new Error(`TOTP verify failed 3 times for ${email}`);
}

async function writeEnvLocal(entries) {
  const path = resolve(process.cwd(), '.env.local');
  let text = '';
  try {
    text = await Bun.file(path).text();
  } catch {}
  const lines = text.length > 0 ? text.split('\n') : [];
  const wanted = new Map(Object.entries(entries));
  const out = lines.map((line) => {
    const match = line.match(/^([A-Z0-9_]+)=/);
    if (match && wanted.has(match[1])) {
      const value = wanted.get(match[1]);
      wanted.delete(match[1]);
      return `${match[1]}=${value}`;
    }
    return line;
  });
  for (const [key, value] of wanted) out.push(`${key}=${value}`);
  await Bun.write(path, `${out.join('\n').replace(/\n+$/, '\n')}`);
}

async function main() {
  const envEntries = {};
  const ciSecrets = {};

  for (const spec of USERS) {
    console.log(`Seeding ${spec.email} ...`);
    const password = generatePassword();

    let user = await findUser(spec.email);
    if (!user) {
      const { data, error } = await admin.auth.admin.createUser({
        email: spec.email,
        password,
        email_confirm: true,
        user_metadata: { full_name: spec.fullName },
      });
      if (error) throw new Error(`createUser failed for ${spec.email}: ${error.message}`);
      user = data.user;
      console.log(`  auth user created (${user.id})`);
    } else {
      const { error } = await admin.auth.admin.updateUserById(user.id, {
        password,
        email_confirm: true,
      });
      if (error) throw new Error(`password reset failed for ${spec.email}: ${error.message}`);
      console.log(`  existing auth user found (${user.id}) — password rotated, email confirmed`);
    }

    await upsertProfile(user.id, spec.email, spec.fullName, spec.wantsAdminProfile);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error: signInError } = await userClient.auth.signInWithPassword({
      email: spec.email,
      password,
    });
    if (signInError) throw new Error(`sign-in failed for ${spec.email}: ${signInError.message}`);

    await clearFactors(userClient, spec.email);

    if (spec.key === 'ADMIN') {
      envEntries.E2E_ADMIN_EMAIL = spec.email;
      envEntries.E2E_ADMIN_PASSWORD = password;
      ciSecrets.E2E_ADMIN_EMAIL = spec.email;
      ciSecrets.E2E_ADMIN_PASSWORD = password;
    } else {
      const secret = await enrollTotp(userClient, spec.email);
      console.log('  TOTP factor enrolled and verified');
      envEntries.E2E_MFA_ADMIN_EMAIL = spec.email;
      envEntries.E2E_MFA_ADMIN_PASSWORD = password;
      envEntries.E2E_MFA_TOTP_SECRET = secret;
      ciSecrets.E2E_MFA_ADMIN_EMAIL = spec.email;
      ciSecrets.E2E_MFA_ADMIN_PASSWORD = password;
      ciSecrets.E2E_MFA_TOTP_SECRET = secret;
    }
    await userClient.auth.signOut();
    console.log('');
  }

  await writeEnvLocal(envEntries);
  console.log('Wrote credentials to .env.local (git-ignored) for local runs.\n');
  console.log('Store these as CI secrets for the hosted suites:');
  for (const [key, value] of Object.entries(ciSecrets)) {
    console.log(`  ${key}=${value}`);
  }
  console.log('\nE2E_ALLOW_DB_WRITES intentionally not set — the directory write test stays skipped.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
