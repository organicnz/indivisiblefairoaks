import { createClient } from '@supabase/supabase-js';

const supabaseUrl = Bun.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = Bun.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

const categoriesData = [
  { name: 'Apparel & Solidarity Shirts', slug: 'apparel' },
  { name: 'Yard Signs & Banners', slug: 'yard-signs' },
  { name: 'Buttons, Pins & Stickers', slug: 'pins-stickers' },
  { name: 'Action Toolkits & Print Guides', slug: 'literature' },
];

const productsData = [
  {
    name: 'Indivisible Fair Oaks Official Chapter Tee',
    slug: 'official-chapter-tee',
    categorySlug: 'apparel',
    short_description: '100% union-printed heavyweight cotton t-shirt with official chapter insignia.',
    description: '<p>Wear your civic pride loud and clear. Screen-printed locally in Northern California on 100% union-made heavyweight cotton. Features the official Indivisible Fair Oaks-Carmichael emblem on the front chest and our rally motto on the reverse. Every shirt purchased directly funds local rally permits, choir sound equipment, and voter outreach drives.</p>',
    price: 24.0,
    regular_price: 28.0,
    sale_price: 24.0,
    stock_status: 'instock',
    image_url: 'gallery/legacy-chapter-official-banner.jpg',
    gallery_urls: ['gallery/legacy-chapter-official-banner.jpg', 'gallery/no-kings-constitution-banner.jpg'],
    attributes: { Size: ['S', 'M', 'L', 'XL', '2XL'] },
    variations: [
      { attributes: { Size: 'S' }, price: 24.0, regular_price: 28.0 },
      { attributes: { Size: 'M' }, price: 24.0, regular_price: 28.0 },
      { attributes: { Size: 'L' }, price: 24.0, regular_price: 28.0 },
      { attributes: { Size: 'XL' }, price: 24.0, regular_price: 28.0 },
      { attributes: { Size: '2XL' }, price: 26.0, regular_price: 30.0 },
    ],
  },
  {
    name: 'Defend Democracy Double-Sided Yard Sign',
    slug: 'defend-democracy-yard-sign',
    categorySlug: 'yard-signs',
    short_description: 'Weatherproof 24"x18" coroplast lawn sign with sturdy metal H-stake included.',
    description: '<p>Make a statement on your street. High-visibility weather-resistant corrugated plastic sign designed to withstand California heat and rain. Double-sided printing ensures maximum visibility from both directions of traffic. Includes a sturdy galvanized metal H-stake for easy lawn placement.</p>',
    price: 15.0,
    regular_price: 15.0,
    sale_price: null,
    stock_status: 'instock',
    image_url: 'gallery/no-kings-constitution-banner.jpg',
    gallery_urls: ['gallery/no-kings-constitution-banner.jpg', 'gallery/unity-be-brave-with-us.jpg'],
    attributes: {},
    variations: [],
  },
  {
    name: 'No Kings In America Rally Placard',
    slug: 'no-kings-rally-placard',
    categorySlug: 'yard-signs',
    short_description: 'Handheld protest placard mounted on durable wood picket for peaceful demonstrations.',
    description: '<p>Stand shoulder to shoulder at the corner of Fair Oaks Blvd and Manzanita Ave. Bold, high-contrast lettering readable from over 100 feet away. Printed on heavy 6-ply cardstock with reinforced wooden handle. Perfect for highway overpass demonstrations, rallies at the Capitol, and weekly stand-outs.</p>',
    price: 10.0,
    regular_price: 12.0,
    sale_price: 10.0,
    stock_status: 'instock',
    image_url: 'gallery/no-kings-defend-democracy.jpg',
    gallery_urls: ['gallery/no-kings-defend-democracy.jpg'],
    attributes: {},
    variations: [],
  },
  {
    name: 'Carmichael Resistance Choir Songbook & Chants',
    slug: 'resistance-choir-songbook',
    categorySlug: 'literature',
    short_description: 'Spiral-bound 48-page collection of freedom anthems, 4-part harmonies, and rally chants.',
    description: '<p>Every movement needs music. This official choir handbook includes lyrics, sheet music arrangements, and rhythmic cadence guides for traditional and contemporary justice songs. Durable spiral binding stays flat while singing outdoors or holding protest signs.</p>',
    price: 12.0,
    regular_price: 12.0,
    sale_price: null,
    stock_status: 'instock',
    image_url: 'gallery/choir-songbook-cover.jpg',
    gallery_urls: ['gallery/choir-songbook-cover.jpg', 'gallery/choir-outdoor-rehearsal.jpg'],
    attributes: {},
    variations: [],
  },
  {
    name: 'Voter Registration & Postcarding Blitz Pack (50pk)',
    slug: 'voter-outreach-postcard-pack',
    categorySlug: 'literature',
    short_description: 'Bundle of 50 nonpartisan voter turnout postcards with proven effective reminder scripts.',
    description: '<p>Handwritten postcards have been proven to boost voter turnout by 1.5% to 3.5% in competitive swing districts. Each pack includes 50 vibrant full-color postcards, address labels for targeted California voters, instructions, and proven persuasion scripts.</p>',
    price: 16.0,
    regular_price: 20.0,
    sale_price: 16.0,
    stock_status: 'instock',
    image_url: 'gallery/legacy-preregister-16.jpg',
    gallery_urls: ['gallery/legacy-preregister-16.jpg'],
    attributes: {},
    variations: [],
  },
  {
    name: 'Democracy Defense Button & Sticker 5-Pack',
    slug: 'democracy-button-sticker-pack',
    categorySlug: 'pins-stickers',
    short_description: 'Assortment of 3 metal pin-back buttons and 2 UV-laminated vinyl bumper stickers.',
    description: '<p>Spread the message wherever you go. Includes three 1.75-inch metal pin-back buttons featuring chapter emblems and two all-weather UV-coated vinyl bumper stickers made to resist peeling and fading in full California sun.</p>',
    price: 8.0,
    regular_price: 10.0,
    sale_price: 8.0,
    stock_status: 'instock',
    image_url: 'gallery/unity-be-brave-with-us.jpg',
    gallery_urls: ['gallery/unity-be-brave-with-us.jpg', 'gallery/witty-cat-nope-since-1776.jpg'],
    attributes: {},
    variations: [],
  },
  {
    name: 'Grassroots Solidarity Canvas Tote Bag',
    slug: 'solidarity-canvas-tote',
    categorySlug: 'apparel',
    short_description: 'Heavyweight organic cotton canvas tote bag with reinforced shoulder straps.',
    description: '<p>Spacious, sturdy tote designed for hauling clipboards, petitions, choir songbooks, or groceries from the local farmers market. Features dual-reinforced stitching, gusseted bottom, and inner zipper pocket for phones and pens.</p>',
    price: 18.0,
    regular_price: 22.0,
    sale_price: 18.0,
    stock_status: 'instock',
    image_url: 'gallery/legacy-banner.jpg',
    gallery_urls: ['gallery/legacy-banner.jpg'],
    attributes: {},
    variations: [],
  },
  {
    name: 'Good Trouble Overpass Banner Kit',
    slug: 'good-trouble-banner-kit',
    categorySlug: 'yard-signs',
    short_description: '10-foot outdoor vinyl banner with heavy-duty brass grommets and bungee fastenings.',
    description: '<p>Engineered for highway overpasses and large street stand-outs. 13oz heavy-duty vinyl banner equipped with reinforced hemmed edges and 12 brass grommets for wind resilience. Includes 10 industrial bungee cords for rapid deployment.</p>',
    price: 35.0,
    regular_price: 40.0,
    sale_price: 35.0,
    stock_status: 'instock',
    image_url: 'gallery/highway-overpass-good-trouble.jpg',
    gallery_urls: ['gallery/highway-overpass-good-trouble.jpg'],
    attributes: {},
    variations: [],
  },
];

