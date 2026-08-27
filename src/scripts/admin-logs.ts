import { AllCommunityModule, ModuleRegistry, createGrid, type ColDef, type ICellRendererParams } from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-material.css";

ModuleRegistry.registerModules([AllCommunityModule]);

type LogRow = {
  id: number; level: "info" | "warn" | "error"; event: string; message: string;
  request_id: string | null; method: string | null; route: string | null;
  status_code: number | null; duration_ms: number | null; metadata: unknown; created_at: string;
};

const gridElement = document.querySelector<HTMLElement>("[data-log-grid]");
const totalNode = document.querySelector<HTMLElement>("[data-log-total]");
const dialog = document.querySelector<HTMLDialogElement>("[data-log-dialog]");
const detail = document.querySelector<HTMLElement>("[data-log-detail]");
const download = document.querySelector<HTMLButtonElement>("[data-log-download]");
let selectedLog: LogRow | null = null;
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
  eye: '<svg viewBox="0 0 24 24"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/></svg>',
  download: '<svg viewBox="0 0 24 24"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 20h14"/></svg>'
};

const fetchRows = async () => {
  const rows: LogRow[] = [];
  let page = 1; let total = 0;
  do {
    const response = await fetch(`/api/v1/admin/logs?page=${page}&pageSize=100`, { credentials: "include" });
    const payload = await response.json() as { items?: LogRow[]; total?: number; error?: string };
    if (!response.ok) throw new Error(payload.error || "دریافت لاگ‌ها انجام نشد.");
    rows.push(...(payload.items || [])); total = payload.total || 0; page += 1;
  } while (rows.length < total);
  return rows;
};

const getLog = async (id: number) => {
  const response = await fetch(`/api/v1/admin/logs/${id}`, { credentials: "include" });
  const payload = await response.json() as { item?: LogRow; error?: string };
  if (!response.ok || !payload.item) throw new Error(payload.error || "دریافت لاگ انجام نشد.");
  return payload.item;
};

const openLog = async (id: number) => {
  detail!.textContent = "در حال دریافت..."; dialog?.showModal();
  selectedLog = await getLog(id); detail!.textContent = JSON.stringify(selectedLog, null, 2);
};

const downloadLog = async (id: number) => {
  const log = await getLog(id);
  const blob = new Blob([JSON.stringify(log, null, 2)], { type: "application/json;charset=utf-8" });
  const link = document.createElement("a"); link.href = URL.createObjectURL(blob);
  link.download = `orenza-log-${id}.json`; link.click(); URL.revokeObjectURL(link.href);
};

const actionRenderer = ({ data }: ICellRendererParams<LogRow>) => {
  const root = document.createElement("div"); root.className = "admin-row-actions";
  if (!data) return root;
  const button = (label: string, icon: string, handler: () => void) => {
    const item = document.createElement("button"); item.type = "button"; item.title = label;
    item.setAttribute("aria-label", label); item.innerHTML = icon; item.addEventListener("click", handler); return item;
  };
  root.append(
    button("مشاهده لاگ", icons.eye, () => void openLog(data.id).catch((error) => { detail!.textContent = error instanceof Error ? error.message : "خطا"; })),
    button("دانلود لاگ", icons.download, () => void downloadLog(data.id))
  );
  return root;
};

const displayDate = (value: unknown) => value ? new Date(String(value)).toLocaleString("fa-IR") : "—";
const column = (headerName: string, field: keyof LogRow, minWidth: number, filter = "agTextColumnFilter"): ColDef<LogRow> => ({
  headerName, field, minWidth, filter, valueFormatter: ({ value }) => String(value ?? "—")
});

if (gridElement) {
  const columns: ColDef<LogRow>[] = [
    { headerName: "زمان", field: "created_at", minWidth: 180, filter: "agDateColumnFilter", valueFormatter: ({ value }) => displayDate(value) },
    column("سطح", "level", 110), column("رویداد", "event", 170), column("متد", "method", 95),
    column("مسیر", "route", 220), { ...column("وضعیت", "status_code", 100, "agNumberColumnFilter"), valueFormatter: ({ value }) => String(value ?? "—") },
    { ...column("زمان پاسخ", "duration_ms", 120, "agNumberColumnFilter"), valueFormatter: ({ value }) => value == null ? "—" : `${value}ms` },
    column("پیام", "message", 260), column("شناسه درخواست", "request_id", 220),
    { headerName: "عملیات", pinned: "left", width: 98, minWidth: 98, maxWidth: 98, filter: false, sortable: false, cellRenderer: actionRenderer }
  ];
  const api = createGrid<LogRow>(gridElement, {
    theme: "legacy", columnDefs: columns, rowData: [], enableRtl: true, animateRows: true, localeText: persianGridLocale,
    rowHeight: 56, headerHeight: 52, pagination: true, paginationPageSize: 15,
    paginationPageSizeSelector: [15, 25, 50, 100], suppressCellFocus: true,
    defaultColDef: { resizable: true, sortable: true, filter: true, floatingFilter: false, filterParams: { buttons: ["reset"], debounceMs: 250 } },
    onGridReady: async () => {
      api.setGridOption("loading", true);
      try { const rows = await fetchRows(); api.setGridOption("rowData", rows); totalNode!.textContent = `${rows.length.toLocaleString("fa-IR")} رکورد`; }
      catch (error) { totalNode!.textContent = error instanceof Error ? error.message : "خطا در دریافت لاگ‌ها"; }
      finally { api.setGridOption("loading", false); }
    },
    onFilterChanged: () => { totalNode!.textContent = `${api.getDisplayedRowCount().toLocaleString("fa-IR")} رکورد`; }
  });
}

download?.addEventListener("click", () => { if (selectedLog) void downloadLog(selectedLog.id); });
