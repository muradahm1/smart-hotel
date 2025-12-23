// Environment Configuration Template
// Copy this file to config.js and fill in your actual credentials
// DO NOT commit config.js to version control

// Supabase Configuration
window.SUPABASE_URL = 'YOUR_SUPABASE_URL_HERE';
window.SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY_HERE';

// Security Notes:
// 1. Never commit actual credentials to version control
// 2. Use environment variables in production
// 3. Implement proper RLS policies in Supabase
// 4. Regularly rotate your API keys

// Required Supabase RLS Policies:
/*
-- Enable RLS on all tables
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Admin access policy
CREATE POLICY "Admin access" ON menu_items FOR ALL TO authenticated 
USING (auth.jwt() ->> 'role' = 'admin') 
WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- Public read access for menu items
CREATE POLICY "Public read access" ON menu_items FOR SELECT TO anon USING (is_available = true);

-- Customer order access
CREATE POLICY "Customer order access" ON orders FOR ALL TO anon USING (true);
*/