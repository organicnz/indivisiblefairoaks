import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ADMIN_ACCOUNTS = [
  {
    email: 'erin@indivisiblefairoaks.org',
    first_name: 'Erin',
    last_name: 'Healy',
    full_name: 'Erin Healy',
  },
  {
    email: 'tamerlanium@gmail.com',
    first_name: 'Tarlan',
    last_name: 'Isaev',
    full_name: 'Tarlan Isaev',
  },
  {
    email: 'christiana@indivisiblefairoaks.org',
    first_name: 'Christiana',
    last_name: 'Quick-Cleveland',
    full_name: 'Christiana Quick-Cleveland',
  },
];

async function main() {
  console.log('🚀 Provisioning Admin Accounts...\n');

  for (const admin of ADMIN_ACCOUNTS) {
    console.log(`Processing ${admin.email} (${admin.full_name})...`);

    // 1. Check if user already exists in auth.users
    const { data: listData } = await supabase.auth.admin.listUsers();
    let authUser = listData?.users.find(
      (u) => u.email?.toLowerCase() === admin.email.toLowerCase()
    );

    if (!authUser) {
      console.log(`  Creating auth user for ${admin.email}...`);
      const { data: createData, error: createError } = await supabase.auth.admin.createUser({
        email: admin.email,
        email_confirm: true,
        user_metadata: {
          full_name: admin.full_name,
          first_name: admin.first_name,
          last_name: admin.last_name,
        },
      });

      if (createError) {
        console.error(`  ❌ Failed to create auth user:`, createError.message);
        continue;
      }
      authUser = createData.user;
      console.log(`  ✅ Auth user created with ID: ${authUser.id}`);
    } else {
      console.log(`  Existing auth user found (ID: ${authUser.id})`);
      const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(
        authUser.id,
        {
          email_confirm: true,
          user_metadata: {
            ...authUser.user_metadata,
            full_name: admin.full_name,
            first_name: admin.first_name,
            last_name: admin.last_name,
          },
        }
      );
      if (updateError) {
        console.error(`  ❌ Failed to update auth user:`, updateError.message);
      } else {
        authUser = updateData.user;
        console.log(`  ✅ Auth user updated and email confirmed.`);
      }
    }

    if (!authUser) continue;

    // 2. Upsert profile with is_admin = true
    console.log(`  Upserting profile...`);
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .upsert(
        {
          id: authUser.id,
          user_id: authUser.id,
          email: admin.email.toLowerCase(),
          full_name: admin.full_name,
          first_name: admin.first_name,
          last_name: admin.last_name,
          is_admin: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
      .select('id, email, is_admin, full_name')
      .single();

    if (profileError) {
      console.error(`  ❌ Profile upsert error:`, profileError.message);
    } else {
      console.log(`  ✅ Profile upserted:`, profileData);
    }

    // 3. Upsert CRM contact (use 'manual' source to satisfy check constraint)
    console.log(`  Upserting CRM contact...`);
    const { data: crmData, error: crmError } = await supabase
      .from('crm_contacts')
      .upsert(
        {
          email: admin.email.toLowerCase(),
          first_name: admin.first_name,
          last_name: admin.last_name,
          district: 'CA-06',
          status: 'organizer',
          tags: ['organizer', 'admin', 'leadership'],
          source: 'manual',
          notes: 'Chapter Administrator',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'email' }
      )
      .select('id, email, status, tags')
      .single();

    if (crmError) {
      console.error(`  ❌ CRM contact error:`, crmError.message);
    } else {
      console.log(`  ✅ CRM contact upserted:`, crmData);
    }

    console.log('');
  }

  // ── Final Verification ──
  console.log('=== Final Verification ===\n');

  const { data: finalAdmins, error: verifyErr } = await supabase
    .from('profiles')
    .select('id, email, full_name, is_admin')
    .eq('is_admin', true);

  if (verifyErr) {
    console.error('Verification error:', verifyErr);
  } else {
    console.log('Admin Profiles:');
    for (const a of finalAdmins || []) {
      console.log(`  ✅ ${a.full_name} <${a.email}> — admin: ${a.is_admin}`);
    }
  }

  const { data: crmContacts } = await supabase
    .from('crm_contacts')
    .select('email, first_name, last_name, status, tags')
    .in('email', ADMIN_ACCOUNTS.map(a => a.email.toLowerCase()));

  console.log('\nCRM Admin Contacts:');
  for (const c of crmContacts || []) {
    console.log(`  ✅ ${c.first_name} ${c.last_name} <${c.email}> — ${c.status} [${c.tags?.join(', ')}]`);
  }

  console.log('\n🎉 Admin provisioning complete!');
}

main().catch(console.error);
