-- ============================================================
-- RAMZ HOTEL — Fix inventory & transaction RLS for anon/cashier
-- Run once in Supabase SQL Editor
-- ============================================================

-- ── 1. TRANSACTIONS TABLE ────────────────────────────────────
-- The cashier page operates without Supabase Auth (anon role).
-- Allow anon + authenticated users to insert & read transactions.

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "transactions: anon insert"  ON transactions;
DROP POLICY IF EXISTS "transactions: anon select"  ON transactions;
DROP POLICY IF EXISTS "transactions: auth insert"  ON transactions;
DROP POLICY IF EXISTS "transactions: auth select"  ON transactions;

-- Anyone (anon cashier terminal) can insert a transaction
CREATE POLICY "transactions: anon insert"
    ON transactions FOR INSERT
    TO anon
    WITH CHECK (true);

CREATE POLICY "transactions: auth insert"
    ON transactions FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Anyone can read transactions (needed for daily stats)
CREATE POLICY "transactions: anon select"
    ON transactions FOR SELECT
    TO anon
    USING (true);

CREATE POLICY "transactions: auth select"
    ON transactions FOR SELECT
    TO authenticated
    USING (true);


-- ── 2. STOCK_MOVEMENTS TABLE ─────────────────────────────────
-- The old policy checked profiles.role = 'cashier' but anon users
-- have no profile row, so the check always fails → 401.
-- Replace with open insert (anon cashier terminal) while keeping
-- select restricted to admin/authenticated.

DROP POLICY IF EXISTS "mov: read"   ON stock_movements;
DROP POLICY IF EXISTS "mov: insert" ON stock_movements;

-- Anon (cashier terminal) + authenticated can insert movements
CREATE POLICY "mov: insert anon"
    ON stock_movements FOR INSERT
    TO anon
    WITH CHECK (true);

CREATE POLICY "mov: insert auth"
    ON stock_movements FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Only authenticated users can read movement history
CREATE POLICY "mov: read auth"
    ON stock_movements FOR SELECT
    TO authenticated
    USING (true);


-- ── 3. NUMERIC OVERFLOW — widen quantity columns ─────────────
-- Must drop dependent views first, alter columns, then recreate.

DROP VIEW IF EXISTS view_movement_history CASCADE;
DROP VIEW IF EXISTS view_waste_summary    CASCADE;
DROP VIEW IF EXISTS view_low_stock        CASCADE;
DROP VIEW IF EXISTS view_stock_value      CASCADE;

ALTER TABLE stock_movements
    ALTER COLUMN quantity_change   TYPE DECIMAL(18,4),
    ALTER COLUMN previous_quantity TYPE DECIMAL(18,4),
    ALTER COLUMN new_quantity      TYPE DECIMAL(18,4);

ALTER TABLE recipes
    ALTER COLUMN quantity_required TYPE DECIMAL(18,4);

ALTER TABLE ingredients
    ALTER COLUMN current_stock   TYPE DECIMAL(18,4),
    ALTER COLUMN min_stock_level TYPE DECIMAL(18,4);

-- Recreate views
CREATE OR REPLACE VIEW view_movement_history AS
SELECT
    sm.id, sm.created_at, sm.type,
    sm.quantity_change, sm.previous_quantity, sm.new_quantity,
    sm.notes, sm.reference_id,
    i.name      AS ingredient_name,
    i.base_unit,
    i.category
FROM stock_movements sm
JOIN ingredients i ON i.id = sm.ingredient_id
ORDER BY sm.created_at DESC;

CREATE OR REPLACE VIEW view_waste_summary AS
SELECT
    i.name  AS ingredient_name,
    i.category,
    i.base_unit,
    COUNT(wr.id)      AS waste_incidents,
    SUM(wr.quantity)  AS total_wasted,
    SUM(wr.cost_loss) AS total_cost_loss
FROM waste_records wr
JOIN ingredients i ON i.id = wr.ingredient_id
WHERE wr.created_at >= NOW() - INTERVAL '30 days'
GROUP BY i.id, i.name, i.category, i.base_unit
ORDER BY total_cost_loss DESC;

CREATE OR REPLACE VIEW view_low_stock AS
SELECT
    id, name, category, sku, base_unit,
    current_stock, min_stock_level, cost_per_unit, supplier,
    ROUND(((min_stock_level - current_stock) * cost_per_unit)::NUMERIC, 2) AS restock_cost_estimate
FROM ingredients
WHERE current_stock <= min_stock_level
ORDER BY (min_stock_level - current_stock) DESC;

CREATE OR REPLACE VIEW view_stock_value AS
SELECT
    category,
    COUNT(*)                                                                AS item_count,
    SUM(current_stock * cost_per_unit)                                      AS total_value,
    SUM(CASE WHEN current_stock <= 0                THEN 1 ELSE 0 END)      AS out_of_stock,
    SUM(CASE WHEN current_stock <= min_stock_level
              AND current_stock > 0                THEN 1 ELSE 0 END)      AS low_stock
FROM ingredients
GROUP BY category
ORDER BY total_value DESC;


-- ── 4. DROP the cashier-note trigger (blocks anon inserts) ───
-- trg_require_cashier_note looks up profiles by auth.uid().
-- Anon users have no profile → trigger fires EXCEPTION → 400.
-- Notes are still stored; we just don't enforce them server-side.

DROP TRIGGER IF EXISTS trg_require_cashier_note ON stock_movements;
DROP FUNCTION IF EXISTS fn_require_cashier_note() CASCADE;


-- ── DONE ─────────────────────────────────────────────────────
DO $$
BEGIN
    RAISE NOTICE '✅ RLS fix applied:';
    RAISE NOTICE '   transactions   → anon insert + select allowed';
    RAISE NOTICE '   stock_movements→ anon insert allowed, note trigger removed';
    RAISE NOTICE '   DECIMAL columns widened to (18,4) — overflow fixed';
END $$;
