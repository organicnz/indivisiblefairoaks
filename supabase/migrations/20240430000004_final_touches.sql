-- catch-22-next/supabase_schema_final.sql

-- Product Variations Table
CREATE TABLE IF NOT EXISTS product_variations (
    id SERIAL PRIMARY KEY,
    wp_id INT UNIQUE,
    product_id INT REFERENCES products(id) ON DELETE CASCADE,
    price DECIMAL(10, 2),
    regular_price DECIMAL(10, 2),
    sale_price DECIMAL(10, 2),
    sku VARCHAR(100),
    attributes JSONB,
    stock_status VARCHAR(50) DEFAULT 'instock',
    weight VARCHAR(50),
    image_url TEXT
);

-- Coupons Table
CREATE TABLE IF NOT EXISTS coupons (
    id SERIAL PRIMARY KEY,
    wp_id INT UNIQUE,
    code VARCHAR(50) UNIQUE NOT NULL,
    amount DECIMAL(10, 2),
    discount_type VARCHAR(50),
    expiry_date TIMESTAMP WITH TIME ZONE
);

-- Pages & Posts (Content)
CREATE TABLE IF NOT EXISTS content (
    id SERIAL PRIMARY KEY,
    wp_id INT UNIQUE,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    body TEXT,
    type VARCHAR(50), -- 'page' or 'post'
    status VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE
);

-- Reviews Table
CREATE TABLE IF NOT EXISTS reviews (
    id SERIAL PRIMARY KEY,
    wp_id INT UNIQUE,
    product_id INT REFERENCES products(id) ON DELETE CASCADE,
    author_name VARCHAR(255),
    author_email VARCHAR(255),
    content TEXT,
    rating INT,
    created_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE product_variations ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE content ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Public read access policies
DROP POLICY IF EXISTS "Public product variations are viewable by everyone." ON product_variations;
CREATE POLICY "Public product variations are viewable by everyone." ON product_variations FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public content is viewable by everyone." ON content;
CREATE POLICY "Public content is viewable by everyone." ON content FOR SELECT USING (status = 'publish');

DROP POLICY IF EXISTS "Public reviews are viewable by everyone." ON reviews;
CREATE POLICY "Public reviews are viewable by everyone." ON reviews FOR SELECT USING (true);
