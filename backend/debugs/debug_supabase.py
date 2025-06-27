#!/usr/bin/env python3
"""
Debug script to identify Supabase update issues
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from supabase_client import supabase_manager
from supabase import create_client, Client
from datetime import datetime

# Direct Supabase client for debugging
SUPABASE_URL = "https://iqehkneolpesaqznkqjm.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlxZWhrbmVvbHBlc2Fxem5rcWptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA5MzkxNjgsImV4cCI6MjA2NjUxNTE2OH0.4N69aEfiQdcwW0Jw7061fRlSTF6QtPQQiQybUDFZsIg"
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def test_direct_supabase_operations():
    """Test direct Supabase operations to identify the issue"""
    print("Testing direct Supabase operations...")
    
    # Test 1: Check table structure
    print("\n1. Checking table structure...")
    try:
        # Check vehicle_counts table
        result = supabase.table("vehicle_counts").select("*").limit(1).execute()
        print(f"   vehicle_counts table accessible: {len(result.data)} rows")
        
        # Check tracking_results table
        result = supabase.table("tracking_results").select("*").limit(1).execute()
        print(f"   tracking_results table accessible: {len(result.data)} rows")
        
    except Exception as e:
        print(f"   Error accessing tables: {e}")
    
    # Test 2: Test direct insert and update for vehicle_counts
    print("\n2. Testing direct vehicle_counts operations...")
    test_type = "debug_test"
    test_date = "2025-06-30"
    
    try:
        # Insert
        insert_data = {
            "vehicle_type": test_type,
            "count": 1,
            "date": test_date
        }
        result = supabase.table("vehicle_counts").insert(insert_data).execute()
        print(f"   Direct insert result: {result.data}")
        
        # Try different update approaches
        print("   Trying different update approaches...")
        
        # Approach 1: Update by vehicle_type and date
        try:
            result = supabase.table("vehicle_counts") \
                .update({"count": 10}) \
                .eq("vehicle_type", test_type) \
                .eq("date", test_date) \
                .execute()
            print(f"   Approach 1 (vehicle_type + date): {result.data}")
        except Exception as e:
            print(f"   Approach 1 failed: {e}")
        
        # Approach 2: Update by id
        try:
            # Get the id first
            get_result = supabase.table("vehicle_counts") \
                .select("id") \
                .eq("vehicle_type", test_type) \
                .eq("date", test_date) \
                .execute()
            if get_result.data:
                row_id = get_result.data[0]['id']
                result = supabase.table("vehicle_counts") \
                    .update({"count": 20}) \
                    .eq("id", row_id) \
                    .execute()
                print(f"   Approach 2 (by id): {result.data}")
            else:
                print("   Approach 2: No row found")
        except Exception as e:
            print(f"   Approach 2 failed: {e}")
        
        # Approach 3: Upsert
        try:
            upsert_data = {
                "vehicle_type": test_type,
                "count": 30,
                "date": test_date
            }
            result = supabase.table("vehicle_counts") \
                .upsert(upsert_data, on_conflict="vehicle_type,date") \
                .execute()
            print(f"   Approach 3 (upsert): {result.data}")
        except Exception as e:
            print(f"   Approach 3 failed: {e}")
        
    except Exception as e:
        print(f"   Error in vehicle_counts test: {e}")
    
    # Test 3: Test direct insert and update for tracking_results
    print("\n3. Testing direct tracking_results operations...")
    test_tracker_id = 888
    
    try:
        # Insert
        insert_data = {
            "tracker_id": test_tracker_id,
            "vehicle_type": "debug_car",
            "status": "moving",
            "compliance": 0,
            "reaction_time": None,
            "date": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        result = supabase.table("tracking_results").insert(insert_data).execute()
        print(f"   Direct insert result: {result.data}")
        
        # Try different update approaches
        print("   Trying different update approaches...")
        
        # Approach 1: Update by tracker_id
        try:
            result = supabase.table("tracking_results") \
                .update({"status": "stationary", "compliance": 1}) \
                .eq("tracker_id", test_tracker_id) \
                .execute()
            print(f"   Approach 1 (tracker_id): {result.data}")
        except Exception as e:
            print(f"   Approach 1 failed: {e}")
        
        # Approach 2: Update by id
        try:
            # Get the id first
            get_result = supabase.table("tracking_results") \
                .select("id") \
                .eq("tracker_id", test_tracker_id) \
                .execute()
            if get_result.data:
                row_id = get_result.data[0]['id']
                result = supabase.table("tracking_results") \
                    .update({"status": "entered", "compliance": 0}) \
                    .eq("id", row_id) \
                    .execute()
                print(f"   Approach 2 (by id): {result.data}")
            else:
                print("   Approach 2: No row found")
        except Exception as e:
            print(f"   Approach 2 failed: {e}")
        
        # Approach 3: Upsert
        try:
            upsert_data = {
                "tracker_id": test_tracker_id,
                "vehicle_type": "debug_car",
                "status": "stationary",
                "compliance": 1,
                "reaction_time": 5.5,
                "date": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
            result = supabase.table("tracking_results") \
                .upsert(upsert_data, on_conflict="tracker_id") \
                .execute()
            print(f"   Approach 3 (upsert): {result.data}")
        except Exception as e:
            print(f"   Approach 3 failed: {e}")
        
    except Exception as e:
        print(f"   Error in tracking_results test: {e}")
    
    print("\n✅ Direct Supabase test completed!")

def test_rls_policies():
    """Test if RLS policies are blocking updates"""
    print("\nTesting RLS policies...")
    
    try:
        # Check if we can read
        result = supabase.table("vehicle_counts").select("*").limit(5).execute()
        print(f"   Can read vehicle_counts: {len(result.data)} rows")
        
        result = supabase.table("tracking_results").select("*").limit(5).execute()
        print(f"   Can read tracking_results: {len(result.data)} rows")
        
        # Check if we can insert
        test_data = {
            "vehicle_type": "rls_test",
            "count": 1,
            "date": "2025-06-30"
        }
        result = supabase.table("vehicle_counts").insert(test_data).execute()
        print(f"   Can insert vehicle_counts: {len(result.data)} rows")
        
        # Check if we can update
        if result.data:
            row_id = result.data[0]['id']
            update_result = supabase.table("vehicle_counts") \
                .update({"count": 2}) \
                .eq("id", row_id) \
                .execute()
            print(f"   Can update vehicle_counts: {len(update_result.data)} rows")
        
    except Exception as e:
        print(f"   RLS test error: {e}")

if __name__ == "__main__":
    test_direct_supabase_operations()
    test_rls_policies() 