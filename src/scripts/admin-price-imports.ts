import { AllCommunityModule, ModuleRegistry, createGrid, type ColDef, type GridApi, type ICellRendererParams } from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-material.css";

ModuleRegistry.registerModules([AllCommunityModule]);

type PriceJob = {
  id: string; file_name: string; status: "processing" | "completed" | "failed";
  total_rows: number; updated_rows: number; failed_rows: number; error_message: string | null; started_at: string;
};

const form = document.querySelector<HTMLFormElement>("[data-price-import-form]");
const fileInput = document.querySelector<HTMLInputElement>("[data-price-import-file]");
const fileName = document.querySelector<HTMLElement>("[data-price-import-file-name]");
const clearButton = document.querySelector<HTMLButtonElement>("[data-price-import-clear]");
const submitButton = document.querySelector<HTMLButtonElement>("[data-price-import-submit]");
const statusMessage = document.querySelector<HTMLElement>("[data-price-import-status]");
const dropzone = document.querySelector<HTMLElement>("[data-price-dropzone]");
const gridElement = document.querySelector<HTMLElement>("[data-price-history-grid]");
const totalNode = document.querySelector<HTMLElement>("[data-price-history-total]");
const detailDialog = document.querySelector<HTMLDialogElement>("[data-price-detail-dialog]");
const detailRows = document.querySelector<HTMLTableSectionElement>("[data-price-detail-rows]");
const detailSummary = document.querySelector<HTMLElement>("[data-price-detail-summary]");
const detailDownload = document.querySelector<HTMLAnchorElement>("[data-price-detail-download]");
const money = new Intl.NumberFormat("fa-IR");
let historyGrid: GridApi<PriceJob> | null = null;

const persianGridLocale = {
  page: "صفحه", more: "بیشتر", to: "تا", of: "از", next: "بعدی", last: "آخرین", first: "اولین", previous: "قبلی",
  loadingOoo: "در حال بارگذاری…", noRowsToShow: "رکوردی برای نمایش وجود ندارد", filterOoo: "فیلتر…", equals: "برابر است با",
  notEqual: "برابر نیست با", contains: "شامل", notContains: "شامل نیست", startsWith: "شروع می‌شود با", endsWith: "تمام می‌شود با",
  blank: "خالی", notBlank: "خالی نیست", resetFilter: "بازنشانی", applyFilter: "اعمال", clearFilter: "پاک‌کردن",
  cancelFilter: "لغو", selectAll: "انتخاب همه", searchOoo: "جست‌وجو…", pinColumn: "سنجاق‌کردن ستون",
  autosizeThiscolumn: "اندازه خودکار ستون", autosizeAllColumns: "اندازه خودکار همه ستون‌ها", resetColumns: "بازنشانی ستون‌ها",
  sortAscending: "مرتب‌سازی صعودی", sortDescending: "مرتب‌سازی نزولی", sortUnSort: "حذف مرتب‌سازی"
};
const icons = {
  eye: '<svg viewBox="0 0 24 24"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.75"/></svg>',
  download: '<svg viewBox="0 0 24 24"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 20h14"/></svg>'
};
const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] || character);
const formatDate = (value: unknown) => value ? new Date(String(value)).toLocaleString("fa-IR") : "—";

const syncFile = () => {
  const file = fileInput?.files?.[0];
  if (fileName) { fileName.textContent = file?.name || "فایلی انتخاب نشده"; fileName.classList.toggle("has-file", Boolean(file)); }
  if (clearButton) clearButton.hidden = !file;
  if (submitButton) submitButton.disabled = !file;
};

