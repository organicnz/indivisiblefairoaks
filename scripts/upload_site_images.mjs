/**
 * Uploads static site images from /public to Supabase Storage (media bucket, site/ folder)
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'fs';
import { join, extname } from 'path';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const IMAGES = [
  'hero.jpg',
  'about-hero.jpg',
  'team.jpg',
  'thunder-charter.jpg',
  'partner-ham-ty.jpg',
  'partner-seacleaners.jpg',
  'partner-thunder.jpg',
  'snap1.jpg',
  'snap2.jpg',
  'snap3.jpg',
  'snap4.jpg',
  'snap5.jpg',
  'snap6.jpg',
  'logo.png',
  'nz-boat.png',
];

const MIME_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

async function uploadImages() {
  console.log('Uploading site images to Supabase Storage (media/site/)...\n');

  for (const filename of IMAGES) {
    const localPath = join('public', filename);
    const storagePath = `site/${filename}`;
    const ext = extname(filename).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    try {
      const fileBuffer = readFileSync(localPath);

      const { error } = await supabase.storage
        .from('media')
        .upload(storagePath, fileBuffer, {
          contentType,
          upsert: true,
        });

      if (error) {
        console.error(`❌ Failed: ${filename} — ${error.message}`);
      } else {
        console.log(`✅ Uploaded: ${filename} → media/site/${filename}`);
      }
    } catch (err) {
      console.error(`❌ Error reading ${filename}: ${err.message}`);
    }
  }

  console.log('\nDone!');
}

uploadImages();
