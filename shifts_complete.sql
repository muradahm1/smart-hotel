-- ============================================
-- RAMZ-HOTEL SHIFTS MANAGEMENT SYSTEM
-- Production-Ready SQL Schema
-- ============================================

-- ============================================
-- 1. CREATE SHIFTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS shifts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'chef', 'hostess', 'cashier')),
    start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    starting_cash DECIMAL(10,2) DEFAULT 0 CHECK (starting_cash >= 0),
    ending_cash DECIMAL(10,2) CHECK (ending_cash >= 0),
    total_orders INTEGER DEFAULT 0 CHECK (total_orders >= 0),
    total_sales DECIMAL(10,2) DEFAULT 0 CHECK (total_sales >= 0),
    cash_variance DECIMAL(10,2) DEFAULT 0,
    break_minutes INTEGER DEFAULT 0 CHECK (break_minutes >= 0),
    notes TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT check_shift_closure CHECK (
        (status = 'active' AND end_time IS NULL) OR 
        (status = 'closed' AND end_time IS NOT NULL AND end_time > start_time)
    ),
    CONSTRAINT check_cashier_cash CHECK (
        (role != 'cashier') OR 
        (role = 'cashier' AND starting_cash >= 0)
    )
);

-- ============================================
-- 2. LINK TRANSACTIONS TO SHIFTS
-- ============================================
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL;

-- ============================================
-- 3. CREATE INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_shifts_user_status ON shifts(user_id, status);
CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_shifts_start_time ON shifts(start_time DESC);
CREATE INDEX IF NOT EXISTS idx_shifts_role_status ON shifts(role, status);
CREATE INDEX IF NOT EXISTS idx_transactions_shift ON transactions(shift_id) WHERE shift_id IS NOT NULL;

-- Unique constraint: One active shift per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_shift_per_user 
ON shifts(user_id) WHERE status = 'active';

-- ============================================
-- 4. ENABLE ROW LEVEL SECURITY
-- ============================================
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Staff can start shifts" ON shifts;
DROP POLICY IF EXISTS "Staff can view own shifts" ON shifts;
DROP POLICY IF EXISTS "Staff can update own shifts" ON shifts;
DROP POLICY IF EXISTS "Admins can view all shifts" ON shifts;
DROP POLICY IF EXISTS "Admins can manage all shifts" ON shifts;

-- ============================================
-- 5. CREATE SECURITY POLICIES
-- ============================================

-- Staff can start their own shifts
CREATE POLICY "Staff can start shifts" ON shifts
    FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- Staff can view their own shifts
CREATE POLICY "Staff can view own shifts" ON shifts
    FOR SELECT 
    USING (auth.uid() = user_id);

-- Staff can update their own shifts
CREATE POLICY "Staff can update own shifts" ON shifts
    FOR UPDATE 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Admins can view all shifts
CREATE POLICY "Admins can view all shifts" ON shifts
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

-- Admins can manage all shifts
CREATE POLICY "Admins can manage all shifts" ON shifts
    FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

-- ============================================
-- 6. CREATE TRIGGER FUNCTIONS
-- ============================================

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_shifts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function: Calculate cash variance for cashiers
CREATE OR REPLACE FUNCTION calculate_cash_variance()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.role = 'cashier' AND NEW.ending_cash IS NOT NULL THEN
        -- Variance = Ending Cash - (Starting Cash + Total Sales)
        -- Positive = overage, Negative = shortage
        NEW.cash_variance = NEW.ending_cash - (NEW.starting_cash + NEW.total_sales);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function: Auto-update shift statistics
CREATE OR REPLACE FUNCTION update_shift_statistics()
RETURNS TRIGGER AS $$
DECLARE
    shift_record RECORD;
BEGIN
    -- Get the shift record
    SELECT * INTO shift_record FROM shifts WHERE id = NEW.shift_id;
    
    IF shift_record.status = 'active' THEN
        -- Update total orders and sales
        UPDATE shifts 
        SET 
            total_orders = total_orders + 1,
            total_sales = total_sales + NEW.amount
        WHERE id = NEW.shift_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function: Validate shift closure