const openDetails = async (jobId: string) => {
  if (!detailDialog || !detailRows || !detailSummary || !detailDownload) return;
  detailRows.innerHTML = '<tr><td colspan="9">در حال دریافت جزئیات…</td></tr>';
  detailSummary.textContent = "در حال دریافت اطلاعات اجرا…";
  detailDownload.href = `/api/v1/admin/price-imports/${encodeURIComponent(jobId)}/file`;
  detailDialog.showModal();
  try {
    const response = await fetch(`/api/v1/admin/price-imports/${encodeURIComponent(jobId)}`, { credentials: "include" });
    const payload = await response.json() as { item?: Record<string, unknown>; rows?: Record<string, unknown>[]; error?: string };
    if (!response.ok || !payload.item) throw new Error(payload.error || "دریافت جزئیات انجام نشد.");
    const item = payload.item; const rows = payload.rows || [];
    detailSummary.textContent = `${String(item.file_name || "فایل قیمت")}؛ ${Number(item.updated_rows || 0)} ردیف به‌روزرسانی و ${Number(item.failed_rows || 0)} ردیف رد شده است.`;
    detailRows.innerHTML = rows.length ? rows.map((row) => {
      const increaseType = row.increase_type === "percent" ? "درصدی" : row.increase_type === "fixed" ? "مبلغ ثابت" : "بدون تغییر فروش";
      const result = row.status === "updated" ? "به‌روزرسانی شد" : escapeHtml(row.error_message || "ناموفق");
      const formatMoney = (value: unknown) => value === null || value === undefined ? "—" : money.format(Number(value));
      return `<tr><td>${escapeHtml(row.row_number)}</td><td>${escapeHtml(row.product_title || row.product_identifier)}</td><td>${formatMoney(row.previous_purchase_price)}</td><td>${formatMoney(row.new_purchase_price)}</td><td>${formatMoney(row.previous_sale_price)}</td><td>${formatMoney(row.new_sale_price)}</td><td>${increaseType}</td><td>${escapeHtml(row.increase_value ?? "—")}</td><td>${result}</td></tr>`;
    }).join("") : '<tr><td colspan="9">جزئیاتی برای این اجرا ثبت نشده است.</td></tr>';
  } catch (error) {
    detailSummary.textContent = error instanceof Error ? error.message : "دریافت جزئیات انجام نشد.";
    detailRows.innerHTML = '<tr><td colspan="9">امکان نمایش جزئیات وجود ندارد.</td></tr>';
  }
};

const downloadFile = (jobId: string) => {
  const link = document.createElement("a");
  link.href = `/api/v1/admin/price-imports/${encodeURIComponent(jobId)}/file`;
  link.download = ""; document.body.append(link); link.click(); link.remove();
};
const actionRenderer = ({ data }: ICellRendererParams<PriceJob>) => {
  const root = document.createElement("div"); root.className = "admin-row-actions";
  if (!data) return root;
  const button = (label: string, icon: string, handler: () => void) => {
    const item = document.createElement("button"); item.type = "button"; item.title = label; item.setAttribute("aria-label", label);
    item.innerHTML = icon; item.addEventListener("click", handler); return item;
  };
  root.append(
    button("مشاهده جزئیات", icons.eye, () => void openDetails(data.id)),
    button("دانلود فایل", icons.download, () => downloadFile(data.id))
  );
  return root;
};
const statusRenderer = ({ data }: ICellRendererParams<PriceJob>) => {
  const node = document.createElement("span"); node.className = "price-job-status admin-status";
  if (!data) return node;
  const partial = data.status === "completed" && Number(data.failed_rows) > 0;
  node.classList.add(partial ? "status-pending" : data.status === "completed" ? "status-completed" : "status-canceled");
  node.textContent = partial ? "انجام شد با خطا" : data.status === "completed" ? "موفق" : "ناموفق";
  return node;
};

const loadHistory = async () => {
  historyGrid?.setGridOption("loading", true);
  try {
    const response = await fetch("/api/v1/admin/price-imports", { credentials: "include" });
    const payload = await response.json() as { items?: PriceJob[]; error?: string };
    if (!response.ok) throw new Error(payload.error || "دریافت تاریخچه انجام نشد.");
    const rows = payload.items || [];
    historyGrid?.setGridOption("rowData", rows);
    if (totalNode) totalNode.textContent = `${rows.length.toLocaleString("fa-IR")} اجرا`;
  } catch (error) {
    if (totalNode) totalNode.textContent = error instanceof Error ? error.message : "خطا در دریافت تاریخچه";
  } finally { historyGrid?.setGridOption("loading", false); }
};

