-- ============================================================
-- RAMZ HOTEL — INVENTORY MANAGEMENT
-- Roles: admin (full), cashier (add/update/log with note),
--        chef/hostess/customer (read only)
-- Run once in Supabase SQL Editor. Safe to re-run.
-- ============================================================


-- ── PART 1: CLEANUP ──────────────────────────────────────────

DROP TRIGGER IF EXISTS trigger_update_stock       ON stock_movements;
DROP TRIGGER IF EXISTS trg_sync_ingredient_stock  ON stock_movements;
DROP TRIGGER IF EXISTS trg_calc_waste_cost        ON waste_records;
DROP TRIGGER IF EXISTS trg_ingredients_updated_at ON ingredients;

DROP FUNCTION IF EXISTS update_ingredient_stock()        CASCADE;
DROP FUNCTION IF EXISTS fn_sync_ingredient_stock()       CASCADE;
DROP FUNCTION IF EXISTS fn_calc_waste_cost()             CASCADE;
DROP FUNCTION IF EXISTS fn_ingredients_updated_at()      CASCADE;
DROP FUNCTION IF EXISTS fn_require_cashier_note()        CASCADE;
DROP FUNCTION IF EXISTS is_manager()                     CASCADE;

DROP VIEW IF EXISTS view_low_stock        CASCADE;
DROP VIEW IF EXISTS view_stock_value      CASCADE;
DROP VIEW IF EXISTS view_movement_history CASCADE;
DROP VIEW IF EXISTS view_waste_summary    CASCADE;

DROP TABLE IF EXISTS purchase_items  CASCADE;
DROP TABLE IF EXISTS purchases       CASCADE;
DROP TABLE IF EXISTS waste_records   CASCADE;
DROP TABLE IF EXISTS stock_movements CASCADE;
DROP TABLE IF EXISTS recipes         CASCADE;
DROP TABLE IF EXISTS ingredients     CASCADE;
DROP TABLE IF EXISTS branches        CASCADE;


-- ── PART 2: TABLES ───────────────────────────────────────────

