import { pool } from "./db.js";

const migration = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone varchar(11) UNIQUE,
  email varchar(254) UNIQUE,
  password_hash text,
  display_name varchar(100),
  google_subject varchar(255) UNIQUE,
  role varchar(20) NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
  phone_verified_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (phone IS NOT NULL OR email IS NOT NULL)
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS username varchar(80);
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name varchar(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name varchar(100);
UPDATE users
SET first_name = split_part(display_name, ' ', 1),
    last_name = NULLIF(trim(substring(display_name from length(split_part(display_name, ' ', 1)) + 1)), '')
WHERE display_name IS NOT NULL AND first_name IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique
  ON users(lower(username)) WHERE username IS NOT NULL;

CREATE TABLE IF NOT EXISTS admin_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title varchar(100) NOT NULL,
  slug varchar(80) NOT NULL UNIQUE,
  is_system boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_role_permissions (
  role_id uuid NOT NULL REFERENCES admin_roles(id) ON DELETE CASCADE,
  permission_key varchar(80) NOT NULL,
  PRIMARY KEY (role_id, permission_key)
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_role_id uuid REFERENCES admin_roles(id) ON DELETE SET NULL;

INSERT INTO admin_roles (title,slug,is_system,is_active) VALUES
  ('مدیر کل','admin',true,true),
  ('کاربر سفارشات','orders',true,true),
  ('کارشناس SEO','seo',true,true)
ON CONFLICT (slug) DO UPDATE SET title=EXCLUDED.title,is_system=true,is_active=true,updated_at=now();

INSERT INTO admin_role_permissions (role_id,permission_key)
SELECT r.id,p.permission_key
FROM admin_roles r
JOIN (VALUES
  ('admin','dashboard'),('admin','users'),('admin','roles'),('admin','products'),
  ('admin','categories'),('admin','orders'),('admin','payment-methods'),
  ('admin','discount-codes'),('admin','articles'),('admin','tags'),('admin','site-settings'),
  ('orders','dashboard'),('orders','orders'),
  ('seo','dashboard'),('seo','products'),('seo','categories'),('seo','articles'),('seo','tags'),
  ('seo','site-settings')
) AS p(role_slug,permission_key) ON p.role_slug=r.slug
ON CONFLICT DO NOTHING;

UPDATE users SET admin_role_id=(SELECT id FROM admin_roles WHERE slug='admin')
WHERE role='admin' AND admin_role_id IS NULL;

CREATE TABLE IF NOT EXISTS user_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label varchar(40) NOT NULL DEFAULT 'خانه',
  recipient_name varchar(100) NOT NULL,
  phone varchar(11) NOT NULL,
  province varchar(80) NOT NULL,
  city varchar(80) NOT NULL,
  postal_code varchar(10) NOT NULL,
  address_line varchar(500) NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS user_addresses_one_default
  ON user_addresses(user_id) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS user_addresses_user_id_idx ON user_addresses(user_id);

CREATE TABLE IF NOT EXISTS user_sessions (
  token_hash char(64) PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_sessions_user_id_idx ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS user_sessions_expires_at_idx ON user_sessions(expires_at);

CREATE TABLE IF NOT EXISTS password_reset_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash char(64) NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts smallint NOT NULL DEFAULT 0,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS password_reset_codes_user_idx
  ON password_reset_codes(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS site_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  brand_name varchar(120) NOT NULL DEFAULT 'اورنزا',
  brand_name_en varchar(120) NOT NULL DEFAULT 'ORENZA',
  brand_tagline varchar(240) NOT NULL DEFAULT 'قهوه تازه، برای سلیقه تو.',
  support_phone varchar(30) NOT NULL DEFAULT '09103060396',
  support_email varchar(254) NOT NULL DEFAULT 'order.orenzacoffee@gmail.com',
  whatsapp_url varchar(500) NOT NULL DEFAULT 'https://wa.me/989103060396',
  bale_url varchar(500) NOT NULL DEFAULT 'https://ble.ir/khoobrooz',
  instagram_url varchar(500) NOT NULL DEFAULT 'https://instagram.com/orenza.ir',
  address text,
  footer_heading varchar(300) NOT NULL DEFAULT 'هر انتخابی داستان خودش را دارد؛ بیایید داستان مناسب شما را پیدا کنیم.',
  footer_description varchar(500) NOT NULL DEFAULT 'طعم دلخواه و دستگاهت را بگو؛ ترکیب مناسب را با هم پیدا می‌کنیم.',
  footer_copyright varchar(300) NOT NULL DEFAULT '© ۲۰۲۶ قهوه اورنزا؛ تمامی حقوق محفوظ است.',
  logo_url varchar(500),
  favicon_url varchar(500) NOT NULL DEFAULT '/favicon.svg',
  homepage_seo_title varchar(220) NOT NULL DEFAULT 'خرید قهوه تازه رست با آسیاب دلخواه',
  homepage_seo_description varchar(500) NOT NULL DEFAULT 'قهوه تازه رست اورنزا را با ترکیب عربیکا و روبوستا، درجه رست و آسیاب مناسب دستگاهتان سفارش دهید؛ آماده‌سازی تازه و ارسال سراسر ایران.',
  homepage_seo_keywords text[] NOT NULL DEFAULT ARRAY['خرید قهوه تازه رست','قهوه اسپرسو','قهوه عربیکا','قهوه روبوستا','آسیاب قهوه','قهوه اورنزا'],
  homepage_og_image_url varchar(500) NOT NULL DEFAULT '/images/orenza-leopard-label.png',
  search_indexing_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO site_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS service_scripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title varchar(120) NOT NULL,
  provider varchar(30) NOT NULL CHECK (provider IN ('gtm','ga4','searchConsole')),
  service_key varchar(220) NOT NULL,
  placement varchar(20) NOT NULL DEFAULT 'head' CHECK (placement IN ('head','body')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS service_scripts_provider_key_unique
  ON service_scripts(provider, service_key);

INSERT INTO service_scripts (title,provider,service_key,placement,is_active)
VALUES ('Google Tag Manager','gtm','GTM-MZ387RQX','head',true)
ON CONFLICT (provider,service_key) DO NOTHING;
CREATE INDEX IF NOT EXISTS password_reset_codes_expiry_idx
  ON password_reset_codes(expires_at);

CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title varchar(160) NOT NULL,
  slug varchar(180) NOT NULL UNIQUE,
  description text,
  seo_title varchar(220),
  seo_description varchar(500),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_fa varchar(220) NOT NULL,
  title_en varchar(220) NOT NULL,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  description text NOT NULL,
  roast_type varchar(30) NOT NULL CHECK (roast_type IN ('light','medium','mediumDark','dark')),
  coffee_type varchar(20) NOT NULL CHECK (coffee_type IN ('bean','ground')),
  grind_type varchar(30) NOT NULL DEFAULT 'none' CHECK (grind_type IN ('espresso','mokaPot','frenchPress','turkish','filter','none')),
  blend_type varchar(120) NOT NULL,
  sort_order smallint NOT NULL DEFAULT 100,
  sale_type varchar(20) NOT NULL DEFAULT 'weighted' CHECK (sale_type IN ('weighted','packaged')),
  package_weight_grams integer NOT NULL DEFAULT 250 CHECK (package_weight_grams IN (250,500,1000)),
  stock_status varchar(20) NOT NULL DEFAULT 'inStock' CHECK (stock_status IN ('inStock','outOfStock')),
  purchase_price_per_kg bigint NOT NULL DEFAULT 0 CHECK (purchase_price_per_kg >= 0),
  sale_price_per_kg bigint NOT NULL DEFAULT 0 CHECK (sale_price_per_kg >= 0),
  price_per_100g bigint NOT NULL DEFAULT 0 CHECK (price_per_100g >= 0),
  price_per_250g bigint NOT NULL DEFAULT 0 CHECK (price_per_250g >= 0),
  price_per_500g bigint NOT NULL DEFAULT 0 CHECK (price_per_500g >= 0),
  price_per_1000g bigint NOT NULL DEFAULT 0 CHECK (price_per_1000g >= 0),
  is_active boolean NOT NULL DEFAULT true,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS products_category_idx ON products(category_id);
CREATE INDEX IF NOT EXISTS products_active_idx ON products(is_active);
ALTER TABLE products ADD COLUMN IF NOT EXISTS purchase_price_per_kg bigint NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sale_price_per_kg bigint NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sort_order smallint NOT NULL DEFAULT 100;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sale_type varchar(20) NOT NULL DEFAULT 'weighted';
ALTER TABLE products ADD COLUMN IF NOT EXISTS package_weight_grams integer NOT NULL DEFAULT 250;
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_status varchar(20) NOT NULL DEFAULT 'inStock';

CREATE TABLE IF NOT EXISTS payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title varchar(120) NOT NULL,
  type varchar(30) NOT NULL DEFAULT 'cardToCard' CHECK (type IN ('cardToCard','bankGateway','zarinpal')),
  card_number varchar(24),
  account_owner varchar(160),
  bank_name varchar(100),
  merchant_id varchar(80),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_payment_method_type ON payment_methods(type) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS payment_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_method_id uuid NOT NULL REFERENCES payment_methods(id) ON DELETE CASCADE,
  card_number varchar(16) NOT NULL,
  sheba_number varchar(26) NOT NULL,
  account_number varchar(40) NOT NULL,
  account_owner varchar(160) NOT NULL,
  bank_name varchar(100) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(payment_method_id, card_number)
);
CREATE INDEX IF NOT EXISTS payment_cards_method_idx ON payment_cards(payment_method_id, is_active);

CREATE TABLE IF NOT EXISTS discount_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(60) NOT NULL UNIQUE,
  type varchar(20) NOT NULL CHECK (type IN ('percent','fixed')),
  value bigint NOT NULL CHECK (value > 0),
  min_order_amount bigint NOT NULL DEFAULT 0 CHECK (min_order_amount >= 0),
  max_usage_count integer,
  used_count integer NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  start_date timestamptz NOT NULL,
  end_date timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date > start_date),
  CHECK (max_usage_count IS NULL OR max_usage_count > 0)
);
CREATE INDEX IF NOT EXISTS discount_codes_lookup_idx ON discount_codes(code, is_active);

CREATE TABLE IF NOT EXISTS tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title varchar(120) NOT NULL,
  slug varchar(160) NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title varchar(240) NOT NULL,
  slug varchar(180) NOT NULL UNIQUE,
  summary text NOT NULL,
  content text NOT NULL,
  image_url text,
  tags text[] NOT NULL DEFAULT '{}',
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS articles_published_idx ON articles(is_published, created_at DESC);

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number varchar(30) NOT NULL UNIQUE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  customer_name varchar(160) NOT NULL,
  customer_phone varchar(11) NOT NULL,
  customer_address text NOT NULL,
  customer_province varchar(80),
  customer_city varchar(80),
  customer_postal_code varchar(10),
  shipping_method varchar(30) NOT NULL CHECK (shipping_method IN ('tipax','post')),
  total_amount bigint NOT NULL CHECK (total_amount >= 0),
  discount_amount bigint NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  tax_amount bigint NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  final_amount bigint NOT NULL CHECK (final_amount >= 0),
  discount_code_id uuid REFERENCES discount_codes(id) ON DELETE SET NULL,
  payment_method_id uuid NOT NULL REFERENCES payment_methods(id) ON DELETE RESTRICT,
  payment_card_id uuid REFERENCES payment_cards(id) ON DELETE RESTRICT,
  payment_authority varchar(80),
  payment_ref_id varchar(80),
  payment_status varchar(20) NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','rejected')),
  order_status varchar(20) NOT NULL DEFAULT 'new' CHECK (order_status IN ('new','processing','sent','completed','canceled')),
  payment_receipt_url text,
  customer_note text,
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(order_status, payment_status, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_phone_idx ON orders(customer_phone);

CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_title varchar(220) NOT NULL,
  weight integer NOT NULL CHECK (weight IN (100,250,500,1000)),
  quantity integer NOT NULL CHECK (quantity > 0 AND quantity <= 50),
  grind_type varchar(30) NOT NULL,
  roast_type varchar(80),
  blend_type varchar(120),
  brew_method varchar(100),
  unit_price bigint NOT NULL CHECK (unit_price >= 0),
  total_price bigint NOT NULL CHECK (total_price >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items(order_id);

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS roast_type varchar(80);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS blend_type varchar(120);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS brew_method varchar(100);
ALTER TABLE categories ADD COLUMN IF NOT EXISTS seo_title varchar(220);
ALTER TABLE categories ADD COLUMN IF NOT EXISTS seo_description varchar(500);
ALTER TABLE payment_methods DROP CONSTRAINT IF EXISTS payment_methods_type_check;
ALTER TABLE payment_methods ADD CONSTRAINT payment_methods_type_check CHECK (type IN ('cardToCard','bankGateway','zarinpal'));
ALTER TABLE payment_methods ALTER COLUMN card_number DROP NOT NULL;
ALTER TABLE payment_methods ALTER COLUMN account_owner DROP NOT NULL;
ALTER TABLE payment_methods ALTER COLUMN bank_name DROP NOT NULL;
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS merchant_id varchar(80);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_card_id uuid REFERENCES payment_cards(id) ON DELETE RESTRICT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax_amount bigint NOT NULL DEFAULT 0 CHECK (tax_amount >= 0);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_authority varchar(80);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_ref_id varchar(80);
DROP INDEX IF EXISTS one_active_payment_method;
CREATE UNIQUE INDEX IF NOT EXISTS one_active_payment_method_type ON payment_methods(type) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS site_visits (
  id bigserial PRIMARY KEY,
  visitor_id uuid NOT NULL,
  path varchar(300) NOT NULL,
  visited_on date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(visitor_id, path, visited_on)
);
CREATE INDEX IF NOT EXISTS site_visits_date_idx ON site_visits(visited_on DESC);

INSERT INTO categories (title, slug, description, seo_title, seo_description)
VALUES
  ('قهوه‌های ترکیبی', 'coffee-blends',
   'ترکیب‌های تازه‌رست عربیکا و روبوستا با انتخاب رُست و آسیاب متناسب با دستگاه شما.',
   'خرید قهوه ترکیبی تازه رست عربیکا و روبوستا',
   'خرید قهوه ترکیبی تازه‌رست اورنزا در نسبت‌های مختلف عربیکا و روبوستا، با انتخاب وزن، درجه رُست و آسیاب مناسب اسپرسوساز، موکاپات و فرنچ‌پرس.'),
  ('پودرهای نوشیدنی کافه‌ای', 'cafe-drinks',
   'پودرهای منتخب برای آماده‌کردن نوشیدنی‌های گرم و کافه‌ای در خانه یا محل کار.',
   'خرید چای ماسالا، ماچا، هات چاکلت و کاپوچینو',
   'خرید آنلاین پودر چای ماسالا، ماچا، هات چاکلت و کاپوچینو با امکان انتخاب وزن و ارسال سراسر ایران.')
ON CONFLICT (slug) DO UPDATE SET
  title=EXCLUDED.title,
  description=EXCLUDED.description,
  seo_title=EXCLUDED.seo_title,
  seo_description=EXCLUDED.seo_description,
  updated_at=now();

INSERT INTO products
  (title_fa,title_en,category_id,description,roast_type,coffee_type,grind_type,blend_type,
   sort_order,purchase_price_per_kg,sale_price_per_kg,is_active)
SELECT seed.title_fa,seed.title_en,c.id,seed.description,'medium','bean','none',seed.blend_type,
       seed.sort_order,seed.purchase_price,seed.sale_price,true
FROM categories c
CROSS JOIN (VALUES
  ('قهوه ۱۰۰٪ روبوستا','100% ROBUSTA','بسیار قوی، تلخ و پرکافئین؛ با بادی سنگین و کرمای ماندگار.','۱۰۰٪ روبوستا',10,700000,910000),
  ('قهوه ۹۰٪ روبوستا','90% ROBUSTA','انرژی بالا با عطر متعادل‌تر و یادداشت‌های شکلات تلخ و فندق.','۹۰٪ روبوستا',20,750000,975000),
  ('قهوه ۸۰٪ روبوستا','80% ROBUSTA','پرقدرت، خوش‌کرما و ماندگار با طعم شکلات، کارامل و آجیل.','۸۰٪ روبوستا',30,800000,1040000),
  ('قهوه ۷۰٪ روبوستا','70% ROBUSTA','تعادل قدرت و عطر با یادداشت‌های کاکائو، کارامل و ادویه.','۷۰٪ روبوستا',40,850000,1105000),
  ('ترکیب متعادل اورنزا','HOUSE BALANCE','متعادل، شیرین و همه‌پسند با طعم کارامل، مغزها و میوه خشک.','۵۰٪ روبوستا · ۵۰٪ عربیکا',50,950000,1235000),
  ('قهوه ۷۰٪ عربیکا','70% ARABICA','معطر، نرم و شیرین با یادداشت‌های میوه، شکلات شیری و گل.','۷۰٪ عربیکا',60,1100000,1430000),
  ('قهوه ۳۰٪ عربیکا','30% ARABICA','پرقدرت با رایحه‌ای نرم‌تر و یادداشت‌های کاکائو، فندق و کارامل.','۳۰٪ عربیکا',70,875000,1135000),
  ('قهوه ۱۰۰٪ عربیکا','100% ARABICA','پیچیده، لطیف و بسیار معطر با یادداشت‌های مرکبات، گل و میوه قرمز.','۱۰۰٪ عربیکا',80,1250000,1625000)
) AS seed(title_fa,title_en,description,blend_type,sort_order,purchase_price,sale_price)
WHERE c.slug = 'coffee-blends'
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.title_fa = seed.title_fa);

UPDATE products SET sort_order = CASE blend_type
  WHEN '۱۰۰٪ روبوستا' THEN 10
  WHEN '۹۰٪ روبوستا' THEN 20
  WHEN '۸۰٪ روبوستا' THEN 30
  WHEN '۷۰٪ روبوستا' THEN 40
  WHEN '۵۰٪ روبوستا · ۵۰٪ عربیکا' THEN 50
  WHEN '۷۰٪ عربیکا' THEN 60
  WHEN '۳۰٪ عربیکا' THEN 70
  WHEN '۱۰۰٪ عربیکا' THEN 80
  ELSE sort_order
END
WHERE category_id = (SELECT id FROM categories WHERE slug = 'coffee-blends');

INSERT INTO products
  (title_fa,title_en,category_id,description,roast_type,coffee_type,grind_type,blend_type,
   purchase_price_per_kg,sale_price_per_kg,is_active)
SELECT seed.title_fa,seed.title_en,c.id,seed.description,'medium','ground','none',seed.blend_type,
       seed.purchase_price,seed.sale_price,true
FROM categories c
CROSS JOIN (VALUES
  ('چای ماسالا','MASALA CHAI','گرم، ادویه‌ای و معطر با بافتی نرم؛ مناسب تهیه با آب یا شیر داغ.','نوشیدنی پودری',420000,590000),
  ('ماچا لاته','MATCHA LATTE','طعم گیاهی متعادل و بافت لطیف؛ مناسب نوشیدنی گرم یا سرد.','نوشیدنی پودری',950000,1350000),
  ('هات چاکلت','HOT CHOCOLATE','شکلاتی، غلیظ و نرم؛ برای یک فنجان گرم و آرام.','نوشیدنی پودری',480000,680000),
  ('کاپوچینو','CAPPUCCINO','قهوه‌ای، کرمی و متعادل با آماده‌سازی سریع و آسان.','نوشیدنی پودری',520000,720000)
) AS seed(title_fa,title_en,description,blend_type,purchase_price,sale_price)
WHERE c.slug = 'cafe-drinks'
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.title_fa = seed.title_fa);

INSERT INTO tags (title,slug) VALUES
  ('خرید قهوه','buy-coffee'),
  ('قهوه تازه رست','fresh-roasted-coffee'),
  ('قهوه عربیکا','arabica-coffee'),
  ('قهوه روبوستا','robusta-coffee'),
  ('قهوه ترکیبی','coffee-blend'),
  ('قهوه اسپرسو','espresso-coffee'),
  ('قهوه آسیاب شده','ground-coffee'),
  ('دان قهوه','coffee-beans'),
  ('خرید چای ماسالا','buy-masala-chai'),
  ('قیمت چای ماسالا','masala-chai-price'),
  ('خرید ماچا','buy-matcha'),
  ('چای ماچا','matcha-tea'),
  ('خرید هات چاکلت','buy-hot-chocolate'),
  ('پودر هات چاکلت','hot-chocolate-powder'),
  ('شکلات داغ','hot-chocolate'),
  ('خرید کاپوچینو','buy-cappuccino'),
  ('پودر کاپوچینو','cappuccino-powder'),
  ('نوشیدنی گرم','hot-drink'),
  ('نوشیدنی پودری','powdered-drink'),
  ('خرید آنلاین قهوه','buy-coffee-online')
ON CONFLICT (slug) DO UPDATE SET title=EXCLUDED.title, updated_at=now();

INSERT INTO payment_methods
  (title,type,card_number,account_owner,bank_name,merchant_id,is_active)
SELECT seed.title,seed.type,NULL,NULL,NULL,seed.merchant_id,seed.is_active
FROM (VALUES
  ('کارت‌به‌کارت','cardToCard',NULL,true),
  ('درگاه بانکی','bankGateway',NULL,false),
  ('زرین‌پال','zarinpal',COALESCE(NULLIF('${process.env.ZARINPAL_MERCHANT_ID || ""}',''),'ce8cd299-d1e0-4a87-a168-43b36bc8a624'),false)
) AS seed(title,type,merchant_id,is_active)
WHERE NOT EXISTS (SELECT 1 FROM payment_methods p WHERE p.type = seed.type);
`;

try {
  await pool.query(migration);
  await pool.query("DELETE FROM user_sessions WHERE expires_at < now()");
  await pool.query("DELETE FROM password_reset_codes WHERE expires_at < now() - interval '1 day'");
  console.log("Database migration completed.");
} finally {
  await pool.end();
}
