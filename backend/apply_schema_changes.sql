-- Apply schema changes to fix upsert operations
-- Run this in your Supabase SQL editor

-- Add unique constraint to tracker_id in tracking_results
ALTER TABLE tracking_results ADD CONSTRAINT tracking_results_tracker_id_unique UNIQUE (tracker_id);

-- Add unique constraint to (vehicle_type, date) in vehicle_counts
ALTER TABLE vehicle_counts ADD CONSTRAINT vehicle_counts_vehicle_type_date_unique UNIQUE (vehicle_type, date);

-- Add update policies for RLS
CREATE POLICY "Allow public update access to tracking_results" ON tracking_results
    FOR UPDATE USING (true);

CREATE POLICY "Allow public update access to vehicle_counts" ON vehicle_counts
    FOR UPDATE USING (true);

-- Verify the changes
SELECT 
    table_name, 
    constraint_name, 
    constraint_type 
FROM information_schema.table_constraints 
WHERE table_name IN ('tracking_results', 'vehicle_counts') 
    AND constraint_type = 'UNIQUE';

-- Check RLS policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename IN ('tracking_results', 'vehicle_counts'); 