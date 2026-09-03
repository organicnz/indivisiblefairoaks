import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

const fileBuffer = readFileSync('public/snap3.jpg');
supabase.storage.from('media').upload('site/snap3.jpg', fileBuffer, {
  contentType: 'image/jpeg',
  upsert: true,
}).then(({ error }) => {
  if (error) console.error(error);
  else console.log('Successfully uploaded snap3.jpg');
});
