/*
  # Add Payroll Tables

  1. New Tables
    - `payroll_records`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `pay_period_start` (date)
      - `pay_period_end` (date)
      - `regular_hours` (numeric)
      - `regular_rate` (numeric)
      - `overtime_hours` (numeric)
      - `overtime_rate` (numeric)
      - `tips` (numeric)
      - `bonuses` (numeric)
      - `gross_pay` (numeric)
      - `deductions` (numeric)
      - `net_pay` (numeric)
      - `status` (text: pending, processed, paid)
      - `payment_date` (date, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on payroll_records
    - Employees can view their own payroll records
    - Managers can view and manage all payroll records
*/

CREATE TABLE IF NOT EXISTS payroll_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  pay_period_start date NOT NULL,
  pay_period_end date NOT NULL,
  regular_hours numeric(10,2) NOT NULL DEFAULT 0,
  regular_rate numeric(10,2) NOT NULL DEFAULT 0,
  overtime_hours numeric(10,2) NOT NULL DEFAULT 0,
  overtime_rate numeric(10,2) NOT NULL DEFAULT 0,
  tips numeric(10,2) NOT NULL DEFAULT 0,
  bonuses numeric(10,2) NOT NULL DEFAULT 0,
  gross_pay numeric(10,2) NOT NULL DEFAULT 0,
  deductions numeric(10,2) NOT NULL DEFAULT 0,
  net_pay numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'paid')),
  payment_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payroll_records_user_id_idx ON payroll_records(user_id);
CREATE INDEX IF NOT EXISTS payroll_records_pay_period_idx ON payroll_records(pay_period_start, pay_period_end);
CREATE INDEX IF NOT EXISTS payroll_records_status_idx ON payroll_records(status);

ALTER TABLE payroll_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payroll records"
  ON payroll_records FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Managers can view all payroll records"
  ON payroll_records FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'manager'
    )
  );

CREATE POLICY "Managers can insert payroll records"
  ON payroll_records FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'manager'
    )
  );

CREATE POLICY "Managers can update payroll records"
  ON payroll_records FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'manager'
    )
  );
