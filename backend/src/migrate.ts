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
  ('admin','discount-codes'),('admin','articles'),('admin','tags'),('admin','site-settings'),('admin','logs'),('admin','content-generator'),('admin','accounting'),('admin','price-imports'),
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

ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS invoice_national_id varchar(20) NOT NULL DEFAULT '۰۰۲۱۴۱۱۴۱۷';
ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS invoice_signature_url varchar(500);
ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS website_url varchar(500) NOT NULL DEFAULT 'https://orenza.ir';
ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS homepage_banner_desktop_url varchar(500);
ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS homepage_banner_mobile_url varchar(500);
ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS content_ai_api_key text;
ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS content_ai_model varchar(100) NOT NULL DEFAULT 'gpt-5';
ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS content_ai_instructions text NOT NULL DEFAULT 'از ادعای پزشکی یا اطلاعات ساختگی خودداری کن؛ از کلیشه و تکرار پرهیز کن؛ محتوای کم‌حجم و ناقص تولید نکن؛ ساختار مقاله را با یک H1، چند H2 مرتبط و در صورت نیاز H3 و پاراگراف‌های کامل ارائه کن؛ در ابتدای خروجی عنوان SEO و توضیحات متا را جداگانه بنویس؛ فقط متن نهایی را بده و درباره روند تولید توضیح نده.';
ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS content_ai_default_audience varchar(200) NOT NULL DEFAULT 'مخاطب عمومی فروشگاه اورنزا';
ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS content_ai_default_tone varchar(100) NOT NULL DEFAULT 'حرفه‌ای، گرم و متقاعدکننده';
ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS content_ai_default_length varchar(10) NOT NULL DEFAULT 'medium' CHECK (content_ai_default_length IN ('short','medium','long'));
ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS content_ai_default_language varchar(5) NOT NULL DEFAULT 'fa' CHECK (content_ai_default_language IN ('fa','en'));

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
  image_url text,
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
  product_content text,
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
  show_in_best_sellers boolean NOT NULL DEFAULT false,
  show_in_discounts boolean NOT NULL DEFAULT false,
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
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_content text;

CREATE TABLE IF NOT EXISTS price_import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name varchar(255) NOT NULL,
  status varchar(20) NOT NULL CHECK (status IN ('processing','completed','failed')),
  total_rows integer NOT NULL DEFAULT 0,
  updated_rows integer NOT NULL DEFAULT 0,
  failed_rows integer NOT NULL DEFAULT 0,
  error_message text,
  file_content bytea,
  file_mime_type varchar(120),
  file_size integer,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS price_import_jobs_started_at_idx ON price_import_jobs(started_at DESC);

