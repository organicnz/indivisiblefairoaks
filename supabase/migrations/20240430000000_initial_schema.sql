-- catch-22-next/supabase_schema.sql

-- 1. Create Categories Table
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    wp_id INT UNIQUE, -- Keep the original WordPress ID for mapping
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create Products Table
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    wp_id INT UNIQUE, -- Keep the original WordPress ID for mapping
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    short_description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    regular_price DECIMAL(10, 2),
    sale_price DECIMAL(10, 2),
    sku VARCHAR(100),
    stock_status VARCHAR(50) DEFAULT 'instock',
    weight VARCHAR(50),
    image_url TEXT,
    gallery_urls JSONB DEFAULT '[]'::jsonb,
    date_created TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create Product_Categories mapping table (Many-to-Many)
CREATE TABLE IF NOT EXISTS product_categories (
    product_id INT REFERENCES products(id) ON DELETE CASCADE,
    category_id INT REFERENCES categories(id) ON DELETE CASCADE,
    PRIMARY KEY (product_id, category_id)
);

-- Enable Row Level Security (RLS) for security
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;

-- Allow public read access to products and categories
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON categories;
CREATE POLICY "Public profiles are viewable by everyone." ON categories FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public products are viewable by everyone." ON products;
CREATE POLICY "Public products are viewable by everyone." ON products FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public product categories are viewable by everyone." ON product_categories;
CREATE POLICY "Public product categories are viewable by everyone." ON product_categories FOR SELECT USING (true);