const cmsLegalPages = [
  {
    slug: 'privacy-policy',
    title: 'Privacy Policy',
    type: 'page',
    status: 'publish',
    excerpt: 'Privacy policy for Indivisible Fair Oaks-Carmichael website and grassroots organizing.',
    body: `
<h2>Privacy Policy</h2>
<p>At Indivisible Fair Oaks-Carmichael, we recognize your right to confidentiality and are committed to protecting your privacy. Our website address is: https://indivisiblefairoaks.org.</p>
<h3>What Data We Collect</h3>
<p>When visitors leave comments, submit contact inquiries, or support our chapter through gear orders, we collect the data provided in the forms, along with the visitor's IP address and browser user agent string to help protect against automated spam.</p>
<h3>Email Communications</h3>
<p>If you subscribe to our newsletter or RSVP for chapter actions, your email address is used solely to deliver updates about chapter meetings, rallies, choir rehearsals, and civic action alerts. We never sell, rent, or share our contact lists with outside commercial vendors or corporate advertisers.</p>
<h3>Third-Party Civic Platforms</h3>
<p>Donations made to our chapter are processed securely through ActBlue (a 501(c)(4) nonprofit fundraising platform) or Stripe for grassroots materials. Their respective privacy policies govern transaction processing.</p>
<h3>Contact Us</h3>
<p>For questions regarding your data or to unsubscribe at any time, please contact us at contact@indivisiblefairoaks.org.</p>
`,
    metadata: { updated_at: '2026-09-08' },
  },
  {
    slug: 'terms-and-conditions',
    title: 'Terms and Conditions',
    type: 'page',
    status: 'publish',
    excerpt: 'Terms of use and participation guidelines for Indivisible Fair Oaks-Carmichael.',
    body: `
<h2>Terms and Conditions</h2>
<p>Last updated: September 2026</p>
<p>These terms govern your use of the Indivisible Fair Oaks-Carmichael website, participation in our community forums, and contributions to our grassroots outreach programs.</p>
<h3>Grassroots Contributions & Gear Orders</h3>
<p>All prices for chapter shirts, signs, and educational materials are in US Dollars (USD). 100% of proceeds fund local meeting hall rentals, rally signs, voter turnout mailers, and sound equipment for the Carmichael Resistance Choir.</p>
<h3>Non-Violent Action Commitment</h3>
<p>All Indivisible Fair Oaks-Carmichael gatherings, protests, and community actions adhere strictly to disciplined, non-violent civic assembly. Participants are expected to behave lawfully, treat neighbors with dignity, and de-escalate confrontation.</p>
<h3>Copyright and Intellectual Property</h3>
<p>Community photos and protest art in our gallery are shared by chapter members to chronicle local grassroots resistance. Materials may be shared for non-commercial, civic, and educational purposes with attribution.</p>
`,
    metadata: { updated_at: '2026-09-08' },
  },
  {
    slug: 'shipping-returns',
    title: 'Shipping, Pickup & Returns',
    type: 'page',
    status: 'publish',
    excerpt: 'Information regarding gear fulfillment, community pickup, and chapter materials.',
    body: `
<h2>Shipping, Community Pickup & Returns</h2>
<p>All Indivisible Fair Oaks-Carmichael outreach gear, lawn signs, and apparel are managed by volunteer chapter organizers in Sacramento County.</p>
<h3>Community Pickup</h3>
<p>Yard signs, placard signs, and choir songbooks can be picked up for free at our monthly chapter gatherings (first Tuesday of every month at St. Michael's Episcopal Church, Carmichael) or at Wednesday choir rehearsals.</p>
<h3>Standard Shipping</h3>
<p>Orders that require postal delivery are carefully packed and dispatched via USPS Priority or Ground Mail within 2-4 business days.</p>
<h3>Damaged or Incorrect Items</h3>
<p>If your items arrive damaged or you received an incorrect shirt size, please email contact@indivisiblefairoaks.org within 14 days and our volunteer team will replace them at no extra charge.</p>
`,
    metadata: { updated_at: '2026-09-08' },
  },
  {
    slug: 'faqs',
    title: 'Frequently Asked Questions',
    type: 'page',
    status: 'publish',
    excerpt: 'Frequently asked questions about meetings, the choir, voting, and membership.',
    body: `
<h2>Frequently Asked Questions</h2>
<h3>What is Indivisible Fair Oaks-Carmichael?</h3>
<p>We are a local grassroots chapter in Sacramento County affiliated with the national Indivisible movement. We organize peaceful resistance against authoritarianism, defend democratic norms, protect voting access, and support progressive policies.</p>
<h3>When and where do you meet?</h3>
<p>We gather on the first Tuesday of every month from 6:30 PM to 8:00 PM at St. Michael's Episcopal Church, 2140 Mission Ave, Carmichael, CA 95608. Hybrid Zoom options are also available.</p>
<h3>Do I need to audition for the Carmichael Resistance Choir?</h3>
<p>No audition is required! All voices, experience levels, and musical backgrounds are warmly welcomed. Rehearsals are held every other Wednesday evening.</p>
<h3>Are donations tax-deductible?</h3>
<p>Contributions made through ActBlue or for chapter materials support grassroots advocacy and political mobilization, and are therefore not tax-deductible as 501(c)(3) charitable gifts. 100% of funds support our organizing.</p>
`,
    metadata: { updated_at: '2026-09-08' },
  },
];

