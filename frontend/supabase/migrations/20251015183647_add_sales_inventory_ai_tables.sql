/*
  # Add Sales, Inventory, and AI Analytics Tables

  1. New Tables
    - `sales_transactions`
      - `id` (uuid, primary key)
      - `restaurant_id` (uuid, references restaurants)
      - `transaction_date` (timestamptz)
      - `total_amount` (decimal)
      - `payment_method` (text)
      - `items_count` (integer)
      - `customer_type` (text)
      
    - `menu_items`
      - `id` (uuid, primary key)
      - `restaurant_id` (uuid, references restaurants)
      - `name` (text)
      - `category` (text)
      - `price` (decimal)
      - `cost` (decimal)
      - `is_active` (boolean)
      
    - `sales_items`
      - `id` (uuid, primary key)
      - `transaction_id` (uuid, references sales_transactions)
      - `menu_item_id` (uuid, references menu_items)
      - `quantity` (integer)
      - `unit_price` (decimal)
      - `total_price` (decimal)
      
    - `inventory_items`
      - `id` (uuid, primary key)
      - `restaurant_id` (uuid, references restaurants)
      - `name` (text)
      - `category` (text)
      - `current_stock` (decimal)
      - `unit_of_measure` (text)
      - `reorder_point` (decimal)
      - `unit_cost` (decimal)
      - `supplier` (text)
      - `last_ordered_at` (timestamptz)
      
    - `inventory_transactions`
      - `id` (uuid, primary key)
      - `inventory_item_id` (uuid, references inventory_items)
      - `transaction_type` (text) - 'purchase', 'usage', 'waste', 'adjustment'
      - `quantity` (decimal)
      - `unit_cost` (decimal)
      - `total_cost` (decimal)
      - `notes` (text)
      - `transaction_date` (timestamptz)
      
    - `camera_analytics`
      - `id` (uuid, primary key)
      - `camera_feed_id` (uuid, references camera_feeds)
      - `timestamp` (timestamptz)
      - `visitor_count` (integer)
      - `demographics` (jsonb)
      - `dwell_time_avg` (decimal)
      - `hot_zones` (jsonb)
      
    - `ai_recommendations`
      - `id` (uuid, primary key)
      - `restaurant_id` (uuid, references restaurants)
      - `priority` (text) - 'high', 'medium', 'low'
      - `category` (text) - 'pricing', 'staffing', 'inventory', 'menu', 'operations'
      - `title` (text)
      - `description` (text)
      - `impact_prediction` (text)
      - `estimated_value` (decimal)
      - `status` (text) - 'active', 'dismissed', 'implemented'
      - `created_at` (timestamptz)
      - `implemented_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Managers can view/manage all data for their restaurant
    - Employees have no access to sales/inventory/AI data
*/

-- Create sales_transactions table
CREATE TABLE IF NOT EXISTS sales_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES restaurants ON DELETE CASCADE NOT NULL,
  transaction_date timestamptz DEFAULT now() NOT NULL,
  total_amount decimal NOT NULL,
  payment_method text DEFAULT 'cash' CHECK (payment_method IN ('cash', 'credit', 'debit', 'mobile')),
  items_count integer DEFAULT 1,
  customer_type text DEFAULT 'dine-in' CHECK (customer_type IN ('dine-in', 'takeout', 'delivery')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE sales_transactions ENABLE ROW LEVEL SECURITY;

-- Create menu_items table
CREATE TABLE IF NOT EXISTS menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES restaurants ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  category text NOT NULL,
  price decimal NOT NULL,
  cost decimal DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;

-- Create sales_items table
CREATE TABLE IF NOT EXISTS sales_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid REFERENCES sales_transactions ON DELETE CASCADE NOT NULL,
  menu_item_id uuid REFERENCES menu_items ON DELETE CASCADE NOT NULL,
  quantity integer DEFAULT 1 NOT NULL,
  unit_price decimal NOT NULL,
  total_price decimal NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE sales_items ENABLE ROW LEVEL SECURITY;

-- Create inventory_items table
CREATE TABLE IF NOT EXISTS inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES restaurants ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  category text NOT NULL,
  current_stock decimal DEFAULT 0 NOT NULL,
  unit_of_measure text DEFAULT 'units' NOT NULL,
  reorder_point decimal DEFAULT 0,
  unit_cost decimal DEFAULT 0,
  supplier text,
  last_ordered_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;

-- Create inventory_transactions table
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id uuid REFERENCES inventory_items ON DELETE CASCADE NOT NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('purchase', 'usage', 'waste', 'adjustment')),
  quantity decimal NOT NULL,
  unit_cost decimal DEFAULT 0,
  total_cost decimal DEFAULT 0,
  notes text,
  transaction_date timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;

