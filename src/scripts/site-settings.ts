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
  homepageHeroEyebrow: string;
  homepageHeroTitle: string;
  homepageHeroTitleAccent: string;
  homepageHeroDescription: string;
  homepageHeroPrimaryLabel: string;
  homepageHeroPrimaryHref: string;
  homepageHeroSecondaryLabel: string;
  homepageHeroSecondaryHref: string;
  homepageHeroBenefits: string[];
  homepageHeroBenefitItems?: HomepageHeroBenefitItem[];
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

type HomepageHeroBenefitIcon =
  | "send"
  | "cart"
  | "coffee"
  | "grind"
  | "bean"
  | "store"
  | "home"
  | "grid"
  | "bell"
  | "user"
  | "search"
  | "phone";

type HomepageHeroBenefitItem = {
  text: string;
  icon: HomepageHeroBenefitIcon;
};

const heroBenefitIcons: Record<HomepageHeroBenefitIcon, string> = {
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  cart: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  coffee: '<path d="M10 2v2"/><path d="M14 2v2"/><path d="M16 8H8a4 4 0 0 0 4 7h2a4 4 0 0 0 4-4v-1h1a2 2 0 0 0 0-4h-1Z"/><path d="M6 19h12"/>',
  grind: '<path d="M12 14a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M19.4 15a8 8 0 1 0-14.8 0"/><path d="M12 11l3-3"/>',
  bean: '<path d="M17.5 6.5c3.1 3.1 3.8 7.5 1.5 9.8s-6.7 1.6-9.8-1.5-3.8-7.5-1.5-9.8 6.7-1.6 9.8 1.5Z"/><path d="M7.7 15.3c2.4-.6 4.1-1.7 5.1-3.5 1-1.7 2.1-2.9 3.5-3.5"/>',
  store: '<path d="m2 7 2-4h16l2 4"/><path d="M4 7v13h16V7"/><path d="M8 21v-7h8v7"/><path d="M2 7h20"/>',
  home: '<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/>',
  grid: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
  bell: '<path d="M10 21h4"/><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/>',
  user: '<path d="M18 20a6 6 0 0 0-12 0"/><circle cx="12" cy="10" r="4"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.4 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/>'
};

const createHeroBenefitIcon = (icon: HomepageHeroBenefitIcon) => {
  const wrapper = document.createElement("span");
  wrapper.className = "icon";
  wrapper.setAttribute("aria-hidden", "true");
  wrapper.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round">${heroBenefitIcons[icon] || heroBenefitIcons.coffee}</svg>`;
  return wrapper;
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

const applyHomepageHero = (settings: PublicSiteSettings) => {
  setText("[data-site-homepage-hero-eyebrow]", settings.homepageHeroEyebrow);
  setText("[data-site-homepage-hero-title]", settings.homepageHeroTitle);
  setText("[data-site-homepage-hero-title-accent]", settings.homepageHeroTitleAccent);
  setText("[data-site-homepage-hero-description]", settings.homepageHeroDescription);
  setText("[data-site-homepage-hero-primary-label]", settings.homepageHeroPrimaryLabel);
  setText("[data-site-homepage-hero-secondary-label]", settings.homepageHeroSecondaryLabel);
  setHref("[data-site-homepage-hero-primary-link]", settings.homepageHeroPrimaryHref);
  setHref("[data-site-homepage-hero-secondary-link]", settings.homepageHeroSecondaryHref);
  const benefitItems = settings.homepageHeroBenefitItems?.length
    ? settings.homepageHeroBenefitItems
    : (settings.homepageHeroBenefits || []).map((text, index) => ({
      text,
      icon: (["send", "cart", "coffee", "grind", "bean"][index] || "coffee") as HomepageHeroBenefitIcon
    }));
  document.querySelectorAll<HTMLElement>("[data-site-homepage-hero-benefits]").forEach((root) => {
    root.replaceChildren();
    benefitItems.slice(0, 5).forEach((item) => {
      const wrapper = document.createElement("span");
      wrapper.className = "hero-benefit-item";
      const text = document.createElement("span");
      text.textContent = item.text;
      wrapper.append(createHeroBenefitIcon(item.icon), text);
      root.append(wrapper);
    });
  });
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
  const mobileBanner = document.querySelector<HTMLSourceElement>("[data-site-homepage-banner-mobile]");
  const mobileBannerUrl = settings.homepageBannerMobileUrl || settings.homepageBannerDesktopUrl;
  if (mobileBanner && mobileBannerUrl) mobileBanner.srcset = mobileBannerUrl;

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
  applyHomepageHero(settings);
  if (!settings.searchIndexingEnabled) setMeta("robots", "noindex, nofollow, noarchive");
  applyHomepageBannerRows(settings.homepageBannerRows);
  applyHomepageProductRails(settings);
  applyServiceScripts(settings.scripts || []);
};

void fetch("/api/v1/site-settings", { cache: "no-store", headers: { Accept: "application/json" } })
  .then((response) => response.ok ? response.json() : Promise.reject(new Error("site settings unavailable")))
  .then((payload: { item: PublicSiteSettings }) => applySettings(payload.item))
  .catch(() => undefined);
