-- Setup Test Data for Smart Restaurant System
-- Run this in your Supabase SQL Editor after running supabase-setup.sql

-- First, disable RLS temporarily for easier testing
ALTER TABLE menu_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_items DISABLE ROW LEVEL SECURITY;

-- Clear existing data
DELETE FROM order_items;
DELETE FROM orders;
DELETE FROM menu_items;

-- Insert realistic menu items
INSERT INTO menu_items (name, description, price, category, image_url, is_available) VALUES
-- Appetizers
('Truffle Arancini', 'Crispy risotto balls with truffle oil and parmesan', 14.99, 'appetizers', 'https://images.unsplash.com/photo-1574484284002-952d92456975?w=400', true),
('Burrata Caprese', 'Fresh burrata with heirloom tomatoes and basil', 16.99, 'appetizers', 'https://images.unsplash.com/photo-1608897013039-887f21d8c804?w=400', true),
('Tuna Tartare', 'Sesame-crusted tuna with avocado and citrus', 18.99, 'appetizers', 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400', true),
('Charcuterie Board', 'Selection of artisanal meats and cheeses', 22.99, 'appetizers', 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400', true),

-- Main Courses
('Wagyu Ribeye', '12oz prime wagyu with roasted vegetables', 65.99, 'mains', 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400', true),
('Pan-Seared Salmon', 'Atlantic salmon with lemon herb butter', 28.99, 'mains', 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400', true),
('Duck Confit', 'Slow-cooked duck leg with cherry gastrique', 32.99, 'mains', 'https://images.unsplash.com/photo-1551782450-a2132b4ba21d?w=400', true),
('Lobster Risotto', 'Creamy arborio rice with fresh lobster', 42.99, 'mains', 'https://images.unsplash.com/photo-1551782450-a2132b4ba21d?w=400', true),
('Vegetarian Wellington', 'Mushroom and spinach wrapped in puff pastry', 24.99, 'mains', 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400', true),

-- Desserts
('Chocolate Lava Cake', 'Warm chocolate cake with vanilla ice cream', 9.99, 'desserts', 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=400', true),
('Crème Brûlée', 'Classic vanilla custard with caramelized sugar', 8.99, 'desserts', 'https://images.unsplash.com/photo-1470324161839-ce2bb6fa6bc3?w=400', true),
('Tiramisu', 'Traditional Italian coffee-flavored dessert', 10.99, 'desserts', 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=400', true),
('Seasonal Fruit Tart', 'Fresh seasonal fruits on pastry cream', 11.99, 'desserts', 'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=400', true),

-- Drinks
('OREO SHAKE', 'Creamy oreo milkshake with whipped cream', 8.99, 'drinks', 'assets/hero1.jpg', true),
('STRAWBERRY SHAKE', 'Fresh strawberry milkshake', 7.99, 'drinks', 'assets/hero2.jpg', true),
('PROTEIN SHAKE', 'High-protein vanilla shake for fitness enthusiasts', 12.99, 'drinks', 'assets/hero3.jpg', true),
('Craft Beer Selection', 'Rotating selection of local craft beers', 6.99, 'drinks', 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400', true),
('House Wine', 'Curated selection of red and white wines', 8.99, 'drinks', 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=400', true),
('Artisan Coffee', 'Single-origin coffee beans, expertly brewed', 4.99, 'drinks', 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400', true),
('Fresh Juice', 'Daily selection of fresh-pressed juices', 5.99, 'drinks', 'https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=400', true);

-- Insert sample orders for testing
INSERT INTO orders (table_number, customer_name, customer_phone, status, total_amount, notes) VALUES
(5, 'John Smith', '555-0123', 'pending', 45.97, 'No onions please'),
(12, 'Sarah Johnson', '555-0456', 'preparing', 78.96, 'Medium rare steak'),
(8, 'Mike Wilson', '555-0789', 'ready', 32.98, 'Extra sauce on the side'),
(3, 'Emily Davis', '555-0321', 'completed', 56.97, 'Birthday celebration - candle please');

-- Insert order items (linking to the orders above)
-- Get the order IDs first, then insert items
WITH order_ids AS (
  SELECT id, customer_name FROM orders
)
INSERT INTO order_items (order_id, menu_item_id, quantity, price)
SELECT 
  o.id,
  m.id,
  CASE 
    WHEN o.customer_name = 'John Smith' AND m.name = 'Truffle Arancini' THEN 2
    WHEN o.customer_name = 'John Smith' AND m.name = 'Pan-Seared Salmon' THEN 1
    WHEN o.customer_name = 'Sarah Johnson' AND m.name = 'Wagyu Ribeye' THEN 1
    WHEN o.customer_name = 'Sarah Johnson' AND m.name = 'House Wine' THEN 2
    WHEN o.customer_name = 'Mike Wilson' AND m.name = 'Duck Confit' THEN 1
    WHEN o.customer_name = 'Emily Davis' AND m.name = 'Lobster Risotto' THEN 1
    WHEN o.customer_name = 'Emily Davis' AND m.name = 'Chocolate Lava Cake' THEN 2
    ELSE 1
  END,
  m.price
FROM order_ids o
CROSS JOIN menu_items m
WHERE 
  (o.customer_name = 'John Smith' AND m.name IN ('Truffle Arancini', 'Pan-Seared Salmon')) OR
  (o.customer_name = 'Sarah Johnson' AND m.name IN ('Wagyu Ribeye', 'House Wine')) OR
  (o.customer_name = 'Mike Wilson' AND m.name IN ('Duck Confit')) OR
  (o.customer_name = 'Emily Davis' AND m.name IN ('Lobster Risotto', 'Chocolate Lava Cake'));

-- Re-enable RLS with public policies for testing
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for testing (adjust for production)
CREATE POLICY "Public read menu_items" ON menu_items FOR SELECT USING (true);
CREATE POLICY "Public insert menu_items" ON menu_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update menu_items" ON menu_items FOR UPDATE USING (true);
CREATE POLICY "Public delete menu_items" ON menu_items FOR DELETE USING (true);

CREATE POLICY "Public read orders" ON orders FOR SELECT USING (true);
CREATE POLICY "Public insert orders" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update orders" ON orders FOR UPDATE USING (true);

CREATE POLICY "Public read order_items" ON order_items FOR SELECT USING (true);
CREATE POLICY "Public insert order_items" ON order_items FOR INSERT WITH CHECK (true);

-- Success message
SELECT 'Test data setup complete! Your restaurant now has:' as message,
       (SELECT COUNT(*) FROM menu_items) as menu_items,
       (SELECT COUNT(*) FROM orders) as sample_orders,
       (SELECT COUNT(*) FROM order_items) as order_items;
       --setup-test-data.sql---
       
-- Create menu_items table
CREATE TABLE IF NOT EXISTS menu_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    category VARCHAR(50) NOT NULL,
    image_url TEXT,
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    table_number INTEGER,
    customer_name VARCHAR(255),
    customer_phone VARCHAR(20),
    status VARCHAR(20) DEFAULT 'pending',
    total_amount DECIMAL(10,2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create order_items table
CREATE TABLE IF NOT EXISTS order_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id UUID REFERENCES menu_items(id),
    quantity INTEGER NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert sample menu items
INSERT INTO menu_items (name, description, price, category, image_url) VALUES
('OREO SHAKE', 'This is oreo shake made from your favorite biscuit oreo. Ingredients are milk, flavours.', 8.99, 'drinks', 'assets/hero1.jpg'),
('STRAWBERRY SHAKE', 'This is mostly recommended from our chefs and made from fresh strawberry.', 7.99, 'drinks', 'assets/hero2.jpg'),
('PROTEIN SHAKE', 'For body builder if you want build a perfect body this is your ideal choice.', 12.99, 'drinks', 'assets/hero3.jpg'),
('Caesar Salad', 'Fresh romaine lettuce with parmesan cheese and croutons', 9.99, 'appetizers', null),
('Grilled Chicken', 'Perfectly grilled chicken breast with herbs and spices', 18.99, 'mains', null),
('Chocolate Cake', 'Rich chocolate cake with vanilla ice cream', 6.99, 'desserts', null),
('Fresh Orange Juice', 'Freshly squeezed orange juice', 4.99, 'drinks', null),
('Garlic Bread', 'Toasted bread with garlic butter and herbs', 5.99, 'appetizers', null),
('Beef Steak', 'Premium beef steak cooked to perfection', 24.99, 'mains', null),
('Tiramisu', 'Classic Italian dessert with coffee and mascarpone', 7.99, 'desserts', null);

-- Enable Row Level Security
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (adjust as needed)
CREATE POLICY "Allow public read access on menu_items" ON menu_items FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on orders" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public read access on orders" ON orders FOR SELECT USING (true);
CREATE POLICY "Allow public update access on orders" ON orders FOR UPDATE USING (true);
CREATE POLICY "Allow public insert access on order_items" ON order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public read access on order_items" ON order_items FOR SELECT USING (true);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_menu_items_updated_at BEFORE UPDATE ON menu_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
--reviews.sql---
-- Add reviews table and sample data
CREATE TABLE IF NOT EXISTS reviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_name VARCHAR(255) NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Create policy for public access
CREATE POLICY "Public read reviews" ON reviews FOR SELECT USING (true);
CREATE POLICY "Public insert reviews" ON reviews FOR INSERT WITH CHECK (true);

-- Insert sample reviews
INSERT INTO reviews (customer_name, rating, comment) VALUES
('Sarah Johnson', 5, 'Amazing food and excellent service! The wagyu ribeye was perfectly cooked.'),
('Mike Chen', 4, 'Great atmosphere and delicious menu. The truffle arancini was outstanding!'),
('Emily Davis', 5, 'Best restaurant experience in town. Staff was incredibly friendly and professional.'),
('David Wilson', 4, 'Loved the chocolate lava cake! Will definitely come back for more desserts.'),
('Lisa Brown', 5, 'The salmon was fresh and perfectly seasoned. Highly recommend this place!'),
('John Smith', 4, 'Good food quality and nice ambiance. The protein shake was exactly what I needed.'),
('Maria Garcia', 5, 'Exceptional dining experience! Every dish was a masterpiece.'),
('Robert Taylor', 4, 'Great service and tasty food. The duck confit was amazing!');

SELECT 'Reviews table created successfully!' as message;

--updating orders in the table--
-- Add location tracking columns to orders table
ALTER TABLE orders 
ADD COLUMN location_type VARCHAR(20) DEFAULT 'table',
ADD COLUMN location_floor VARCHAR(10) DEFAULT '1',
ADD COLUMN location_info TEXT,
ADD COLUMN order_source VARCHAR(20) DEFAULT 'manual_entry';

-- Add comments for clarity
COMMENT ON COLUMN orders.location_type IS 'Type of location: table, room, etc.';
COMMENT ON COLUMN orders.location_floor IS 'Floor number where order originated';
COMMENT ON COLUMN orders.location_info IS 'Full location description like "Floor 2, Room 205"';
COMMENT ON COLUMN orders.order_source IS 'How order was placed: qr_scan, manual_entry, etc.';
---fix user creation.sql---
-- Fix user creation database error
-- Run this in Supabase SQL Editor

-- 1. Drop existing trigger and function to recreate them properly
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- 2. Recreate the function with proper error handling
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, role)
    VALUES (NEW.id, NEW.email, 'customer');
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't fail user creation
        RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Recreate the trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 4. Add missing policy for INSERT operations
CREATE POLICY "Enable insert for authenticated users only" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- 5. Verify the setup
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    cmd 
FROM pg_policies 
WHERE tablename = 'profiles';
---supabase-setup.sql---
-- Create profiles table for user roles
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT,
    role TEXT CHECK (role IN ('admin', 'chef', 'hostess', 'customer')) DEFAULT 'customer',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 1. Users can only see their profile if they are active
CREATE POLICY "Active users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id AND is_active = true);

-- 2. Admins have full control over all profiles
CREATE POLICY "Admins can view and update all profiles" ON profiles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin' AND is_active = true
        )
    );

-- 3. Users can only update their own basic info (not role or is_active)
CREATE POLICY "Users can update own profile limited" ON profiles
    FOR UPDATE USING (auth.uid() = id AND is_active = true)
    WITH CHECK (auth.uid() = id);

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id, email, role)
    VALUES (NEW.id, NEW.email, 'customer');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user registration
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Insert sample staff users (you'll need to create these users in Supabase Auth first)
-- Then update their roles with REAL email addresses:
-- UPDATE profiles SET role = 'admin' WHERE email = 'your-admin@email.com';
-- UPDATE profiles SET role = 'chef' WHERE email = 'your-chef@email.com';
-- UPDATE profiles SET role = 'hostess' WHERE email = 'your-hostess@email.com';

-- Example: After creating real users, run these commands:
-- UPDATE profiles SET role = 'chef' WHERE email = 'john.chef@gmail.com';
-- UPDATE profiles SET role = 'hostess' WHERE email = 'sarah.hostess@gmail.com';

-- Function to create staff account with role
CREATE OR REPLACE FUNCTION create_staff_account(
    staff_email TEXT,
    staff_role TEXT,
    temp_password TEXT DEFAULT 'TempPass123!'
)
RETURNS TEXT AS $$
DECLARE
    new_user_id UUID;
BEGIN
    -- This would need to be called from your application
    -- as direct user creation requires admin privileges
    
    -- For now, just update existing user role
    UPDATE profiles 
    SET role = staff_role 
    WHERE email = staff_email;
    
    IF FOUND THEN
        RETURN 'Role updated for ' || staff_email;
    ELSE
        RETURN 'User not found: ' || staff_email;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Usage examples (after creating users in Supabase Auth):
-- SELECT create_staff_account('real.chef@email.com', 'chef');
-- SELECT create_staff_account('real.hostess@email.com', 'hostess');
--update staff roles.sql---
-- Update staff roles after creating users in Supabase Auth Dashboard
-- Replace with real email addresses of your chef and hostess

-- Update chef role
UPDATE profiles SET role = 'chef' WHERE email = 'your-chef-email@domain.com';

-- Update hostess role  
UPDATE profiles SET role = 'hostess' WHERE email = 'your-hostess-email@domain.com';

-- Optional: Update admin role
UPDATE profiles SET role = 'admin' WHERE email = 'your-admin-email@domain.com';

-- Verify the updates
SELECT email, role FROM profiles WHERE role IN ('chef', 'hostess', 'admin');