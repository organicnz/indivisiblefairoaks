import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function auditImages() {
  console.log('🔍 Auditing Supabase Storage vs Database...');

  // 1. Get all image references from Database
  const { data: products } = await supabase.from('products').select('image_url, gallery_urls');
  const { data: content } = await supabase.from('content').select('body');

  const referencedPaths = new Set();

  const extractPath = (url) => {
    if (!url || typeof url !== 'string') return null;
    if (url.includes('/storage/v1/object/public/media/')) {
      return url.split('/storage/v1/object/public/media/')[1];
    }
    return null;
  };

  products?.forEach(p => {
    const main = extractPath(p.image_url);
    if (main) referencedPaths.add(main);
    p.gallery_urls?.forEach(url => {
      const g = extractPath(url);
      if (g) referencedPaths.add(g);
    });
  });

  content?.forEach(c => {
    const body = c.body || '';
    const imgRegex = /https:\/\/[^"']+\/storage\/v1\/object\/public\/media\/([^"'\s>]+)/g;
    let match;
    while ((match = imgRegex.exec(body)) !== null) {
      referencedPaths.add(match[1]);
    }
  });

  console.log(`✅ Database references ${referencedPaths.size} unique images.`);

  // 2. List all files in Storage (this is harder because list isn't recursive)
  // We'll check the standard WordPress-style year/month structure
  console.log('📂 Scanning storage folders...');
  let allStoragePaths = [];
  const years = ['2020', '2021', '2022', '2023', '2024', '2025', 'products'];
  
  for (const year of years) {
    const { data: months } = await supabase.storage.from('media').list(year);
    if (months) {
      for (const month of months) {
        const folder = `${year}/${month.name}`;
        if (month.id === null) { // It's a folder
           const { data: files } = await supabase.storage.from('media').list(folder, { limit: 1000 });
           if (files) {
             files.forEach(f => {
                if (f.id) allStoragePaths.push(`${folder}/${f.name}`);
             });
           }
        } else {
           allStoragePaths.push(`${year}/${month.name}`);
        }
      }
    }
  }

  console.log(`📦 Total files found in storage: ${allStoragePaths.length}`);

  const unreferenced = allStoragePaths.filter(path => !referencedPaths.has(path));
  console.log(`⚠️ Unreferenced images (not in products or content): ${unreferenced.length}`);

  // 3. Show some examples of unreferenced images to see if they are spam
  if (unreferenced.length > 0) {
    console.log('\nExample unreferenced files:');
    console.log(unreferenced.slice(0, 10));
  }
}

auditImages().catch(console.error);