CREATE TABLE IF NOT EXISTS price_import_items (
  id bigserial PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES price_import_jobs(id) ON DELETE CASCADE,
  row_number integer NOT NULL,
  product_identifier varchar(220) NOT NULL,
  product_title varchar(220),
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  previous_purchase_price bigint,
  new_purchase_price bigint,
  previous_sale_price bigint,
  new_sale_price bigint,
  increase_type varchar(20),
  increase_value numeric(14,2),
  status varchar(20) NOT NULL CHECK (status IN ('updated','failed')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS price_import_items_job_idx ON price_import_items(job_id,row_number);
ALTER TABLE price_import_jobs ADD COLUMN IF NOT EXISTS file_content bytea;
ALTER TABLE price_import_jobs ADD COLUMN IF NOT EXISTS file_mime_type varchar(120);
ALTER TABLE price_import_jobs ADD COLUMN IF NOT EXISTS file_size integer;
ALTER TABLE price_import_items ADD COLUMN IF NOT EXISTS previous_sale_price bigint;
ALTER TABLE price_import_items ADD COLUMN IF NOT EXISTS product_title varchar(220);
ALTER TABLE price_import_items ADD COLUMN IF NOT EXISTS new_sale_price bigint;
ALTER TABLE price_import_items ADD COLUMN IF NOT EXISTS increase_type varchar(20);
ALTER TABLE price_import_items ADD COLUMN IF NOT EXISTS increase_value numeric(14,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS show_in_best_sellers boolean NOT NULL DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS show_in_discounts boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS content_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug varchar(100) UNIQUE,
  title varchar(160) NOT NULL,
  description varchar(400) NOT NULL DEFAULT '',
  content_type varchar(80) NOT NULL,
  audience varchar(200) NOT NULL DEFAULT '',
  tone varchar(100) NOT NULL DEFAULT '',
  language varchar(10) NOT NULL DEFAULT 'fa' CHECK (language IN ('fa','en')),
  content_length varchar(20) NOT NULL DEFAULT 'medium' CHECK (content_length IN ('short','medium','long')),
  extra_instructions text NOT NULL DEFAULT '',
  is_system boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS content_templates_updated_at_idx ON content_templates(updated_at DESC);

INSERT INTO content_templates (slug,title,description,content_type,audience,tone,language,content_length,extra_instructions,is_system)
VALUES
  ('blog-article','مقاله وبلاگ','مقاله آموزشی ساختاریافته و مناسب انتشار در وبلاگ','مقاله وبلاگ','مخاطبان علاقه‌مند به قهوه و نوشیدنی‌های تخصصی','حرفه‌ای، گرم و آموزشی','fa','long','عنوان جذاب، مقدمه کوتاه، تیترهای منظم، جمع‌بندی و فراخوان اقدام داشته باشد.',true),
  ('product-description','توضیحات محصول','معرفی متقاعدکننده محصول برای صفحه فروشگاه','توضیحات محصول','خریداران فروشگاه اینترنتی اورنزا','شفاف، حسی و متقاعدکننده','fa','medium','مزیت‌ها، ویژگی طعمی، روش مصرف و دلیل خرید را بدون اغراق توضیح بده.',true),
  ('category-page','صفحه دسته‌بندی','محتوای معرفی و سئوی صفحه دسته‌بندی محصولات','صفحه دسته‌بندی','کاربرانی که در حال مقایسه و انتخاب محصول هستند','راهنما، معتبر و ساده','fa','medium','مقدمه دسته‌بندی، راهنمای انتخاب، پاسخ به دغدغه‌های خرید و CTA اضافه کن.',true),
  ('social-post','پست شبکه اجتماعی','متن کوتاه برای کپشن و شبکه‌های اجتماعی','متن شبکه اجتماعی','دنبال‌کنندگان شبکه‌های اجتماعی اورنزا','صمیمی، کوتاه و تعاملی','fa','short','یک شروع جذاب، متن کوتاه، CTA و حداکثر ۵ هشتگ مرتبط ارائه کن.',true),
  ('seo-landing','محتوای سئو','لندینگ کامل بر اساس کلمه کلیدی هدف','محتوای سئو','کاربران ورودی از موتورهای جستجو','تخصصی، طبیعی و قابل اعتماد','fa','long','ساختار H2 و H3، پاسخ به نیت جستجو، FAQ کوتاه و استفاده طبیعی از کلمات کلیدی داشته باشد.',true)
ON CONFLICT (slug) DO NOTHING;

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
  content text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product_tags (
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, tag_id)
);
CREATE INDEX IF NOT EXISTS product_tags_tag_idx ON product_tags(tag_id);

CREATE TABLE IF NOT EXISTS product_related_products (
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  related_product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, related_product_id),
  CHECK (product_id <> related_product_id)
);
CREATE INDEX IF NOT EXISTS product_related_products_related_idx
  ON product_related_products(related_product_id);

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
  order_status varchar(20) NOT NULL DEFAULT 'new' CHECK (order_status IN ('new','processing','ready','sent','completed','canceled')),
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
  unit_cost bigint,
  total_cost bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items(order_id);

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS roast_type varchar(80);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS blend_type varchar(120);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS brew_method varchar(100);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS unit_cost bigint;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS total_cost bigint;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS seo_title varchar(220);
ALTER TABLE categories ADD COLUMN IF NOT EXISTS seo_description varchar(500);
ALTER TABLE categories ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE tags ADD COLUMN IF NOT EXISTS content text;
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
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_receipt_url text;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_order_status_check
  CHECK (order_status IN ('new','processing','ready','sent','completed','canceled'));
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

CREATE TABLE IF NOT EXISTS application_logs (
  id bigserial PRIMARY KEY,
  level varchar(10) NOT NULL CHECK (level IN ('info','warn','error')),
  event varchar(100) NOT NULL,
  message varchar(500) NOT NULL,
  request_id varchar(100),
  method varchar(10),
  route varchar(300),
  status_code smallint,
  duration_ms integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS application_logs_created_at_idx ON application_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS application_logs_level_idx ON application_logs(level);

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

INSERT INTO categories (title, slug, description, seo_title, seo_description, is_active)
VALUES
  ('همه محصولات اورنزا', 'products',
   '<h2>خرید محصولات اورنزا</h2><p>مجموعه‌ای از قهوه‌های تازه‌رست و پودرهای نوشیدنی کافه‌ای اورنزا برای انتخابی دقیق و خوش‌طعم.</p>',
   'خرید محصولات اورنزا؛ قهوه و نوشیدنی‌های کافه‌ای',
   'خرید قهوه تازه‌رست و پودرهای نوشیدنی کافه‌ای اورنزا با انتخاب وزن، رُست و آسیاب مناسب.', true),
  ('خرید عمده', 'wholesale',
   '<h2>خرید عمده قهوه برای کافه و سازمان</h2><p>تأمین منظم قهوه تازه‌رست اورنزا برای کافه‌ها، رستوران‌ها و مجموعه‌های سازمانی با ترکیب و آسیاب متناسب با نیاز شما.</p>',
   'خرید عمده قهوه برای کافه، رستوران و سازمان',
   'خرید عمده قهوه تازه‌رست اورنزا برای کافه، رستوران و سازمان با تأمین منظم و انتخاب ترکیب مناسب.', true),
  ('درباره اورنزا', 'about-orenza',
   '<h2>درباره اورنزا</h2><p>داستان اورنزا، انتخاب دانه و رُست تازه برای ساختن تجربه‌ای دقیق‌تر از قهوه.</p>',
   'درباره اورنزا؛ داستان رستری و قهوه تازه‌رست',
   'با اورنزا و نگاه ما به انتخاب دانه، رُست تازه و آماده‌سازی قهوه آشنا شوید.', true)
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

UPDATE products
SET product_content = CASE title_fa
  WHEN 'قهوه ۱۰۰٪ روبوستا' THEN
    'قهوه ۱۰۰٪ روبوستا انتخابی برای کسانی است که از یک فنجان قدرتمند، تلخی مشخص و کافئین بالا لذت می‌برند. بادی سنگین و کرمای متراکم این ترکیب، آن را به گزینه‌ای مناسب برای اسپرسوی غلیظ و نوشیدنی‌های بر پایه شیر تبدیل می‌کند؛ جایی که طعم قهوه باید در کنار شیر همچنان واضح باقی بماند.

این قهوه برای دستگاه اسپرسوساز خانگی و صنعتی، موکاپات و روش‌هایی که عصاره‌گیری پرقدرت می‌خواهند مناسب است. انتخاب درجه آسیاب متناسب با دستگاه، به ایجاد جریان یکنواخت و طعمی متعادل‌تر کمک می‌کند. اگر تلخی کمتر می‌خواهید، رُست متوسط و نسبت آب کمی بیشتر را امتحان کنید.

با خرید قهوه ۱۰۰ درصد روبوستا اورنزا، محصول پس از ثبت سفارش تازه آماده می‌شود و می‌توانید وزن، نوع رُست و آسیاب مناسب ابزار دم‌آوری خود را انتخاب کنید. این محصول برای دوستداران اسپرسوی پرکافئین، کرمای زیاد و طعم ماندگار طراحی شده است.'
  WHEN 'قهوه ۹۰٪ روبوستا' THEN
    'قهوه ۹۰٪ روبوستا تعادلی نزدیک به قهوه‌های بسیار پرقدرت دارد، اما حضور عربیکا رایحه و نرمی بیشتری به فنجان می‌دهد. نتیجه، اسپرسویی با کافئین بالا، کرمای خوب و یادداشت‌هایی نزدیک به شکلات تلخ و فندق است که برای شروع روز یا ساعت‌های کاری طولانی انتخاب جذابی محسوب می‌شود.

این ترکیب برای اسپرسوساز، موکاپات و نوشیدنی‌هایی مانند لاته و کاپوچینو مناسب است. قدرت روبوستا باعث می‌شود طعم قهوه در ترکیب با شیر گم نشود و سهم عربیکا به متعادل‌شدن رایحه کمک کند. آسیاب دقیق متناسب با دستگاه، نقش مهمی در کنترل تلخی و کیفیت عصاره‌گیری دارد.

قهوه ۹۰ درصد روبوستا اورنزا با امکان انتخاب وزن، رُست و درجه آسیاب عرضه می‌شود. اگر به دنبال خرید قهوه اسپرسو پرقدرت هستید اما فنجانی کمی خوش‌عطرتر از روبوستای خالص می‌خواهید، این ترکیب انتخاب مناسبی است.'
  WHEN 'قهوه ۸۰٪ روبوستا' THEN
    'قهوه ۸۰٪ روبوستا برای دوستداران اسپرسوی قوی و خوش‌کرما ساخته شده است. سهم روبوستای بالا، بادی و انرژی فنجان را حفظ می‌کند و بخش عربیکا رایحه‌ای متعادل‌تر به ترکیب می‌بخشد. در طعم این قهوه می‌توان حال‌وهوای شکلات، کارامل و مغزها را تجربه کرد.

این ترکیب در اسپرسوساز خانگی و صنعتی عملکرد خوبی دارد و برای موکاپات نیز مناسب است. هنگام تهیه لاته یا کاپوچینو، شخصیت قهوه در کنار شیر باقی می‌ماند و یک نوشیدنی متعادل و قابل تشخیص ایجاد می‌کند. برای بهترین نتیجه، درجه آسیاب را بر اساس نوع دستگاه انتخاب کنید.

خرید قهوه ۸۰ درصد روبوستا اورنزا برای کسانی مناسب است که کافئین و کرمای بالا می‌خواهند، اما به رایحه و تعادل نیز اهمیت می‌دهند. قهوه بر اساس انتخاب شما تازه آماده و در وزن دلخواه ارسال می‌شود.'
  WHEN 'قهوه ۷۰٪ روبوستا' THEN
    'قهوه ۷۰٪ روبوستا ترکیبی پرانرژی و در عین حال متعادل است. روبوستا بادی، کرما و قدرت فنجان را تأمین می‌کند و عربیکا با عطر بیشتر و شیرینی طبیعی، از تیزی طعم می‌کاهد. یادداشت‌های کاکائو، کارامل و ادویه، این ترکیب را برای مصرف روزانه دلپذیر می‌کند.

این قهوه برای اسپرسو، موکاپات و انواع نوشیدنی بر پایه شیر انتخابی انعطاف‌پذیر است. اگر اسپرسویی با قدرت محسوس اما نه بیش از حد تلخ می‌خواهید، نسبت ۷۰ درصد روبوستا می‌تواند نقطه تعادل خوبی باشد. تنظیم آسیاب و زمان عصاره‌گیری به برجسته‌شدن شیرینی فنجان کمک می‌کند.

قهوه ۷۰ درصد روبوستا اورنزا با انتخاب رُست، وزن و آسیاب متناسب با دستگاه شما عرضه می‌شود. این محصول برای خرید قهوه روزانه، استفاده در خانه یا محیط کار و تهیه اسپرسوی خوش‌کرما مناسب است.'
  WHEN 'ترکیب متعادل اورنزا' THEN
    'ترکیب متعادل اورنزا با نسبت برابر عربیکا و روبوستا، برای فنجانی همه‌پسند و هماهنگ طراحی شده است. عربیکا عطر و لطافت را به همراه دارد و روبوستا بادی، کرما و قدرت را کامل می‌کند. طعم‌های نزدیک به کارامل، مغزها و میوه خشک، نوشیدن آن را در ساعات مختلف روز لذت‌بخش می‌سازد.

این ترکیب برای اسپرسوساز، موکاپات، فرنچ‌پرس و بسیاری از روش‌های رایج دم‌آوری قابل استفاده است. در اسپرسو فنجانی متعادل می‌دهد و در ترکیب با شیر نیز طعم قهوه را حفظ می‌کند. به همین دلیل می‌تواند انتخاب مناسبی برای خانواده یا محیط کاری با سلیقه‌های متفاوت باشد.

با خرید ترکیب متعادل اورنزا می‌توانید وزن، رُست و آسیاب را بر اساس شیوه دم‌آوری خود انتخاب کنید. اگر میان عطر عربیکا و قدرت روبوستا مردد هستید، این قهوه ترکیبی نقطه شروع مطمئن و خوش‌طعمی است.'
  WHEN 'قهوه ۷۰٪ عربیکا' THEN
    'قهوه ۷۰٪ عربیکا فنجانی معطر، نرم و شیرین‌تر ارائه می‌دهد و در عین حال با حضور روبوستا، بادی و کرمای کافی را حفظ می‌کند. یادداشت‌های میوه‌ای، شکلات شیری و گل در این ترکیب، تجربه‌ای ظریف‌تر از قهوه‌های روبوستا محور ایجاد می‌کنند.

این قهوه برای اسپرسوی آروماتیک، قهوه دمی و نوشیدنی‌های شیری با طعم ملایم مناسب است. در روش‌های دمی، انتخاب رُست روشن‌تر می‌تواند پیچیدگی رایحه را برجسته کند؛ برای اسپرسو نیز رُست متوسط تعادل خوبی میان اسیدیته، شیرینی و بادی به وجود می‌آورد.

خرید قهوه ۷۰ درصد عربیکا اورنزا برای کسانی مناسب است که عطر و لطافت را در اولویت قرار می‌دهند اما نمی‌خواهند قدرت فنجان کاملاً کم شود. وزن، رُست و آسیاب محصول مطابق انتخاب شما آماده خواهد شد.'
  WHEN 'قهوه ۳۰٪ عربیکا' THEN
    'قهوه ۳۰٪ عربیکا ترکیبی پرقدرت با رایحه‌ای نرم‌تر از قهوه‌های روبوستا خالص است. سهم بالاتر روبوستا، کرما و بادی مطلوبی ایجاد می‌کند و عربیکا با افزودن عطر و شیرینی، فنجان را متعادل‌تر می‌سازد. طعم‌های کاکائو، فندق و کارامل در این ترکیب به‌خوبی احساس می‌شوند.

این محصول برای اسپرسوساز، موکاپات و تهیه کاپوچینو یا لاته مناسب است. قدرت قهوه در کنار شیر حفظ می‌شود و در شات اسپرسو نیز بافتی غلیظ و ماندگار خواهید داشت. انتخاب آسیاب مخصوص دستگاه باعث می‌شود عصاره‌گیری دقیق‌تر و طعم نهایی هماهنگ‌تر باشد.

قهوه ۳۰ درصد عربیکا اورنزا گزینه‌ای مناسب برای مصرف روزانه و کسانی است که فنجانی قوی، خوش‌کرما و در عین حال خوش‌عطر می‌خواهند. محصول با وزن و مشخصات انتخابی شما تازه آماده می‌شود.'
  WHEN 'قهوه ۱۰۰٪ عربیکا' THEN
    'قهوه ۱۰۰٪ عربیکا برای دوستداران رایحه‌های پیچیده، بافت لطیف و طعمی ظریف طراحی شده است. در این فنجان می‌توان یادداشت‌هایی از مرکبات، گل و میوه قرمز را جست‌وجو کرد. عربیکای خالص نسبت به ترکیب‌های روبوستا محور تلخی ملایم‌تر و عطر برجسته‌تری دارد.

این قهوه برای روش‌های دمی مانند V60، فرنچ‌پرس و کمکس و همچنین اسپرسوی آروماتیک مناسب است. انتخاب رُست روشن یا متوسط به حفظ ویژگی‌های عطری کمک می‌کند و آسیاب تازه متناسب با ابزار دم‌آوری، شفافیت بیشتری در فنجان به وجود می‌آورد.

با خرید قهوه ۱۰۰ درصد عربیکا اورنزا، امکان انتخاب وزن، پروفایل رُست و آسیاب مناسب دستگاه را دارید. اگر کیفیت رایحه، شیرینی طبیعی و تجربه طعمی چندلایه برایتان مهم است، عربیکای خالص انتخابی دقیق و لذت‌بخش خواهد بود.'
  WHEN 'چای ماسالا' THEN
    'چای ماسالا اورنزا یک نوشیدنی گرم، معطر و ادویه‌ای با بافتی نرم است که به‌سادگی در خانه یا محل کار آماده می‌شود. طعم گرم و متعادل آن، انتخابی دلپذیر برای عصرها، روزهای سرد و زمان‌هایی است که نوشیدنی متفاوتی از چای یا قهوه می‌خواهید.

برای آماده‌سازی چای ماسالا می‌توانید پودر را با شیر گرم یا ترکیبی از آب و شیر مخلوط کنید و مقدار آن را بر اساس غلظت دلخواه تغییر دهید. استفاده از شیر، بافتی کرمی‌تر ایجاد می‌کند و سرو با آب طعم ادویه‌ها را واضح‌تر نشان می‌دهد. این محصول برای سرو گرم طراحی شده، اما می‌توان نسخه سرد آن را نیز تهیه کرد.

خرید پودر چای ماسالا اورنزا راهی سریع برای آماده‌کردن یک نوشیدنی کافه‌ای در خانه است. بسته را دور از رطوبت و نور مستقیم نگهداری کنید و برای حفظ عطر و کیفیت، پس از هر بار مصرف در آن را کامل ببندید.'
  WHEN 'ماچا لاته' THEN
    'ماچا لاته اورنزا نوشیدنی‌ای با طعم گیاهی متعادل و بافت لطیف است که می‌توانید آن را گرم یا سرد آماده کنید. ترکیب متوازن محصول کمک می‌کند بدون تجهیزات پیچیده، یک فنجان ماچا لاته یکدست و خوش‌طعم در خانه یا محل کار داشته باشید.

برای تهیه ماچا لاته گرم، مقدار دلخواه پودر را ابتدا با کمی آب گرم حل کنید و سپس شیر گرم را به آن بیفزایید. برای نسخه سرد نیز می‌توانید ترکیب را با شیر خنک و یخ سرو کنید. هم‌زدن کامل یا استفاده از فوم‌ساز دستی، بافت نوشیدنی را نرم‌تر و یکنواخت‌تر می‌کند.

با خرید پودر ماچا لاته اورنزا، آماده‌سازی یک نوشیدنی کافه‌ای متفاوت سریع و ساده می‌شود. محصول را در محیط خشک، خنک و دور از نور مستقیم نگهداری کنید تا رنگ، عطر و طعم آن برای مدت بیشتری حفظ شود.'
  WHEN 'هات چاکلت' THEN
    'هات چاکلت اورنزا نوشیدنی‌ای شکلاتی، غلیظ و نرم است که برای ساختن یک فنجان گرم و آرامش‌بخش آماده شده است. طعم متعادل کاکائو و بافت کرمی آن، این محصول را برای خانه، محل کار یا پذیرایی به انتخابی ساده و خوش‌طعم تبدیل می‌کند.

برای تهیه هات چاکلت، پودر را با شیر گرم ترکیب کنید و تا رسیدن به بافت یکنواخت هم بزنید. با تغییر نسبت پودر و شیر می‌توانید نوشیدنی را رقیق‌تر یا غلیظ‌تر سرو کنید. افزودن مقدار کمی فوم شیر نیز ظاهر و حس کافه‌ای‌تری به فنجان می‌دهد.

خرید پودر هات چاکلت اورنزا مناسب کسانی است که می‌خواهند بدون تجهیزات تخصصی، نوشیدنی شکلاتی با آماده‌سازی سریع داشته باشند. برای حفظ کیفیت، بسته را در محیط خشک و خنک قرار دهید و پس از مصرف کاملاً ببندید.'
  WHEN 'کاپوچینو' THEN
    'کاپوچینو اورنزا یک نوشیدنی قهوه‌ای، کرمی و متعادل با آماده‌سازی سریع است. این محصول برای زمانی مناسب است که طعم قهوه و لطافت یک نوشیدنی شیری را هم‌زمان می‌خواهید، اما فرصت یا تجهیزات تهیه اسپرسو و فوم شیر را ندارید.

برای آماده‌سازی، مقدار مناسب پودر کاپوچینو را با آب یا شیر گرم ترکیب کنید و تا ایجاد بافتی یکدست هم بزنید. استفاده از شیر، نوشیدنی را نرم‌تر و کرمی‌تر می‌کند و آب گرم طعم قهوه را واضح‌تر نشان می‌دهد. می‌توانید میزان پودر را متناسب با غلظت و شیرینی دلخواه تنظیم کنید.

با خرید پودر کاپوچینو اورنزا، یک نوشیدنی کافه‌ای سریع برای خانه یا محل کار در دسترس دارید. بسته‌بندی را دور از رطوبت و نور نگه دارید و پس از هر بار مصرف محکم ببندید تا عطر و کیفیت محصول حفظ شود.'
  ELSE product_content
END,
updated_at = now()
WHERE (product_content IS NULL OR btrim(product_content) = '')
  AND title_fa IN (
    'قهوه ۱۰۰٪ روبوستا','قهوه ۹۰٪ روبوستا','قهوه ۸۰٪ روبوستا','قهوه ۷۰٪ روبوستا',
    'ترکیب متعادل اورنزا','قهوه ۷۰٪ عربیکا','قهوه ۳۰٪ عربیکا','قهوه ۱۰۰٪ عربیکا',
    'چای ماسالا','ماچا لاته','هات چاکلت','کاپوچینو'
  );

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
