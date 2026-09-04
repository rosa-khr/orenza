import type { Pool } from "pg";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { toPublicRecord } from "./admin/repository.js";
import { siteSettingsSchema } from "./store/schemas.js";

export const siteSettingsSelect = `
  brand_name,brand_name_en,brand_tagline,support_phone,support_email,
  whatsapp_url,bale_url,instagram_url,website_url,address,footer_heading,footer_description,
  footer_copyright,logo_url,favicon_url,homepage_seo_title,
  homepage_seo_description,homepage_seo_keywords,homepage_og_image_url,
  homepage_hero_eyebrow,homepage_hero_title,homepage_hero_title_accent,
  homepage_hero_description,homepage_hero_primary_label,homepage_hero_primary_href,
  homepage_hero_secondary_label,homepage_hero_secondary_href,homepage_hero_benefits,
  homepage_hero_benefit_items,
  homepage_banner_desktop_url,homepage_banner_mobile_url,
  homepage_banner_rows,
  homepage_best_sellers_enabled,homepage_discounts_enabled,
  homepage_best_sellers_title,homepage_best_sellers_color,
  homepage_best_sellers_text_color,homepage_best_sellers_badge_label,
  homepage_best_sellers_badge_color,homepage_best_sellers_icon_color,
  homepage_discounts_title,homepage_discounts_color,
  homepage_discounts_countdown_enabled,homepage_discounts_expires_at,
  homepage_discounts_text_color,homepage_discounts_badge_label,
  homepage_discounts_badge_color,homepage_discounts_icon_color,
  theme_surface_color,theme_footer_color,theme_support_color,theme_header_icon_color,
  search_indexing_enabled,invoice_national_id,invoice_signature_url,updated_at`;

const aiSettingsSecret = () => createHash("sha256")
  .update(process.env.CONTENT_SETTINGS_SECRET || process.env.PASSWORD_RESET_SECRET || "orenza-content-settings-secret")
  .digest();

const encryptSetting = (value: string) => {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", aiSettingsSecret(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
};

