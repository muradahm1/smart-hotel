-- Fix: Add explicit type casts to function calls
-- Run this if you get "function does not exist" errors

-- Test with explicit casts
SELECT start_shift('test-cashier-001'::TEXT, 'cashier'::TEXT, 500.00::NUMERIC);

-- If that works, the functions exist but need type casting
-- If it fails, you need to run shifts_complete.sql first
