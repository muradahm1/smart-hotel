-- Fix: Allow cashier to read orders with 'served' status
-- Run this in your Supabase SQL Editor

-- Check existing policies on orders table
-- SELECT * FROM pg_policies WHERE tablename = 'orders';

-- Option 1: If you have a specific policy that only allows 'ready', update it
-- Drop the old restrictive policy if it exists
DROP POLICY IF EXISTS "cashier_read_ready_orders" ON orders;
DROP POLICY IF EXISTS "Allow read ready orders" ON orders;
DROP POLICY IF EXISTS "read_ready_orders" ON orders;

-- Option 2: Create/replace a policy that allows reading ready AND served orders
-- For anon users (public access without auth)
CREATE POLICY "allow_read_ready_and_served_orders"
ON orders
FOR SELECT
TO anon
USING (status IN ('pending', 'preparing', 'ready', 'served', 'completed'));

-- If you use authenticated role instead of anon, also run:
CREATE POLICY "allow_read_ready_and_served_orders_auth"
ON orders
FOR SELECT
TO authenticated
USING (status IN ('pending', 'preparing', 'ready', 'served', 'completed'));

-- Option 3: If RLS is causing all the issues, you can also just disable it
-- (only do this for internal staff dashboards, NOT customer-facing pages)
-- ALTER TABLE orders DISABLE ROW LEVEL SECURITY;

-- Also ensure UPDATE policy allows setting status to 'served' and 'completed'
DROP POLICY IF EXISTS "allow_update_order_status" ON orders;

CREATE POLICY "allow_update_order_status"
ON orders
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

CREATE POLICY "allow_update_order_status_auth"
ON orders
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);
