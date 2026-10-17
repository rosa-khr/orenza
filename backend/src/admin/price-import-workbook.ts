import * as XLSX from "xlsx";

const xlsxRuntime = XLSX as unknown as {
  CFB?: typeof XLSX.CFB;
  default?: { CFB?: typeof XLSX.CFB };
};

export type PriceImportSampleProduct = {
  id: string;
  title_fa: string;
  purchase_price_per_kg: number;
  category_title: string | null;
  category_slug: string | null;
  stock_status: "inStock" | "outOfStock";
  show_in_best_sellers: boolean;
  show_in_discounts: boolean;
  show_in_popular_footer: boolean;
  show_in_popular_searches: boolean;
  is_active: boolean;
};

export const priceImportHeaders = [
  "product_id", "category", "product", "purchase_price_per_kg_toman", "increase_type", "increase_value",
  "is_in_stock", "show_in_best_sellers", "show_in_discounts", "show_in_popular_footer",
  "show_in_popular_searches", "is_active"
];

const applyExcelFont = (input: Buffer, fontName: string) => {
  const CFB = xlsxRuntime.CFB || xlsxRuntime.default?.CFB;
  if (!CFB) throw new Error("امکان اعمال فونت روی فایل Excel وجود ندارد.");
  const archive = CFB.read(input, { type: "buffer" });
  for (const path of archive.FullPaths.filter((item: string) => item.endsWith("/xl/styles.xml") || item.includes("/xl/theme/"))) {
    const entry = CFB.find(archive, path);
    if (!entry) continue;
    entry.content = Buffer.from(Buffer.from(entry.content).toString("utf8").replace(/Calibri/g, fontName));
  }
  return Buffer.from(CFB.write(archive, { type: "buffer", fileType: "zip" }));
};

export const createPriceImportWorkbook = (products: PriceImportSampleProduct[]) => {
  const workbook = XLSX.utils.book_new();
  workbook.Workbook = { Views: [{ RTL: true }] };
  const collator = new Intl.Collator("fa-IR", { numeric: true, sensitivity: "base" });
  const sortedProducts = [...products].sort((left, right) => {
    const leftCategory = left.category_title || "بدون دسته‌بندی";
    const rightCategory = right.category_title || "بدون دسته‌بندی";
    return collator.compare(leftCategory, rightCategory) || collator.compare(left.title_fa, right.title_fa);
  });
  const sheet = XLSX.utils.aoa_to_sheet([
    priceImportHeaders,
    ...sortedProducts.map((product) => [
      product.id,
      product.category_title || "بدون دسته‌بندی",
      product.title_fa,
      Number(product.purchase_price_per_kg),
      "",
      "",
      product.stock_status === "inStock",
      product.show_in_best_sellers,
      product.show_in_discounts,
      product.show_in_popular_footer,
      product.show_in_popular_searches,
      product.is_active
    ])
  ]);
  sheet["!cols"] = [
    { wch: 38 }, { wch: 24 }, { wch: 30 }, { wch: 27 }, { wch: 18 }, { wch: 18 },
    { wch: 16 }, { wch: 23 }, { wch: 21 }, { wch: 24 }, { wch: 27 }, { wch: 14 }
  ];
  sheet["!autofilter"] = { ref: `A1:L${sortedProducts.length + 1}` };
  XLSX.utils.book_append_sheet(workbook, sheet, "محصولات");

  const generatedFile = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  return applyExcelFont(Buffer.from(generatedFile), "Vazirmatn");
};
