-- catch-22-next/supabase_schema_extended.sql

-- Profiles Table (to store historical WP users)
CREATE TABLE IF NOT EXISTS profiles (
    id SERIAL PRIMARY KEY,
    wp_id INT UNIQUE,
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    username VARCHAR(255),
    registered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Orders Table
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    wp_id INT UNIQUE,
    customer_id INT REFERENCES profiles(id) ON DELETE SET NULL,
    status VARCHAR(50),
    currency VARCHAR(10),
    total_amount DECIMAL(10, 2),
    billing_address JSONB,
    shipping_address JSONB,
    payment_method VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE
);

-- Order Items Table
CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INT REFERENCES orders(id) ON DELETE CASCADE,
    product_id INT REFERENCES products(id) ON DELETE SET NULL,
    product_name VARCHAR(255),
    quantity INT,
    total DECIMAL(10, 2)
);

-- Security Rules
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- For migration purposes, service_role has access to bypass RLS, so no explicit policies needed here yet.