CREATE OR REPLACE FUNCTION validate_shift_closure()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'closed' AND OLD.status = 'active' THEN
        -- Ensure end_time is set
        IF NEW.end_time IS NULL THEN
            NEW.end_time = NOW();
        END IF;
        
        -- For cashiers, ensure ending_cash is recorded
        IF NEW.role = 'cashier' AND NEW.ending_cash IS NULL THEN
            RAISE EXCEPTION 'Cashiers must record ending cash before closing shift';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. CREATE TRIGGERS
-- ============================================

-- Trigger: Update updated_at on shift changes
DROP TRIGGER IF EXISTS trigger_update_shifts_updated_at ON shifts;
CREATE TRIGGER trigger_update_shifts_updated_at
    BEFORE UPDATE ON shifts
    FOR EACH ROW
    EXECUTE FUNCTION update_shifts_updated_at();

-- Trigger: Calculate cash variance
DROP TRIGGER IF EXISTS trigger_calculate_cash_variance ON shifts;
CREATE TRIGGER trigger_calculate_cash_variance
    BEFORE UPDATE ON shifts
    FOR EACH ROW
    WHEN (NEW.ending_cash IS NOT NULL)
    EXECUTE FUNCTION calculate_cash_variance();

-- Trigger: Validate shift closure
DROP TRIGGER IF EXISTS trigger_validate_shift_closure ON shifts;
CREATE TRIGGER trigger_validate_shift_closure
    BEFORE UPDATE ON shifts
    FOR EACH ROW
    WHEN (NEW.status = 'closed' AND OLD.status = 'active')
    EXECUTE FUNCTION validate_shift_closure();

-- Trigger: Update shift statistics when transaction is added
DROP TRIGGER IF EXISTS trigger_update_shift_statistics ON transactions;
CREATE TRIGGER trigger_update_shift_statistics
    AFTER INSERT ON transactions
    FOR EACH ROW
    WHEN (NEW.shift_id IS NOT NULL)
    EXECUTE FUNCTION update_shift_statistics();

-- ============================================
-- 8. UTILITY FUNCTIONS
-- ============================================

-- Function: Start a new shift
CREATE OR REPLACE FUNCTION start_shift(
    p_role TEXT,
    p_starting_cash DECIMAL DEFAULT 0
)
RETURNS UUID AS $$
DECLARE
    v_shift_id UUID;
    v_user_id UUID;
BEGIN
    -- Get current user
    v_user_id := auth.uid();
    
    -- Check if user already has an active shift
    IF EXISTS (SELECT 1 FROM shifts WHERE user_id = v_user_id AND status = 'active') THEN
        RAISE EXCEPTION 'User already has an active shift';
    END IF;
    
    -- Create new shift
    INSERT INTO shifts (user_id, role, starting_cash)
    VALUES (v_user_id, p_role, p_starting_cash)
    RETURNING id INTO v_shift_id;
    
    RETURN v_shift_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Close current shift