async function seed() {
  console.log('🌱 Starting comprehensive Supabase dynamic data seed...');

  // 1. Seed Categories
  console.log('\n📦 Seeding Categories...');
  const categoryMap = new Map();
  for (const cat of categoriesData) {
    const { data, error } = await supabase
      .from('categories')
      .upsert({ name: cat.name, slug: cat.slug }, { onConflict: 'slug' })
      .select('id, slug')
      .single();

    if (error) {
      console.error(`❌ Category "${cat.slug}": ${error.message}`);
    } else {
      console.log(`✅ Category "${cat.name}" (${cat.slug}) -> ID ${data.id}`);
      categoryMap.set(cat.slug, data.id);
    }
  }

  // 2. Seed Products
  console.log('\n👕 Seeding Products & Variations...');
  for (const prod of productsData) {
    const { data: prodData, error: prodError } = await supabase
      .from('products')
      .upsert(
        {
          name: prod.name,
          slug: prod.slug,
          description: prod.description,
          short_description: prod.short_description,
          price: prod.price,
          regular_price: prod.regular_price,
          sale_price: prod.sale_price,
          stock_status: prod.stock_status,
          image_url: prod.image_url,
          gallery_urls: prod.gallery_urls,
          attributes: prod.attributes,
        },
        { onConflict: 'slug' }
      )
      .select('id, slug')
      .single();

    if (prodError) {
      console.error(`❌ Product "${prod.slug}": ${prodError.message}`);
      continue;
    }

    console.log(`✅ Product "${prod.name}" (${prod.slug}) -> ID ${prodData.id}`);

    // Link Category
    const catId = categoryMap.get(prod.categorySlug);
    if (catId) {
      await supabase
        .from('product_categories')
        .upsert(
          { product_id: prodData.id, category_id: catId },
          { onConflict: 'product_id,category_id' }
        );
    }

    // Variations
    if (prod.variations && prod.variations.length > 0) {
      for (const v of prod.variations) {
        const { error: vErr } = await supabase.from('product_variations').insert({
          product_id: prodData.id,
          price: v.price,
          attributes: v.attributes,
          stock_status: 'instock',
        });
        if (vErr) console.error('Variation error:', vErr.message);
      }
      console.log(`   Added ${prod.variations.length} variations for ${prod.slug}`);
    }
  }

  // 3. Seed CMS Legal / Info Pages
  console.log('\n📄 Seeding CMS Legal & Info Pages into public.content...');
  for (const page of cmsLegalPages) {
    const { error } = await supabase
      .from('content')
      .upsert(
        {
          title: page.title,
          slug: page.slug,
          type: page.type,
          status: page.status,
          excerpt: page.excerpt,
          body: page.body,
          metadata: page.metadata,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'slug' }
      );

    if (error) {
      console.error(`❌ CMS Page "${page.slug}": ${error.message}`);
    } else {
      console.log(`✅ CMS Page "${page.title}" -> /${page.slug}`);
    }
  }

  console.log('\n🎉 Seed completed successfully!');
}

seed().catch((err) => {
  console.error('Fatal seed error:', err);
  process.exit(1);
});
