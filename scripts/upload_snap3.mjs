import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

const fileBuffer = await Bun.file('public/snap3.jpg').arrayBuffer();
const { error } = await supabase.storage.from('media').upload('site/snap3.jpg', fileBuffer, {
  contentType: 'image/jpeg',
  upsert: true,
});
if (error) console.error(error);
else console.log('Successfully uploaded snap3.jpg');
