-- Inventory Management System for RAMZ-HOTEL

-- 1. Branches (Multi-branch support)
CREATE TABLE IF NOT EXISTS branches (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Ingredients (The "Raw" Stock)
CREATE TABLE IF NOT EXISTS ingredients (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    branch_id UUID REFERENCES branches(id) DEFAULT '00000000-0000-0000-0000-000000000000', -- Default main branch
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(50) UNIQUE,
    category VARCHAR(50), -- 'Coffee Beans', 'Milk', 'Syrups', etc.
    base_unit VARCHAR(10) NOT NULL, -- 'g', 'ml', 'pcs'
    current_stock DECIMAL(12,2) DEFAULT 0,
    min_stock_level DECIMAL(12,2) DEFAULT 0,
    cost_per_unit DECIMAL(10,2) DEFAULT 0,
    supplier TEXT,
    last_restocked TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Recipes (Mapping Menu Items to Ingredients)
CREATE TABLE IF NOT EXISTS recipes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    menu_item_id UUID REFERENCES menu_items(id) ON DELETE CASCADE,
    ingredient_id UUID REFERENCES ingredients(id) ON DELETE CASCADE,
    quantity_required DECIMAL(12,2) NOT NULL,
    unit VARCHAR(10) NOT NULL, -- 'g', 'ml', 'pcs'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Stock Movements (The Ledger)
CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ingredient_id UUID REFERENCES ingredients(id),
    user_id UUID REFERENCES auth.users(id),
    type VARCHAR(20) NOT NULL, -- 'sale', 'purchase', 'waste', 'adjustment', 'return'
    quantity_change DECIMAL(12,2) NOT NULL,
    previous_quantity DECIMAL(12,2),
    new_quantity DECIMAL(12,2),
    reference_id UUID, -- order_id or purchase_id
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Waste Records
CREATE TABLE IF NOT EXISTS waste_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ingredient_id UUID REFERENCES ingredients(id),
    quantity DECIMAL(12,2) NOT NULL,
    reason TEXT, -- 'spillage', 'expired', 'damaged'
    cost_loss DECIMAL(10,2),
    reported_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Purchase Orders
CREATE TABLE IF NOT EXISTS purchases (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    supplier VARCHAR(255),
    invoice_number VARCHAR(100),
    total_cost DECIMAL(10,2),
    status VARCHAR(20) DEFAULT 'received',
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    received_by UUID REFERENCES auth.users(id)
);

-- 7. Purchase Items
CREATE TABLE IF NOT EXISTS purchase_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    purchase_id UUID REFERENCES purchases(id) ON DELETE CASCADE,
    ingredient_id UUID REFERENCES ingredients(id),
    quantity DECIMAL(12,2) NOT NULL,
    unit_cost DECIMAL(10,2) NOT NULL
);

-- RLS POLICIES
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view inventory" ON ingredients FOR SELECT USING (true);
CREATE POLICY "Managers can update inventory" ON ingredients FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
);

-- Function to update stock on movement
CREATE OR REPLACE FUNCTION update_ingredient_stock()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE ingredients 
    SET current_stock = NEW.new_quantity,
        updated_at = NOW()
    WHERE id = NEW.ingredient_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_stock
AFTER INSERT ON stock_movements
FOR EACH ROW EXECUTE FUNCTION update_ingredient_stock();

-- Add branch_id to profiles for multi-tenancy
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);