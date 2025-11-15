/*
  # ObservAI Initial Database Schema

  ## Overview
  This migration creates the foundational database schema for ObservAI, a restaurant analytics platform with role-based access control.

  ## New Tables
  
  ### `profiles`
  - `id` (uuid, primary key, references auth.users)
  - `email` (text, not null)
  - `full_name` (text)
  - `role` (text, not null) - Either 'manager' or 'employee'
  - `restaurant_id` (uuid, references restaurants)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### `restaurants`
  - `id` (uuid, primary key)
  - `name` (text, not null)
  - `address` (text)
  - `timezone` (text, default 'America/New_York')
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### `shifts`
  - `id` (uuid, primary key)
  - `employee_id` (uuid, references profiles, not null)
  - `restaurant_id` (uuid, references restaurants, not null)
  - `start_time` (timestamptz, not null)
  - `end_time` (timestamptz, not null)
  - `status` (text, default 'approved') - Values: 'approved', 'pending', 'rejected'
  - `notes` (text)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### `payroll_records`
  - `id` (uuid, primary key)
  - `employee_id` (uuid, references profiles, not null)
  - `restaurant_id` (uuid, references restaurants, not null)
  - `pay_period_start` (date, not null)
  - `pay_period_end` (date, not null)
  - `regular_hours` (decimal, default 0)
  - `overtime_hours` (decimal, default 0)
  - `hourly_rate` (decimal, not null)
  - `gross_pay` (decimal, not null)
  - `deductions` (decimal, default 0)
  - `net_pay` (decimal, not null)
  - `paid_at` (timestamptz)
  - `created_at` (timestamptz)

  ### `alerts`
  - `id` (uuid, primary key)
  - `restaurant_id` (uuid, references restaurants, not null)
  - `type` (text, not null) - Values: 'critical', 'warning', 'info'
  - `title` (text, not null)
  - `message` (text, not null)
  - `is_read` (boolean, default false)
  - `created_at` (timestamptz)

  ### `camera_feeds`
  - `id` (uuid, primary key)
  - `restaurant_id` (uuid, references restaurants, not null)
  - `name` (text, not null)
  - `location` (text, not null)
  - `status` (text, default 'active') - Values: 'active', 'offline', 'maintenance'
  - `stream_url` (text)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ## Security
  - Enable RLS on all tables
  - Managers can view/edit data for their restaurant
  - Employees can only view their own shifts and payroll
  - Public access denied by default
*/

-- Create restaurants table
CREATE TABLE IF NOT EXISTS restaurants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  timezone text DEFAULT 'America/New_York',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  role text NOT NULL CHECK (role IN ('manager', 'employee')),
  restaurant_id uuid REFERENCES restaurants ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create shifts table
CREATE TABLE IF NOT EXISTS shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES profiles ON DELETE CASCADE NOT NULL,
  restaurant_id uuid REFERENCES restaurants ON DELETE CASCADE NOT NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  status text DEFAULT 'approved' CHECK (status IN ('approved', 'pending', 'rejected')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;

-- Create payroll_records table
CREATE TABLE IF NOT EXISTS payroll_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES profiles ON DELETE CASCADE NOT NULL,
  restaurant_id uuid REFERENCES restaurants ON DELETE CASCADE NOT NULL,
  pay_period_start date NOT NULL,
  pay_period_end date NOT NULL,
  regular_hours decimal DEFAULT 0,
  overtime_hours decimal DEFAULT 0,
  hourly_rate decimal NOT NULL,
  gross_pay decimal NOT NULL,
  deductions decimal DEFAULT 0,
  net_pay decimal NOT NULL,
  paid_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE payroll_records ENABLE ROW LEVEL SECURITY;

-- Create alerts table
CREATE TABLE IF NOT EXISTS alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES restaurants ON DELETE CASCADE NOT NULL,
  type text NOT NULL CHECK (type IN ('critical', 'warning', 'info')),
  title text NOT NULL,
  message text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- Create camera_feeds table
CREATE TABLE IF NOT EXISTS camera_feeds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES restaurants ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  location text NOT NULL,
  status text DEFAULT 'active' CHECK (status IN ('active', 'offline', 'maintenance')),
  stream_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE camera_feeds ENABLE ROW LEVEL SECURITY;

-- RLS Policies for restaurants
CREATE POLICY "Managers can view their restaurant"
  ON restaurants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.restaurant_id = restaurants.id
      AND profiles.role = 'manager'
    )
  );

