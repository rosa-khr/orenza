type PublicServiceScript = {
  provider: "gtm" | "ga4" | "searchConsole";
  serviceKey: string;
  placement: "head" | "body";
};

type PublicSiteSettings = {
  brandName: string;
  brandNameEn: string;
  brandTagline: string;
  supportPhone: string;
  supportEmail: string;
  whatsappUrl: string;
  baleUrl: string;
  instagramUrl: string;
  address: string | null;
  footerHeading: string;
  footerDescription: string;
  footerCopyright: string;
  logoUrl: string | null;
  faviconUrl: string;
  homepageSeoTitle: string;
  homepageSeoDescription: string;
  homepageSeoKeywords: string[];
  homepageOgImageUrl: string;
  homepageBannerDesktopUrl: string | null;
  homepageBannerMobileUrl: string | null;
  homepageBannerRows?: HomepageBannerRow[];
  homepageBestSellersEnabled?: boolean;
  homepageDiscountsEnabled?: boolean;
  searchIndexingEnabled: boolean;
  scripts: PublicServiceScript[];
};

type HomepageBannerRow = {
  id: "aboveDiscount" | "aboveBest";
  columns: number;
  isActive: boolean;
  items: {
    imageUrl: string;
    alt?: string;
    href?: string;
    seoTitle?: string;
    seoDescription?: string;
    geoSummary?: string;
    ieoIntent?: string;
    isActive: boolean;
  }[];
};

const setText = (selector: string, value: string) => {
  document.querySelectorAll<HTMLElement>(selector).forEach((element) => {
    element.textContent = value;
  });
};

const setHref = (selector: string, value: string) => {
  document.querySelectorAll<HTMLAnchorElement>(selector).forEach((element) => {
    element.href = value;
  });
};

const setMeta = (key: string, value: string) => {
  const meta = document.querySelector<HTMLMetaElement>(`[data-site-meta="${key}"]`);
  if (meta) meta.content = value;
};

const loadGtm = (id: string) => {
  if (!/^GTM-[A-Z0-9]+$/.test(id) || document.querySelector(`[data-service-key="${id}"]`)) return;
  const script = document.createElement("script");
  script.dataset.serviceKey = id;
  script.textContent = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${id}');`;
  document.head.append(script);
};

const loadGa4 = (id: string) => {
  if (!/^G-[A-Z0-9]+$/.test(id) || document.querySelector(`[data-service-key="${id}"]`)) return;
  const source = document.createElement("script");
  source.async = true;
  source.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  source.dataset.serviceKey = id;
  const config = document.createElement("script");
  config.textContent = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${id}');`;
  document.head.append(source, config);
};

const applyServiceScripts = (scripts: PublicServiceScript[]) => {
  scripts.forEach((service) => {
    if (service.provider === "gtm") loadGtm(service.serviceKey);
    if (service.provider === "ga4") loadGa4(service.serviceKey);
    if (service.provider === "searchConsole" && /^[A-Za-z0-9_-]+$/.test(service.serviceKey)) {
      let meta = document.querySelector<HTMLMetaElement>('meta[name="google-site-verification"]');
      if (!meta) {
        meta = document.createElement("meta");
        meta.name = "google-site-verification";
        document.head.append(meta);
      }
      meta.content = service.serviceKey;
    }
  });
};

const applyHomepageBannerRows = (rows: HomepageBannerRow[] = []) => {
  document.querySelectorAll<HTMLElement>("[data-home-banner-row]").forEach((root) => {
    const row = rows.find((item) => item.id === root.dataset.homeBannerRow);
    const activeItems = row?.items?.filter((item) => item.isActive && item.imageUrl) || [];
    root.replaceChildren();
    root.hidden = !row?.isActive || activeItems.length === 0;
    if (root.hidden) return;
    root.dataset.bannerCount = String(activeItems.length);
    root.style.setProperty("--home-banner-columns", String(Math.min(4, Math.max(1, Number(row?.columns) || 3))));
    activeItems.forEach((item) => {
      const image = document.createElement("img");
      image.src = item.imageUrl;
      image.alt = item.alt || "";
      if (item.seoTitle) image.title = item.seoTitle;
      image.loading = "lazy";
      image.decoding = "async";
      const wrapper = item.href ? document.createElement("a") : document.createElement("div");
      wrapper.className = "home-banner-card";
      wrapper.dataset.seoTitle = item.seoTitle || item.alt || "";
      wrapper.dataset.seoDescription = item.seoDescription || "";
      wrapper.dataset.geoSummary = item.geoSummary || "";
      wrapper.dataset.ieoIntent = item.ieoIntent || "";
      wrapper.setAttribute("aria-label", item.seoTitle || item.alt || "بنر اورنزا");
      if (wrapper instanceof HTMLAnchorElement) {
        wrapper.href = item.href || "#";
        wrapper.title = item.seoTitle || item.alt || "";
      }
      wrapper.append(image);
      root.append(wrapper);
    });
  });
};

