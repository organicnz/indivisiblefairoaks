import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

const scrapedDir = path.resolve(
  __dirname,
  '../../../../.gemini/antigravity-ide/brain/50a81e6e-a300-4c0a-9007-f374a28e588b/scraped_site'
);

function readScrapedText(filename, fallbackText = '') {
  try {
    const fullPath = path.join(scrapedDir, filename);
    if (fs.existsSync(fullPath)) {
      return fs.readFileSync(fullPath, 'utf-8').trim();
    }
  } catch (err) {
    console.warn(`Could not read ${filename}:`, err.message);
  }
  return fallbackText;
}

const civicContent = [
  {
    title: 'Indivisible Fair Oaks-Carmichael',
    slug: 'home',
    type: 'page',
    status: 'publish',
    excerpt:
      'A non-violent grassroots movement dedicated to defending democracy, resisting authoritarianism, electing progressive leaders, and advocating for our community.',
    body: readScrapedText(
      'home.txt',
      'Indivisible Fair Oaks-Carmichael is a grassroots community group in Sacramento County.'
    ),
    metadata: {
      meeting_time: 'First Tuesday of every month, 6:30 PM - 8:00 PM',
      meeting_location: 'Carmichael, CA (details upon registration)',
      food_drive: 'Bring non-perishable canned or boxed goods for the local food bank.',
    },
  },
  {
    title: 'About Our Chapter & Mission',
    slug: 'about-us',
    type: 'page',
    status: 'publish',
    excerpt:
      'Learn about our history, our 5 core values, leadership team, and how we apply the Indivisible Guide locally.',
    body:
      'We are grassroots neighbors and organizers in Fair Oaks and Carmichael, CA, committed to defending democratic institutions and civil rights through informed non-violent civic action.',
    metadata: {
      core_values: [
        'Democracy & The Rule of Law',
        'Inclusion & Civil Rights',
        'Grassroots People Power',
        'Direct Non-Violent Civic Action',
        'Community Solidarity & Mutual Aid',
      ],
    },
  },
  {
    title: 'Upcoming Events & Actions',
    slug: 'upcoming-events',
    type: 'event',
    status: 'publish',
    excerpt:
      'Join our community meetings, volunteer rallies, canvassing days, and postcard writing events.',
    body: readScrapedText(
      'upcoming-events.txt',
      'Check out our upcoming schedule of events and community actions.'
    ),
    metadata: {
      category: 'events',
    },
  },
  {
    title: 'Good Trouble Lives On! Weekend of Action',
    slug: 'good-trouble',
    type: 'event',
    status: 'publish',
    excerpt:
      'Honoring John Lewis through voter registration, direct advocacy, and persuasion training.',
    body: readScrapedText(
      'upcoming-events_good-trouble.txt',
      'Honoring John Lewis with peaceful protest and voting rights advocacy.'
    ),
    metadata: {
      date: 'July 17-19',
      category: 'action-weekend',
    },
  },
  {
    title: 'Weekend of Protest Song',
    slug: 'weekend-of-protest-song',
    type: 'event',
    status: 'publish',
    excerpt:
      'Demonstrating the power of peaceful community assembly through protest songs and musical resistance.',
    body: readScrapedText(
      'upcoming-events_weekend-of-protest-song.txt',
      'Singing protest and freedom songs across our neighborhoods.'
    ),
    metadata: {
      choir: 'Carmichael Resistance Choir',
      category: 'music-action',
    },
  },
  {
    title: 'Upcoming Fall Campaign Events',
    slug: 'upcoming-fall-events',
    type: 'event',
    status: 'publish',
    excerpt:
      'Canvassing, postcarding, and phone banking opportunities across Sacramento County and swing districts.',
    body: readScrapedText(
      'upcoming-events_upcoming-fall-events.txt',
      'Fall election preparation and voter turnout actions.'
    ),
    metadata: {
      category: 'campaign',
    },
  },
  {
    title: 'Carmichael Resistance Choir',
    slug: 'resistance-choir',
    type: 'page',
    status: 'publish',
    excerpt:
      'The musical voice of our movement. Rehearsals every other Wednesday evening in Carmichael.',
    body: readScrapedText(
      'resistance-choir.txt',
      'The Carmichael Resistance Choir sings songs of freedom, justice, and solidarity at rallies and protests.'
    ),
    metadata: {
      schedule: 'Every other Wednesday evening, 6:30 PM - 8:00 PM',
      email: 'contact@indivisiblefairoaks.org',
    },
  },
  {
    title: 'Voter Information & Sacramento County Guides',
    slug: 'voter-information',
    type: 'page',
    status: 'publish',
    excerpt:
      'Official voter resources: voting deadlines, ballot dropboxes, rights for formerly incarcerated citizens, and youth pre-registration at 16.',
    body: readScrapedText(
      'voter-information.txt',
      'Essential voter resources for Sacramento County and California.'
    ),
    metadata: {
      official_guide: 'https://elections.saccounty.gov',
      ca_portal: 'https://registertovote.ca.gov',
    },
  },
  {
    title: 'Action Alerts & Newsletters',
    slug: 'newsletters',
    type: 'post',
    status: 'publish',
    excerpt:
      'Read our archive of Indivisible Fair Oaks-Carmichael newsletters, legislative updates, and action alerts.',
    body: readScrapedText(
      'newsletters.txt',
      'Archive of our weekly and monthly newsletters.'
    ),
    metadata: {
      subscribe: 'subscribe@indivisiblefairoaks.org',
    },
  },
  {
    title: 'Coalition Partners & Progressive Alliances',
    slug: 'coalition-links',
    type: 'page',
    status: 'publish',
    excerpt:
      'Trusted state and national organizations fighting alongside us: National Indivisible, Sister District, Chop Wood Carry Water, 5 Calls, and local allies.',
    body: readScrapedText(
      'links.txt',
      'Directory of coalition partners and legislative tools.'
    ),
    metadata: {
      allies_count: 12,
    },
  },
];

async function seed() {
  console.log('🌱 Checking Supabase connection and seeding content...');
  console.log(`📡 URL: ${supabaseUrl}`);

  // Test if content table exists
  const { error: probeError } = await supabase.from('content').select('id').limit(1);
  if (probeError) {
    console.error('❌ Table "content" does not exist yet.');
    console.error(`Database error: ${probeError.message}`);
    console.log('\n👉 Please execute the SQL in "supabase/schema_indivisible.sql" in the Supabase SQL Editor:');
    console.log(`   https://supabase.com/dashboard/project/${process.env.SUPABASE_PROJECT_REF || '<your-project-ref>'}/sql/new\n`);
    process.exit(1);
  }

  console.log('✅ "content" table found. Upserting civic pages & events...\n');

  let inserted = 0;
  for (const item of civicContent) {
    const { data, error } = await supabase
      .from('content')
      .upsert(
        {
          title: item.title,
          slug: item.slug,
          type: item.type,
          status: item.status,
          excerpt: item.excerpt,
          body: item.body,
          metadata: item.metadata,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'slug' }
      )
      .select('id, slug');

    if (error) {
      console.error(`❌ Failed to upsert "${item.slug}": ${error.message}`);
    } else {
      console.log(`✅ Upserted [${item.type}] "${item.title}" -> /${item.slug}`);
      inserted++;
    }
  }

  console.log(`\n🎉 Successfully seeded ${inserted}/${civicContent.length} civic content records into Supabase!`);
}

seed().catch((err) => {
  console.error('Unexpected error during seeding:', err);
  process.exit(1);
});