CREATE POLICY "Managers can update their restaurant"
  ON restaurants FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.restaurant_id = restaurants.id
      AND profiles.role = 'manager'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.restaurant_id = restaurants.id
      AND profiles.role = 'manager'
    )
  );

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Managers can view profiles in their restaurant"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles AS mgr
      WHERE mgr.id = auth.uid()
      AND mgr.role = 'manager'
      AND mgr.restaurant_id = profiles.restaurant_id
    )
  );

-- RLS Policies for shifts
CREATE POLICY "Employees can view own shifts"
  ON shifts FOR SELECT
  TO authenticated
  USING (employee_id = auth.uid());

CREATE POLICY "Employees can insert own shift requests"
  ON shifts FOR INSERT
  TO authenticated
  WITH CHECK (employee_id = auth.uid());

CREATE POLICY "Managers can view shifts in their restaurant"
  ON shifts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'manager'
      AND profiles.restaurant_id = shifts.restaurant_id
    )
  );

CREATE POLICY "Managers can update shifts in their restaurant"
  ON shifts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'manager'
      AND profiles.restaurant_id = shifts.restaurant_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'manager'
      AND profiles.restaurant_id = shifts.restaurant_id
    )
  );

CREATE POLICY "Managers can delete shifts in their restaurant"
  ON shifts FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'manager'
      AND profiles.restaurant_id = shifts.restaurant_id
    )
  );

-- RLS Policies for payroll_records
CREATE POLICY "Employees can view own payroll"
  ON payroll_records FOR SELECT
  TO authenticated
  USING (employee_id = auth.uid());

CREATE POLICY "Managers can view payroll in their restaurant"
  ON payroll_records FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'manager'
      AND profiles.restaurant_id = payroll_records.restaurant_id
    )
  );

CREATE POLICY "Managers can insert payroll in their restaurant"
  ON payroll_records FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'manager'
      AND profiles.restaurant_id = payroll_records.restaurant_id
    )
  );

CREATE POLICY "Managers can update payroll in their restaurant"
  ON payroll_records FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'manager'
      AND profiles.restaurant_id = payroll_records.restaurant_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'manager'
      AND profiles.restaurant_id = payroll_records.restaurant_id
    )
  );

-- RLS Policies for alerts
CREATE POLICY "Managers can view alerts for their restaurant"
  ON alerts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'manager'
      AND profiles.restaurant_id = alerts.restaurant_id
    )
  );

CREATE POLICY "Managers can insert alerts for their restaurant"
  ON alerts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'manager'
      AND profiles.restaurant_id = alerts.restaurant_id
    )
  );

CREATE POLICY "Managers can update alerts for their restaurant"
  ON alerts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'manager'
      AND profiles.restaurant_id = alerts.restaurant_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'manager'
      AND profiles.restaurant_id = alerts.restaurant_id
    )
  );

CREATE POLICY "Managers can delete alerts for their restaurant"
  ON alerts FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'manager'
      AND profiles.restaurant_id = alerts.restaurant_id
    )
  );

-- RLS Policies for camera_feeds
CREATE POLICY "Managers can view camera feeds for their restaurant"
  ON camera_feeds FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'manager'
      AND profiles.restaurant_id = camera_feeds.restaurant_id
    )
  );

CREATE POLICY "Managers can insert camera feeds for their restaurant"
  ON camera_feeds FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'manager'
      AND profiles.restaurant_id = camera_feeds.restaurant_id
    )
  );

CREATE POLICY "Managers can update camera feeds for their restaurant"
  ON camera_feeds FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'manager'
      AND profiles.restaurant_id = camera_feeds.restaurant_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'manager'
      AND profiles.restaurant_id = camera_feeds.restaurant_id
    )
  );

CREATE POLICY "Managers can delete camera feeds for their restaurant"
  ON camera_feeds FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'manager'
      AND profiles.restaurant_id = camera_feeds.restaurant_id
    )
  );

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_restaurant_id ON profiles(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_shifts_employee_id ON shifts(employee_id);
CREATE INDEX IF NOT EXISTS idx_shifts_restaurant_id ON shifts(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_shifts_start_time ON shifts(start_time);
CREATE INDEX IF NOT EXISTS idx_payroll_employee_id ON payroll_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_restaurant_id ON payroll_records(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_alerts_restaurant_id ON alerts(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at);
CREATE INDEX IF NOT EXISTS idx_camera_feeds_restaurant_id ON camera_feeds(restaurant_id);