const applyHomepageProductRails = (settings: PublicSiteSettings) => {
  const bestEnabled = settings.homepageBestSellersEnabled !== false;
  const discountEnabled = settings.homepageDiscountsEnabled !== false;
  document.documentElement.dataset.homepageBestSellersEnabled = String(bestEnabled);
  document.documentElement.dataset.homepageDiscountsEnabled = String(discountEnabled);
  const bestRail = document.querySelector<HTMLElement>('[data-product-rail="best"]');
  const discountRail = document.querySelector<HTMLElement>('[data-product-rail="discount"]');
  if (!bestEnabled && bestRail) bestRail.hidden = true;
  if (!discountEnabled && discountRail) discountRail.hidden = true;
};

const applySettings = (settings: PublicSiteSettings) => {
  setText("[data-site-brand-name]", settings.brandName);
  setText("[data-site-brand-name-en]", settings.brandNameEn);
  setText("[data-site-brand-tagline]", settings.brandTagline);
  setText("[data-site-footer-heading]", settings.footerHeading);
  setText("[data-site-footer-description]", settings.footerDescription);
  setText("[data-site-footer-copyright]", settings.footerCopyright);
  setText("[data-site-phone]", settings.supportPhone);
  setText("[data-site-email]", settings.supportEmail);
  setHref("[data-site-phone-link]", `tel:${settings.supportPhone.replace(/\s/g, "")}`);
  setHref("[data-site-email-link]", `mailto:${settings.supportEmail}`);
  setHref("[data-site-whatsapp-link]", settings.whatsappUrl);
  setHref("[data-site-bale-link]", settings.baleUrl);
  setHref("[data-site-instagram-link]", settings.instagramUrl);
  const desktopBanner = document.querySelector<HTMLImageElement>("[data-site-homepage-banner-desktop]");
  if (desktopBanner && settings.homepageBannerDesktopUrl) desktopBanner.src = settings.homepageBannerDesktopUrl;

  document.querySelectorAll<HTMLElement>("[data-site-address]").forEach((element) => {
    element.textContent = settings.address || "";
    element.hidden = !settings.address;
  });
  document.querySelectorAll<HTMLImageElement>("[data-site-logo]").forEach((image) => {
    if (!settings.logoUrl) return;
    image.src = settings.logoUrl;
    image.hidden = false;
    image.parentElement?.querySelector<HTMLElement>("[data-site-logo-mark]")?.setAttribute("hidden", "");
  });
  const favicon = document.querySelector<HTMLLinkElement>("[data-site-favicon]");
  if (favicon) favicon.href = settings.faviconUrl;

  if (location.pathname === "/") {
    const fullTitle = `${settings.homepageSeoTitle} | ${settings.brandName}`;
    document.title = fullTitle;
    setMeta("description", settings.homepageSeoDescription);
    setMeta("keywords", settings.homepageSeoKeywords.join(", "));
    setMeta("og:title", fullTitle);
    setMeta("og:description", settings.homepageSeoDescription);
    setMeta("og:image", settings.homepageOgImageUrl);
    setMeta("twitter:title", fullTitle);
    setMeta("twitter:description", settings.homepageSeoDescription);
    setMeta("twitter:image", settings.homepageOgImageUrl);
  }
  if (!settings.searchIndexingEnabled) setMeta("robots", "noindex, nofollow, noarchive");
  applyHomepageBannerRows(settings.homepageBannerRows);
  applyHomepageProductRails(settings);
  applyServiceScripts(settings.scripts || []);
};

void fetch("/api/v1/site-settings", { cache: "no-store", headers: { Accept: "application/json" } })
  .then((response) => response.ok ? response.json() : Promise.reject(new Error("site settings unavailable")))
  .then((payload: { item: PublicSiteSettings }) => applySettings(payload.item))
  .catch(() => undefined);