CREATE OR REPLACE FUNCTION close_shift(
    p_shift_id UUID,
    p_ending_cash DECIMAL DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    
    -- Update shift
    UPDATE shifts
    SET 
        status = 'closed',
        end_time = NOW(),
        ending_cash = COALESCE(p_ending_cash, ending_cash),
        notes = COALESCE(p_notes, notes)
    WHERE id = p_shift_id 
    AND user_id = v_user_id 
    AND status = 'active';
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Shift not found or already closed';
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get active shift for current user
CREATE OR REPLACE FUNCTION get_active_shift()
RETURNS TABLE (
    shift_id UUID,
    role TEXT,
    start_time TIMESTAMP WITH TIME ZONE,
    starting_cash DECIMAL,
    total_orders INTEGER,
    total_sales DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.role,
        s.start_time,
        s.starting_cash,
        s.total_orders,
        s.total_sales
    FROM shifts s
    WHERE s.user_id = auth.uid() 
    AND s.status = 'active'
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get shift summary
CREATE OR REPLACE FUNCTION get_shift_summary(p_shift_id UUID)
RETURNS JSON AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_build_object(
        'shift_id', s.id,
        'user_name', p.name,
        'role', s.role,
        'start_time', s.start_time,
        'end_time', s.end_time,
        'duration_hours', EXTRACT(EPOCH FROM (COALESCE(s.end_time, NOW()) - s.start_time)) / 3600,
        'starting_cash', s.starting_cash,
        'ending_cash', s.ending_cash,
        'total_orders', s.total_orders,
        'total_sales', s.total_sales,
        'cash_variance', s.cash_variance,
        'break_minutes', s.break_minutes,
        'status', s.status,
        'notes', s.notes
    ) INTO v_result
    FROM shifts s
    JOIN profiles p ON s.user_id = p.id
    WHERE s.id = p_shift_id;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 9. REPORTING VIEWS
-- ============================================

-- View: Active shifts
CREATE OR REPLACE VIEW active_shifts AS
SELECT 
    s.id,
    p.name as staff_name,
    s.role,
    s.start_time,
    EXTRACT(EPOCH FROM (NOW() - s.start_time)) / 3600 as hours_worked,
    s.total_orders,
    s.total_sales,
    s.starting_cash
FROM shifts s
JOIN profiles p ON s.user_id = p.id
WHERE s.status = 'active'
ORDER BY s.start_time;

-- View: Daily shift summary
CREATE OR REPLACE VIEW daily_shift_summary AS
SELECT 
    DATE(s.start_time) as shift_date,
    s.role,
    COUNT(*) as total_shifts,
    SUM(s.total_orders) as total_orders,
    SUM(s.total_sales) as total_sales,
    AVG(EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 3600) as avg_hours,
    SUM(CASE WHEN s.role = 'cashier' THEN ABS(s.cash_variance) ELSE 0 END) as total_cash_variance
FROM shifts s
WHERE s.status = 'closed'
GROUP BY DATE(s.start_time), s.role
ORDER BY shift_date DESC, s.role;

-- ============================================
-- 10. SAMPLE DATA (OPTIONAL - FOR TESTING)
-- ============================================

-- Uncomment to insert sample data
/*
-- Insert sample closed shift
INSERT INTO shifts (
    user_id, 
    role, 
    start_time, 
    end_time, 
    starting_cash, 
    ending_cash, 
    total_orders, 
    total_sales, 
    status
) VALUES (
    (SELECT id FROM auth.users LIMIT 1),
    'cashier',
    NOW() - INTERVAL '8 hours',
    NOW() - INTERVAL '1 hour',
    100.00,
    450.00,
    25,
    350.00,
    'closed'
);
*/

-- ============================================
-- 11. VERIFICATION QUERIES
-- ============================================

-- Check if shifts table was created successfully
SELECT 'Shifts table created' as status, COUNT(*) as row_count FROM shifts;

-- Check indexes
SELECT 
    schemaname,
    tablename,
    indexname
FROM pg_indexes 
WHERE tablename = 'shifts'
ORDER BY indexname;

-- Check policies
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd
FROM pg_policies 
WHERE tablename = 'shifts'
ORDER BY policyname;

-- Check triggers
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table
FROM information_schema.triggers
WHERE event_object_table = 'shifts'
ORDER BY trigger_name;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '✅ RAMZ-HOTEL Shifts Management System installed successfully!';
    RAISE NOTICE '📊 Tables: shifts (with RLS enabled)';
    RAISE NOTICE '🔗 Links: transactions.shift_id added';
    RAISE NOTICE '🔒 Policies: 5 security policies created';
    RAISE NOTICE '⚡ Triggers: 4 automatic triggers active';
    RAISE NOTICE '🛠️ Functions: 4 utility functions available';
    RAISE NOTICE '📈 Views: 2 reporting views created';
    RAISE NOTICE '';
    RAISE NOTICE '🚀 Ready to use! Call start_shift() to begin.';
END $$;