const decryptSetting = (value: string | null) => {
  if (!value) return null;
  try {
    const [iv, tag, encrypted] = value.split(".").map((part) => Buffer.from(part, "base64url"));
    if (!iv || !tag || !encrypted) return null;
    const decipher = createDecipheriv("aes-256-gcm", aiSettingsSecret(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  } catch { return null; }
};

export const getContentAiSettings = async (pool: Pool) => {
  const result = await pool.query<{
    content_ai_api_key: string | null; content_ai_model: string | null; content_ai_instructions: string;
    content_ai_default_audience: string; content_ai_default_tone: string;
    content_ai_default_length: "short" | "medium" | "long"; content_ai_default_language: "fa" | "en";
  }>(
    "SELECT content_ai_api_key,content_ai_model,content_ai_instructions,content_ai_default_audience,content_ai_default_tone,content_ai_default_length,content_ai_default_language FROM site_settings WHERE id=1"
  );
  return {
    apiKey: decryptSetting(result.rows[0]?.content_ai_api_key || null),
    model: result.rows[0]?.content_ai_model || process.env.OPENAI_MODEL || "gpt-5",
    instructions: result.rows[0]?.content_ai_instructions || "",
    defaultAudience: result.rows[0]?.content_ai_default_audience || "مخاطب عمومی فروشگاه اورنزا",
    defaultTone: result.rows[0]?.content_ai_default_tone || "حرفه‌ای، گرم و متقاعدکننده",
    defaultLength: result.rows[0]?.content_ai_default_length || "medium",
    defaultLanguage: result.rows[0]?.content_ai_default_language || "fa"
  };
};

export const getSiteSettings = async (pool: Pool) => {
  const result = await pool.query<Record<string, unknown>>(
    `SELECT ${siteSettingsSelect} FROM site_settings WHERE id=1`
  );
  return toPublicRecord(result.rows[0] || {});
};

export const updateSiteSettings = async (pool: Pool, input: unknown) => {
  const data = siteSettingsSchema.parse(input);
  const result = await pool.query<Record<string, unknown>>(
    `UPDATE site_settings SET
      brand_name=$1,brand_name_en=$2,brand_tagline=$3,support_phone=$4,support_email=$5,
      whatsapp_url=$6,bale_url=$7,instagram_url=$8,website_url=$9,address=$10,footer_heading=$11,
      footer_description=$12,footer_copyright=$13,logo_url=$14,favicon_url=$15,
      homepage_seo_title=$16,homepage_seo_description=$17,homepage_seo_keywords=$18,
      homepage_og_image_url=$19,homepage_hero_eyebrow=$20,homepage_hero_title=$21,
      homepage_hero_title_accent=$22,homepage_hero_description=$23,
      homepage_hero_primary_label=$24,homepage_hero_primary_href=$25,
      homepage_hero_secondary_label=$26,homepage_hero_secondary_href=$27,
      homepage_hero_benefits=$28,homepage_hero_benefit_items=$29,
      homepage_banner_desktop_url=$30,homepage_banner_mobile_url=$31,
      homepage_banner_rows=$32,
      homepage_best_sellers_enabled=$33,homepage_discounts_enabled=$34,
      homepage_best_sellers_title=$35,homepage_best_sellers_color=$36,
      homepage_best_sellers_text_color=$37,homepage_best_sellers_badge_label=$38,
      homepage_best_sellers_badge_color=$39,homepage_best_sellers_icon_color=$40,
      homepage_discounts_title=$41,homepage_discounts_color=$42,
      homepage_discounts_countdown_enabled=$43,homepage_discounts_expires_at=$44,
      homepage_discounts_text_color=$45,homepage_discounts_badge_label=$46,
      homepage_discounts_badge_color=$47,homepage_discounts_icon_color=$48,
      theme_surface_color=$49,theme_footer_color=$50,theme_support_color=$51,theme_header_icon_color=$52,
      search_indexing_enabled=$53,invoice_national_id=$54,
      content_ai_api_key=CASE WHEN $55 <> '' THEN $55 ELSE content_ai_api_key END,
      content_ai_model=$56,
      content_ai_instructions=$57,content_ai_default_audience=$58,content_ai_default_tone=$59,
      content_ai_default_length=$60,content_ai_default_language=$61,
      updated_at=now()
     WHERE id=1 RETURNING ${siteSettingsSelect}`,
    [
      data.brandName, data.brandNameEn, data.brandTagline, data.supportPhone, data.supportEmail,
      data.whatsappUrl, data.baleUrl, data.instagramUrl, data.websiteUrl, data.address || null, data.footerHeading,
      data.footerDescription, data.footerCopyright, data.logoUrl, data.faviconUrl,
      data.homepageSeoTitle, data.homepageSeoDescription, data.homepageSeoKeywords,
      data.homepageOgImageUrl, data.homepageHeroEyebrow, data.homepageHeroTitle,
      data.homepageHeroTitleAccent, data.homepageHeroDescription,
      data.homepageHeroPrimaryLabel, data.homepageHeroPrimaryHref,
      data.homepageHeroSecondaryLabel, data.homepageHeroSecondaryHref,
      data.homepageHeroBenefits, JSON.stringify(data.homepageHeroBenefitItems),
      data.homepageBannerDesktopUrl || null, data.homepageBannerMobileUrl || null,
      JSON.stringify(data.homepageBannerRows),
      data.homepageBestSellersEnabled, data.homepageDiscountsEnabled,
      data.homepageBestSellersTitle, data.homepageBestSellersColor,
      data.homepageBestSellersTextColor, data.homepageBestSellersBadgeLabel,
      data.homepageBestSellersBadgeColor, data.homepageBestSellersIconColor,
      data.homepageDiscountsTitle, data.homepageDiscountsColor,
      data.homepageDiscountsCountdownEnabled, data.homepageDiscountsExpiresAt || null,
      data.homepageDiscountsTextColor, data.homepageDiscountsBadgeLabel,
      data.homepageDiscountsBadgeColor, data.homepageDiscountsIconColor,
      data.themeSurfaceColor, data.themeFooterColor, data.themeSupportColor, data.themeHeaderIconColor,
      data.searchIndexingEnabled, data.invoiceNationalId,
      data.contentAiApiKey ? encryptSetting(data.contentAiApiKey) : "",
      data.contentAiModel || "gpt-5", data.contentAiInstructions || "از ادعای پزشکی یا اطلاعات ساختگی خودداری کن؛ محتوای کم‌حجم و ناقص تولید نکن؛ ساختار مقاله را با H1 و H2 و در صورت نیاز H3 ارائه کن؛ عنوان SEO و توضیحات متا را جداگانه بنویس.",
      data.contentAiDefaultAudience || "مخاطب عمومی فروشگاه اورنزا", data.contentAiDefaultTone || "حرفه‌ای، گرم و متقاعدکننده",
      data.contentAiDefaultLength || "medium", data.contentAiDefaultLanguage || "fa"
    ]
  );
  return toPublicRecord(result.rows[0]!);
};

export const getPublicSiteSettings = async (pool: Pool) => {
  const settings = await getSiteSettings(pool);
  const scripts = await pool.query<Record<string, unknown>>(
    `SELECT provider,service_key,placement
       FROM service_scripts WHERE is_active=true ORDER BY created_at`
  );
  return {
    ...settings,
    scripts: scripts.rows.map(toPublicRecord)
  };
};