CREATE TABLE ingredients (
    id              UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
    name            VARCHAR(255)  NOT NULL,
    sku             VARCHAR(50)   UNIQUE,
    category        VARCHAR(100),
    base_unit       VARCHAR(10)   NOT NULL CHECK (base_unit IN ('g','kg','ml','L','pcs')),
    current_stock   DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
    min_stock_level DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (min_stock_level >= 0),
    cost_per_unit   DECIMAL(10,4) NOT NULL DEFAULT 0 CHECK (cost_per_unit >= 0),
    supplier        TEXT,
    last_restocked  TIMESTAMP WITH TIME ZONE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE recipes (
    id                UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
    menu_item_id      UUID          NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    ingredient_id     UUID          NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    quantity_required DECIMAL(12,4) NOT NULL CHECK (quantity_required > 0),
    unit              VARCHAR(10)   NOT NULL CHECK (unit IN ('g','kg','ml','L','pcs')),
    created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (menu_item_id, ingredient_id)
);

CREATE TABLE stock_movements (
    id                UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
    ingredient_id     UUID          NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    user_id           UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
    type              VARCHAR(20)   NOT NULL
                          CHECK (type IN ('purchase','sale','waste','adjustment','return')),
    quantity_change   DECIMAL(12,4) NOT NULL,
    previous_quantity DECIMAL(12,4) NOT NULL,
    new_quantity      DECIMAL(12,4) NOT NULL CHECK (new_quantity >= 0),
    reference_id      UUID,
    notes             TEXT,         -- mandatory for cashier (enforced by trigger below)
    created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE waste_records (
    id            UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
    ingredient_id UUID          NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    quantity      DECIMAL(12,4) NOT NULL CHECK (quantity > 0),
    unit          VARCHAR(10)   NOT NULL,
    reason        VARCHAR(50)   CHECK (reason IN ('spillage','expired','damaged','other')),
    cost_loss     DECIMAL(10,2) DEFAULT 0,
    reported_by   UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE purchases (
    id             UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
    supplier       VARCHAR(255),
    invoice_number VARCHAR(100)  UNIQUE,
    total_cost     DECIMAL(10,2) DEFAULT 0,
    status         VARCHAR(20)   DEFAULT 'received'
                       CHECK (status IN ('pending','received','cancelled')),
    received_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    received_by    UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
    notes          TEXT,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE purchase_items (
    id            UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
    purchase_id   UUID          NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    ingredient_id UUID          NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
    quantity      DECIMAL(12,4) NOT NULL CHECK (quantity > 0),
    unit_cost     DECIMAL(10,4) NOT NULL CHECK (unit_cost >= 0),
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ── PART 3: INDEXES ──────────────────────────────────────────

CREATE INDEX idx_ingredients_name        ON ingredients(name);
CREATE INDEX idx_ingredients_category    ON ingredients(category);
CREATE INDEX idx_ingredients_sku         ON ingredients(sku) WHERE sku IS NOT NULL;
CREATE INDEX idx_stock_movements_ing     ON stock_movements(ingredient_id);
CREATE INDEX idx_stock_movements_date    ON stock_movements(created_at DESC);
CREATE INDEX idx_stock_movements_type    ON stock_movements(type);
CREATE INDEX idx_stock_movements_user    ON stock_movements(user_id);
CREATE INDEX idx_recipes_menu_item       ON recipes(menu_item_id);
CREATE INDEX idx_recipes_ingredient      ON recipes(ingredient_id);
CREATE INDEX idx_waste_ingredient        ON waste_records(ingredient_id);
CREATE INDEX idx_purchase_items_purchase ON purchase_items(purchase_id);


-- ── PART 4: TRIGGERS ─────────────────────────────────────────

-- 4a. Sync ingredients.current_stock after every movement insert
CREATE OR REPLACE FUNCTION fn_sync_ingredient_stock()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE ingredients
    SET
        current_stock  = NEW.new_quantity,
        last_restocked = CASE WHEN NEW.type = 'purchase' THEN NOW() ELSE last_restocked END,
        updated_at     = NOW()
    WHERE id = NEW.ingredient_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_sync_ingredient_stock
    AFTER INSERT ON stock_movements
    FOR EACH ROW EXECUTE FUNCTION fn_sync_ingredient_stock();


-- 4b. Enforce: cashier MUST provide a note on every stock movement
CREATE OR REPLACE FUNCTION fn_require_cashier_note()
RETURNS TRIGGER AS $$
DECLARE
    v_role TEXT;
BEGIN
    SELECT role INTO v_role FROM profiles WHERE id = auth.uid();

    IF v_role = 'cashier' AND (NEW.notes IS NULL OR TRIM(NEW.notes) = '') THEN
        RAISE EXCEPTION 'Cashiers must provide a note describing the stock movement.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_require_cashier_note
    BEFORE INSERT ON stock_movements
    FOR EACH ROW EXECUTE FUNCTION fn_require_cashier_note();


-- 4c. Auto-calculate waste cost_loss from ingredient cost_per_unit
CREATE OR REPLACE FUNCTION fn_calc_waste_cost()
RETURNS TRIGGER AS $$
DECLARE
    v_cost DECIMAL(10,4);
BEGIN
    SELECT cost_per_unit INTO v_cost FROM ingredients WHERE id = NEW.ingredient_id;
    NEW.cost_loss := ROUND((NEW.quantity * COALESCE(v_cost, 0))::NUMERIC, 2);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_calc_waste_cost
    BEFORE INSERT ON waste_records
    FOR EACH ROW EXECUTE FUNCTION fn_calc_waste_cost();


-- 4d. Keep ingredients.updated_at current on direct updates
CREATE OR REPLACE FUNCTION fn_ingredients_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ingredients_updated_at
    BEFORE UPDATE ON ingredients
    FOR EACH ROW EXECUTE FUNCTION fn_ingredients_updated_at();


-- ── PART 5: RLS ──────────────────────────────────────────────

ALTER TABLE ingredients     ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE waste_records   ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases       ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items  ENABLE ROW LEVEL SECURITY;


-- ── ingredients ──────────────────────────────────────────────

-- Everyone can read
CREATE POLICY "ing: read"
    ON ingredients FOR SELECT
    USING (true);

-- Admin + cashier can insert
CREATE POLICY "ing: insert"
    ON ingredients FOR INSERT
    WITH CHECK (
        (SELECT role FROM profiles WHERE id = auth.uid())
        IN ('admin', 'cashier')
    );

-- Admin + cashier can update
CREATE POLICY "ing: update"
    ON ingredients FOR UPDATE
    USING (
        (SELECT role FROM profiles WHERE id = auth.uid())
        IN ('admin', 'cashier')
    );

-- Admin only can delete
CREATE POLICY "ing: delete"
    ON ingredients FOR DELETE
    USING (
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    );


-- ── recipes ──────────────────────────────────────────────────

CREATE POLICY "rec: read"
    ON recipes FOR SELECT
    USING (true);

-- Admin only manages recipes
CREATE POLICY "rec: admin write"
    ON recipes FOR ALL
    USING (
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    )
    WITH CHECK (
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    );


-- ── stock_movements ──────────────────────────────────────────

-- Admin + cashier can read all movements
CREATE POLICY "mov: read"
    ON stock_movements FOR SELECT
    USING (
        (SELECT role FROM profiles WHERE id = auth.uid())
        IN ('admin', 'cashier')
    );

-- Admin can insert without restriction (note optional)
-- Cashier can insert but the trigger enforces a non-empty note
CREATE POLICY "mov: insert"
    ON stock_movements FOR INSERT
    WITH CHECK (
        (SELECT role FROM profiles WHERE id = auth.uid())
        IN ('admin', 'cashier')
    );


-- ── waste_records ────────────────────────────────────────────

CREATE POLICY "waste: read"
    ON waste_records FOR SELECT
    USING (
        (SELECT role FROM profiles WHERE id = auth.uid())
        IN ('admin', 'cashier')
    );

CREATE POLICY "waste: insert"
    ON waste_records FOR INSERT
    WITH CHECK (
        (SELECT role FROM profiles WHERE id = auth.uid())
        IN ('admin', 'cashier')
    );


-- ── purchases ────────────────────────────────────────────────

CREATE POLICY "pur: admin full"
    ON purchases FOR ALL
    USING (
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    )
    WITH CHECK (
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    );


-- ── purchase_items ───────────────────────────────────────────

CREATE POLICY "puritem: admin full"
    ON purchase_items FOR ALL
    USING (
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    )
    WITH CHECK (
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    );


-- ── PART 6: VIEWS ────────────────────────────────────────────

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
    COUNT(*)                                                                     AS item_count,
    SUM(current_stock * cost_per_unit)                                           AS total_value,
    SUM(CASE WHEN current_stock <= 0                     THEN 1 ELSE 0 END)      AS out_of_stock,
    SUM(CASE WHEN current_stock <= min_stock_level
              AND current_stock > 0                      THEN 1 ELSE 0 END)      AS low_stock
FROM ingredients
GROUP BY category
ORDER BY total_value DESC;

CREATE OR REPLACE VIEW view_movement_history AS
SELECT
    sm.id, sm.created_at, sm.type,
    sm.quantity_change, sm.previous_quantity, sm.new_quantity,
    sm.notes, sm.reference_id,
    i.name     AS ingredient_name,
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


-- ── DONE ─────────────────────────────────────────────────────
DO $$
BEGIN
    RAISE NOTICE '✅ RAMZ Inventory ready.';
    RAISE NOTICE '   admin   → full access';
    RAISE NOTICE '   cashier → insert/update ingredients, log movements (note required)';
    RAISE NOTICE '   others  → read only';
END $$;
