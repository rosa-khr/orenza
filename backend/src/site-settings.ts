import type { Pool } from "pg";
import { toPublicRecord } from "./admin/repository.js";
import { siteSettingsSchema } from "./store/schemas.js";

export const siteSettingsSelect = `
  brand_name,brand_name_en,brand_tagline,support_phone,support_email,
  whatsapp_url,bale_url,instagram_url,address,footer_heading,footer_description,
  footer_copyright,logo_url,favicon_url,homepage_seo_title,
  homepage_seo_description,homepage_seo_keywords,homepage_og_image_url,
  search_indexing_enabled,updated_at`;

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
      whatsapp_url=$6,bale_url=$7,instagram_url=$8,address=$9,footer_heading=$10,
      footer_description=$11,footer_copyright=$12,logo_url=$13,favicon_url=$14,
      homepage_seo_title=$15,homepage_seo_description=$16,homepage_seo_keywords=$17,
      homepage_og_image_url=$18,search_indexing_enabled=$19,updated_at=now()
     WHERE id=1 RETURNING ${siteSettingsSelect}`,
    [
      data.brandName, data.brandNameEn, data.brandTagline, data.supportPhone, data.supportEmail,
      data.whatsappUrl, data.baleUrl, data.instagramUrl, data.address || null, data.footerHeading,
      data.footerDescription, data.footerCopyright, data.logoUrl, data.faviconUrl,
      data.homepageSeoTitle, data.homepageSeoDescription, data.homepageSeoKeywords,
      data.homepageOgImageUrl, data.searchIndexingEnabled
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
