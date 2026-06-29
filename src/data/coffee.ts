export const blends = [
  { id: "r100", title: "۱۰۰٪ روبوستا", en: "100% ROBUSTA", note: "بسیار قوی، تلخ و پرکافئین", taste: "کاکائو، چوب، ادویه", caffeine: 5, body: 5, acidity: 1, crema: 5 },
  { id: "r90", title: "۹۰٪ روبوستا", en: "90% ROBUSTA", note: "انرژی بالا با عطر متعادل‌تر", taste: "شکلات تلخ، فندق", caffeine: 5, body: 5, acidity: 1, crema: 5 },
  { id: "r80", title: "۸۰٪ روبوستا", en: "80% ROBUSTA", note: "پرقدرت، خوش‌کِرما و ماندگار", taste: "شکلات، کارامل، آجیل", caffeine: 4, body: 5, acidity: 2, crema: 5 },
  { id: "r70", title: "۷۰٪ روبوستا", en: "70% ROBUSTA", note: "قدرت و عطر در تعادل", taste: "کاکائو، کارامل، ادویه", caffeine: 4, body: 4, acidity: 2, crema: 4 },
  { id: "half", title: "۵۰٪ روبوستا · ۵۰٪ عربیکا", en: "HOUSE BALANCE", note: "متعادل، شیرین و همه‌پسند", taste: "کارامل، مغزها، میوه خشک", caffeine: 3, body: 4, acidity: 3, crema: 4 },
  { id: "a70", title: "۷۰٪ عربیکا", en: "70% ARABICA", note: "معطر، نرم و شیرین", taste: "میوه، شکلات شیری، گل", caffeine: 2, body: 3, acidity: 4, crema: 3 },
  { id: "a100", title: "۱۰۰٪ عربیکا", en: "100% ARABICA", note: "پیچیده، لطیف و بسیار معطر", taste: "مرکبات، گل، میوه‌های قرمز", caffeine: 1, body: 2, acidity: 5, crema: 2 }
] as const;

export const roasts = [
  { id: "light", title: "روشن", en: "LIGHT ROAST", note: "اسیدیته زنده، عطر میوه‌ای و منشأ دانه", level: 1 },
  { id: "medium", title: "متوسط", en: "MEDIUM ROAST", note: "شیرینی، عطر و بادی متعادل", level: 2 },
  { id: "medium-dark", title: "متوسط رو به تیره", en: "MEDIUM–DARK", note: "کارامل عمیق، بادی بیشتر و اسیدیته کمتر", level: 3 },
  { id: "dark", title: "تیره", en: "DARK ROAST", note: "تلخی شکلاتی، بادی سنگین و افترتیست بلند", level: 4 }
] as const;

export const devices = [
  { id: "turkish", title: "قهوه ترک", en: "TURKISH / CEZVE", grindFa: "بسیار ریز", grindEn: "EXTRA FINE", grind: 1, mark: "TK" },
  { id: "espresso", title: "اسپرسوساز", en: "ESPRESSO", grindFa: "ریز", grindEn: "FINE", grind: 2, mark: "ES" },
  { id: "moka", title: "موکاپات", en: "MOKA POT", grindFa: "متوسط رو به ریز", grindEn: "MEDIUM FINE", grind: 3, mark: "MK" },
  { id: "aeropress", title: "ائروپرس", en: "AEROPRESS", grindFa: "متوسط رو به ریز", grindEn: "MEDIUM FINE", grind: 3, mark: "AP" },
  { id: "v60", title: "وی‌۶۰", en: "V60", grindFa: "متوسط", grindEn: "MEDIUM", grind: 4, mark: "V60" },
  { id: "filter", title: "قهوه‌ساز فیلتری", en: "DRIP COFFEE", grindFa: "متوسط", grindEn: "MEDIUM", grind: 4, mark: "DR" },
  { id: "siphon", title: "سایفون", en: "SIPHON", grindFa: "متوسط", grindEn: "MEDIUM", grind: 4, mark: "SY" },
  { id: "chemex", title: "کمکس", en: "CHEMEX", grindFa: "متوسط رو به درشت", grindEn: "MEDIUM COARSE", grind: 5, mark: "CH" },
  { id: "french", title: "فرنچ‌پرس", en: "FRENCH PRESS", grindFa: "درشت", grindEn: "COARSE", grind: 6, mark: "FP" },
  { id: "cold", title: "کلدبرو", en: "COLD BREW", grindFa: "بسیار درشت", grindEn: "EXTRA COARSE", grind: 7, mark: "CB" }
] as const;

export const weights = ["۲۵۰ گرم", "۵۰۰ گرم", "۱ کیلوگرم", "عمده"] as const;