-- Create camera_analytics table
CREATE TABLE IF NOT EXISTS camera_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  camera_feed_id uuid REFERENCES camera_feeds ON DELETE CASCADE NOT NULL,
  timestamp timestamptz DEFAULT now() NOT NULL,
  visitor_count integer DEFAULT 0,
  demographics jsonb DEFAULT '{}'::jsonb,
  dwell_time_avg decimal DEFAULT 0,
  hot_zones jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE camera_analytics ENABLE ROW LEVEL SECURITY;

-- Create ai_recommendations table
CREATE TABLE IF NOT EXISTS ai_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES restaurants ON DELETE CASCADE NOT NULL,
  priority text NOT NULL CHECK (priority IN ('high', 'medium', 'low')),
  category text NOT NULL CHECK (category IN ('pricing', 'staffing', 'inventory', 'menu', 'operations')),
  title text NOT NULL,
  description text NOT NULL,
  impact_prediction text NOT NULL,
  estimated_value decimal DEFAULT 0,
  status text DEFAULT 'active' CHECK (status IN ('active', 'dismissed', 'implemented')),
  created_at timestamptz DEFAULT now(),
  implemented_at timestamptz
);

ALTER TABLE ai_recommendations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sales_transactions
CREATE POLICY "Managers can view sales for their restaurant"
  ON sales_transactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'manager'
      AND profiles.restaurant_id = sales_transactions.restaurant_id
    )
  );

CREATE POLICY "Managers can insert sales for their restaurant"
  ON sales_transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'manager'
      AND profiles.restaurant_id = sales_transactions.restaurant_id
    )
  );

-- RLS Policies for menu_items
CREATE POLICY "Managers can view menu items for their restaurant"
  ON menu_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'manager'
      AND profiles.restaurant_id = menu_items.restaurant_id
    )
  );

CREATE POLICY "Managers can manage menu items for their restaurant"
  ON menu_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'manager'
      AND profiles.restaurant_id = menu_items.restaurant_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'manager'
      AND profiles.restaurant_id = menu_items.restaurant_id
    )
  );

-- RLS Policies for sales_items
CREATE POLICY "Managers can view sales items for their restaurant"
  ON sales_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales_transactions st
      JOIN profiles ON profiles.id = auth.uid()
      WHERE st.id = sales_items.transaction_id
      AND profiles.role = 'manager'
      AND profiles.restaurant_id = st.restaurant_id
    )
  );

-- RLS Policies for inventory_items
CREATE POLICY "Managers can view inventory for their restaurant"
  ON inventory_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'manager'
      AND profiles.restaurant_id = inventory_items.restaurant_id
    )
  );

CREATE POLICY "Managers can manage inventory for their restaurant"
  ON inventory_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'manager'
      AND profiles.restaurant_id = inventory_items.restaurant_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'manager'
      AND profiles.restaurant_id = inventory_items.restaurant_id
    )
  );

-- RLS Policies for inventory_transactions
CREATE POLICY "Managers can view inventory transactions for their restaurant"
  ON inventory_transactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM inventory_items ii
      JOIN profiles ON profiles.id = auth.uid()
      WHERE ii.id = inventory_transactions.inventory_item_id
      AND profiles.role = 'manager'
      AND profiles.restaurant_id = ii.restaurant_id
    )
  );

CREATE POLICY "Managers can insert inventory transactions for their restaurant"
  ON inventory_transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM inventory_items ii
      JOIN profiles ON profiles.id = auth.uid()
      WHERE ii.id = inventory_transactions.inventory_item_id
      AND profiles.role = 'manager'
      AND profiles.restaurant_id = ii.restaurant_id
    )
  );

-- RLS Policies for camera_analytics
CREATE POLICY "Managers can view camera analytics for their restaurant"
  ON camera_analytics FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM camera_feeds cf
      JOIN profiles ON profiles.id = auth.uid()
      WHERE cf.id = camera_analytics.camera_feed_id
      AND profiles.role = 'manager'
      AND profiles.restaurant_id = cf.restaurant_id
    )
  );

-- RLS Policies for ai_recommendations
CREATE POLICY "Managers can view AI recommendations for their restaurant"
  ON ai_recommendations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'manager'
      AND profiles.restaurant_id = ai_recommendations.restaurant_id
    )
  );

CREATE POLICY "Managers can update AI recommendations for their restaurant"
  ON ai_recommendations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'manager'
      AND profiles.restaurant_id = ai_recommendations.restaurant_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'manager'
      AND profiles.restaurant_id = ai_recommendations.restaurant_id
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sales_transactions_restaurant_id ON sales_transactions(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_sales_transactions_date ON sales_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant_id ON menu_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_sales_items_transaction_id ON sales_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_restaurant_id ON inventory_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_item_id ON inventory_transactions(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_date ON inventory_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_camera_analytics_feed_id ON camera_analytics(camera_feed_id);
CREATE INDEX IF NOT EXISTS idx_camera_analytics_timestamp ON camera_analytics(timestamp);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_restaurant_id ON ai_recommendations(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_status ON ai_recommendations(status);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_priority ON ai_recommendations(priority);