if (gridElement) {
  const columns: ColDef<PriceJob>[] = [
    { headerName: "تاریخ اجرا", field: "started_at", minWidth: 175, filter: "agDateColumnFilter", valueFormatter: ({ value }) => formatDate(value) },
    { headerName: "فایل", field: "file_name", minWidth: 230, filter: "agTextColumnFilter" },
    { headerName: "وضعیت", field: "status", minWidth: 145, cellClass: "admin-status-cell", headerClass: "admin-status-header", cellRenderer: statusRenderer },
    { headerName: "تعداد ردیف", field: "total_rows", minWidth: 125, filter: "agNumberColumnFilter" },
    { headerName: "به‌روزرسانی", field: "updated_rows", minWidth: 125, filter: "agNumberColumnFilter" },
    { headerName: "ردشده", field: "failed_rows", minWidth: 110, filter: "agNumberColumnFilter" },
    { headerName: "خطا", field: "error_message", minWidth: 260, valueFormatter: ({ value }) => String(value || "—") },
    { headerName: "عملیات", pinned: "left", width: 98, minWidth: 98, maxWidth: 98, filter: false, sortable: false, cellRenderer: actionRenderer }
  ];
  historyGrid = createGrid<PriceJob>(gridElement, {
    theme: "legacy", columnDefs: columns, rowData: [], enableRtl: true, animateRows: true, localeText: persianGridLocale,
    rowHeight: 56, headerHeight: 52, pagination: true, paginationPageSize: 15,
    paginationPageSizeSelector: [15, 25, 50, 100], suppressCellFocus: true,
    defaultColDef: { resizable: true, sortable: true, filter: true, floatingFilter: false, filterParams: { buttons: ["reset"], debounceMs: 250 } },
    onGridReady: () => void loadHistory(),
    onFilterChanged: () => { if (totalNode && historyGrid) totalNode.textContent = `${historyGrid.getDisplayedRowCount().toLocaleString("fa-IR")} اجرا`; }
  });
}

fileInput?.addEventListener("change", syncFile);
dropzone?.addEventListener("dragover", (event) => { event.preventDefault(); dropzone.classList.add("is-dragging"); });
dropzone?.addEventListener("dragleave", () => dropzone.classList.remove("is-dragging"));
dropzone?.addEventListener("drop", (event) => {
  event.preventDefault(); dropzone.classList.remove("is-dragging");
  const droppedFile = event.dataTransfer?.files?.[0];
  if (!droppedFile || !/\.(xlsx|xls|csv)$/i.test(droppedFile.name)) { if (statusMessage) statusMessage.textContent = "فقط فایل Excel یا CSV قابل بارگذاری است."; return; }
  if (fileInput && typeof DataTransfer !== "undefined") { const transfer = new DataTransfer(); transfer.items.add(droppedFile); fileInput.files = transfer.files; syncFile(); }
});
clearButton?.addEventListener("click", () => { if (fileInput) fileInput.value = ""; syncFile(); });
document.querySelector("[data-price-detail-close]")?.addEventListener("click", () => detailDialog?.close());
detailDialog?.addEventListener("click", (event) => { if (event.target === detailDialog) detailDialog.close(); });

form?.addEventListener("submit", async (event) => {
  event.preventDefault(); const file = fileInput?.files?.[0]; if (!file) return;
  submitButton!.disabled = true; statusMessage!.textContent = "Job در حال اجراست…";
  try {
    const body = new FormData(); body.append("file", file);
    const response = await fetch("/api/v1/admin/price-imports", { method: "POST", credentials: "include", body });
    const payload = await response.json() as { updatedRows?: number; failedRows?: number; error?: string };
    if (!response.ok) throw new Error(payload.error || "به‌روزرسانی قیمت انجام نشد.");
    statusMessage!.textContent = payload.failedRows ? `${payload.updatedRows || 0} محصول به‌روزرسانی شد و ${payload.failedRows} ردیف نامعتبر رد شد.` : `${payload.updatedRows || 0} محصول با موفقیت به‌روزرسانی شد.`;
    if (fileInput) fileInput.value = ""; syncFile(); await loadHistory();
  } catch (error) { statusMessage!.textContent = error instanceof Error ? error.message : "به‌روزرسانی قیمت انجام نشد."; }
  finally { submitButton!.disabled = !fileInput?.files?.[0]; }
});

syncFile();
