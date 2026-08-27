import {
  AllCommunityModule,
  ModuleRegistry,
  createGrid,
  type ColDef,
  type GridApi,
  type ICellRendererParams
} from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-material.css";
import Swal from "sweetalert2";
import { initRichTextEditors } from "./admin";
import type { Editor } from "@tiptap/core";
import { persianGridLocale } from "./admin";

ModuleRegistry.registerModules([AllCommunityModule]);

type ContentTemplate = {
  id: string;
  title: string;
  description: string;
  contentType: string;
  audience: string;
  tone: string;
  language: "fa" | "en";
  length: "short" | "medium" | "long";
  extraInstructions: string;
  isSystem: boolean;
  updatedAt: string;
};

const form = document.querySelector<HTMLFormElement>("[data-content-generator]");
const submit = document.querySelector<HTMLButtonElement>("[data-content-submit]");
const saveTemplate = document.querySelector<HTMLButtonElement>("[data-template-save]");
const statusMessage = document.querySelector<HTMLElement>("[data-content-status]");
const result = document.querySelector<HTMLElement>("[data-content-result]");
const output = document.querySelector<HTMLTextAreaElement>("[data-content-output], [data-rich-text-input=generatedContent]");
const editorElement = document.querySelector<HTMLElement>("[data-rich-text-editor=generatedContent]") as (HTMLElement & { _tiptap?: Editor }) | null;
const keywordFile = document.querySelector<HTMLInputElement>("[data-keyword-file]");
const keywordAnalyze = document.querySelector<HTMLButtonElement>("[data-keyword-analyze]");
const keywordStatus = document.querySelector<HTMLElement>("[data-keyword-status]");
const keywordFileName = document.querySelector<HTMLElement>("[data-keyword-file-name]");
const keywordClear = document.querySelector<HTMLButtonElement>("[data-keyword-clear]");
const keywordDropzone = document.querySelector<HTMLElement>("[data-keyword-dropzone]");
const gridRoot = document.querySelector<HTMLElement>("[data-content-template-grid]");
const gridStatus = document.querySelector<HTMLElement>("[data-template-grid-status]");
const isTemplateManagement = gridRoot?.dataset.templateMode === "management";
const templateSelect = document.querySelector<HTMLSelectElement>("[data-template-select]");
let templates: ContentTemplate[] = [];
let gridApi: GridApi<ContentTemplate> | null = null;

const field = <T extends HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(name: string) =>
  form?.elements.namedItem(name) as T | null;
const setField = (name: string, value: string) => {
  const input = field(name);
  if (!input) return;
  input.value = value;
  const richEditor = form?.querySelector<HTMLElement>(`[data-rich-text-editor="${name}"]`) as (HTMLElement & { _tiptap?: Editor }) | null;
  richEditor?._tiptap?.commands.setContent(value || "");
  input.dispatchEvent(new Event("change", { bubbles: true }));
};
const request = async <T>(url: string, options: RequestInit = {}) => {
  const response = await fetch(url, {
    credentials: "include",
    ...options,
    headers: options.body ? { "Content-Type": "application/json", ...(options.headers || {}) } : options.headers
  });
  const payload = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(payload?.error || "انجام درخواست ممکن نشد.");
  return payload as T;
};

const templatePayload = () => ({
  title: field<HTMLInputElement>("templateTitle")?.value.trim() || "",
  description: field<HTMLInputElement>("templateDescription")?.value.trim() || "",
  contentType: field<HTMLSelectElement>("contentType")?.value || "",
  audience: field<HTMLInputElement>("audience")?.value.trim() || "",
  tone: field<HTMLInputElement>("tone")?.value.trim() || "",
  language: field<HTMLSelectElement>("language")?.value || "fa",
  length: field<HTMLSelectElement>("length")?.value || "medium",
  extraInstructions: field<HTMLTextAreaElement>("extraInstructions")?.value.trim() || ""
});

const applyTemplate = (template: ContentTemplate, scrollToForm = true) => {
  setField("templateId", template.id);
  setField("templateTitle", template.title);
  setField("templateDescription", template.description || "");
  setField("contentType", template.contentType);
  setField("audience", template.audience || "");
  setField("tone", template.tone || "");
  setField("language", template.language);
  setField("length", template.length);
  setField("extraInstructions", template.extraInstructions || "");
  const heading = document.querySelector<HTMLElement>("[data-template-form-title]");
  if (heading) heading.textContent = `ویرایش و استفاده از «${template.title}»`;
  statusMessage!.textContent = "قالب انتخاب شد؛ موضوع را وارد و محتوا را تولید کنید.";
  if (scrollToForm) document.querySelector(".admin-content-brief-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
};

const confirmDelete = async (template: ContentTemplate) => {
  const decision = await Swal.fire({
    title: "حذف قالب محتوا",
    text: `قالب «${template.title}» حذف شود؟`,
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "حذف قالب",
    cancelButtonText: "انصراف",
    reverseButtons: true,
    buttonsStyling: false,
    customClass: { popup: "admin-swal", title: "admin-swal-title", htmlContainer: "admin-swal-content", actions: "admin-swal-actions", confirmButton: "admin-swal-confirm", cancelButton: "admin-swal-cancel" },
    didOpen: (popup) => popup.setAttribute("dir", "rtl")
  });
  if (!decision.isConfirmed) return;
  try {
    await request(`/api/v1/admin/content-templates/${template.id}`, { method: "DELETE" });
    await loadTemplates();
    statusMessage!.textContent = "قالب حذف شد.";
  } catch (error) { statusMessage!.textContent = error instanceof Error ? error.message : "حذف قالب انجام نشد."; }
};

const actionRenderer = (params: ICellRendererParams<ContentTemplate>) => {
  const root = document.createElement("div");
  root.className = "admin-row-actions content-template-actions";
  if (params.data?.id && isTemplateManagement) {
    const edit = document.createElement("a");
    edit.href = `/admin/content-generator/edit/?id=${encodeURIComponent(params.data.id)}`;
    edit.title = "ویرایش قالب";
    edit.setAttribute("aria-label", edit.title);
    edit.innerHTML = '<svg viewBox="0 0 24 24"><path d="m4 20 4.2-1 10.6-10.6-3.2-3.2L5 15.8 4 20Z"/><path d="m13.8 7 3.2 3.2"/></svg>';
    root.append(edit);
  }
  if (params.data?.id && !isTemplateManagement) {
    const use = document.createElement("a");
    use.href = `/admin/content-generator/use/?id=${encodeURIComponent(params.data.id)}`;
    use.title = "استفاده از قالب و تولید محتوا"; use.setAttribute("aria-label", use.title);
    use.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1-1-4Z"/></svg>';
    root.append(use);
  }
  return root;
};

const columns: ColDef<ContentTemplate>[] = [
  { headerName: "ردیف", valueGetter: ({ node }) => (node?.rowIndex ?? 0) + 1, width: 78, minWidth: 78, maxWidth: 78, filter: false, sortable: false, pinned: "right" },
  { headerName: "نام قالب", field: "title", minWidth: 190, flex: 1.2 },
  { headerName: "نوع محتوا", field: "contentType", minWidth: 150, flex: 1 },
  { headerName: "توضیح", field: "description", minWidth: 260, flex: 1.8 },
  { headerName: "زبان", field: "language", width: 90, valueFormatter: ({ value }) => value === "en" ? "English" : "فارسی" },
  { headerName: "طول", field: "length", width: 105, valueFormatter: ({ value }) => ({ short: "کوتاه", medium: "متوسط", long: "کامل" }[String(value)] || value) },
  { headerName: "نوع قالب", field: "isSystem", width: 110, valueFormatter: ({ value }) => value ? "پیش‌فرض" : "اختصاصی" },
  { headerName: "عملیات", width: 165, minWidth: 165, maxWidth: 165, pinned: "left", sortable: false, filter: false, cellRenderer: actionRenderer }
];

const loadTemplates = async () => {
  if (gridStatus) gridStatus.textContent = "در حال دریافت قالب‌ها…";
  try {
    const payload = await request<{ items: ContentTemplate[] }>("/api/v1/admin/content-templates");
    templates = payload.items;
    gridApi?.setGridOption("rowData", templates);
    if (gridStatus) gridStatus.textContent = `${templates.length.toLocaleString("fa-IR")} قالب آماده است؛ روی هر ردیف کلیک کنید.`;
    if (!field<HTMLInputElement>("templateId")?.value && templates[0]) applyTemplate(templates[0], false);
  } catch (error) { if (gridStatus) gridStatus.textContent = error instanceof Error ? error.message : "دریافت قالب‌ها انجام نشد."; }
};

if (form) initRichTextEditors(form);
if (gridRoot) {
  gridApi = createGrid<ContentTemplate>(gridRoot, {
    theme: "legacy",
    columnDefs: columns,
    rowData: [],
    defaultColDef: { sortable: true, filter: true, resizable: true, floatingFilter: false, filterParams: { buttons: ["reset"], debounceMs: 250 } },
    rowHeight: 56,
    headerHeight: 52,
    pagination: true,
    paginationPageSize: 10,
    paginationPageSizeSelector: [10, 20, 50],
    enableRtl: true,
    localeText: persianGridLocale,
    onRowClicked: ({ data }) => { if (data) applyTemplate(data); }
  });
  void loadTemplates();
}

if (!gridRoot) {
  const id = new URLSearchParams(location.search).get("id");
  void request<{ items: ContentTemplate[] }>("/api/v1/admin/content-templates")
    .then(({ items }) => {
      if (!templateSelect) return;
      templates = items;
      templateSelect.innerHTML = '<option value="">بدون قالب؛ تولید عمومی</option>';
      items.forEach((template) => templateSelect.add(new Option(template.title, template.id)));
      if (id && items.some((template) => template.id === id)) templateSelect.value = id;
      const selected = items.find((template) => template.id === templateSelect.value);
      if (selected) applyTemplate(selected, false);
    })
    .catch((error) => { if (statusMessage) statusMessage.textContent = error instanceof Error ? error.message : "دریافت قالب‌ها انجام نشد."; });
  templateSelect?.addEventListener("change", () => {
    const selected = templates.find((template) => template.id === templateSelect.value);
    if (selected) applyTemplate(selected, false);
    else setField("templateId", "");
  });
}

document.querySelector<HTMLButtonElement>("[data-template-new]")?.addEventListener("click", () => {
  setField("templateId", ""); setField("templateTitle", ""); setField("templateDescription", "");
  setField("contentType", "مقاله وبلاگ"); setField("extraInstructions", "");
  const heading = document.querySelector<HTMLElement>("[data-template-form-title]");
  if (heading) heading.textContent = "ساخت قالب جدید";
  field<HTMLInputElement>("templateTitle")?.focus();
});

saveTemplate?.addEventListener("click", async () => {
  const body = templatePayload();
  if (body.title.length < 2 || body.contentType.length < 2) { statusMessage!.textContent = "نام و نوع قالب را کامل کنید."; return; }
  const id = field<HTMLInputElement>("templateId")?.value;
  saveTemplate.disabled = true; statusMessage!.textContent = "در حال ذخیره قالب…";
  try {
    const payload = await request<{ item: ContentTemplate }>(`/api/v1/admin/content-templates${id ? `/${id}` : ""}`, {
      method: id ? "PATCH" : "POST",
      body: JSON.stringify(body)
    });
    await loadTemplates(); applyTemplate(payload.item); statusMessage!.textContent = "قالب با موفقیت ذخیره شد.";
  } catch (error) { statusMessage!.textContent = error instanceof Error ? error.message : "ذخیره قالب انجام نشد."; }
  finally { saveTemplate.disabled = false; }
});

const syncKeywordFile = () => {
  const file = keywordFile?.files?.[0];
  if (keywordFileName) { keywordFileName.textContent = file ? file.name : "فایلی انتخاب نشده"; keywordFileName.classList.toggle("has-file", Boolean(file)); }
  if (keywordAnalyze) keywordAnalyze.disabled = !file;
  if (keywordClear) keywordClear.hidden = !file;
};
const isSupportedKeywordFile = (file: File) => /\.(xlsx|xls|csv)$/i.test(file.name) || /^image\/(jpeg|png|webp)$/i.test(file.type);
const setKeywordFile = (file: File) => {
  if (!keywordFile) return;
  if (!isSupportedKeywordFile(file)) {
    if (keywordStatus) keywordStatus.textContent = "فرمت فایل باید Excel، CSV یا تصویر JPG/PNG/WebP باشد.";
    return;
  }
  const transfer = new DataTransfer();
  transfer.items.add(file);
  keywordFile.files = transfer.files;
  if (keywordStatus) keywordStatus.textContent = "";
  syncKeywordFile();
};
keywordFile?.addEventListener("change", syncKeywordFile);
keywordClear?.addEventListener("click", () => { if (keywordFile) keywordFile.value = ""; if (keywordStatus) keywordStatus.textContent = ""; keywordDropzone?.classList.remove("is-dragover"); syncKeywordFile(); });
keywordDropzone?.addEventListener("click", () => keywordFile?.click());
keywordDropzone?.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  keywordFile?.click();
});
["dragenter", "dragover"].forEach((eventName) => {
  keywordDropzone?.addEventListener(eventName, (event) => {
    event.preventDefault();
    keywordDropzone.classList.add("is-dragover");
  });
});
["dragleave", "dragend", "drop"].forEach((eventName) => {
  keywordDropzone?.addEventListener(eventName, () => keywordDropzone.classList.remove("is-dragover"));
});
keywordDropzone?.addEventListener("drop", (event) => {
  event.preventDefault();
  const file = event.dataTransfer?.files?.[0];
  if (file) setKeywordFile(file);
});
syncKeywordFile();

void request<{ item?: { contentAiDefaultAudience?: string; contentAiDefaultTone?: string; contentAiDefaultLength?: string; contentAiDefaultLanguage?: string } }>("/api/v1/admin/site-settings")
  .then(({ item }) => {
    if (!item || field<HTMLInputElement>("templateId")?.value) return;
    if (item.contentAiDefaultAudience) setField("audience", item.contentAiDefaultAudience);
    if (item.contentAiDefaultTone) setField("tone", item.contentAiDefaultTone);
    if (item.contentAiDefaultLength) setField("length", item.contentAiDefaultLength);
    if (item.contentAiDefaultLanguage) setField("language", item.contentAiDefaultLanguage);
  }).catch(() => undefined);

keywordAnalyze?.addEventListener("click", async () => {
  const file = keywordFile?.files?.[0];
  if (!file) { keywordStatus!.textContent = "ابتدا یک فایل انتخاب کنید."; return; }
  keywordAnalyze.disabled = true; keywordStatus!.textContent = "در حال تحلیل فایل…";
  try {
    const body = new FormData(); body.append("file", file);
    const response = await fetch("/api/v1/admin/content-keywords", { method: "POST", credentials: "include", body });
    const payload = await response.json() as { keywords?: string; error?: string };
    if (!response.ok || !payload.keywords) throw new Error(payload.error || "تحلیل فایل انجام نشد.");
    setField("keywords", payload.keywords.slice(0, 5000)); keywordStatus!.textContent = "کلمات کلیدی استخراج و وارد شد.";
  } catch (error) { keywordStatus!.textContent = error instanceof Error ? error.message : "تحلیل فایل انجام نشد."; }
  finally { syncKeywordFile(); }
});

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const data = Object.fromEntries(new FormData(form).entries());
  submit!.disabled = true; statusMessage!.textContent = "در حال تولید محتوا…";
  try {
    const payload = await request<{ content: string }>("/api/v1/admin/content-generator", { method: "POST", body: JSON.stringify(data) });
    const content = payload.content.replace(/^```(?:html)?\s*/i, "").replace(/\s*```$/i, "");
    editorElement?._tiptap?.commands.setContent(content);
    result!.hidden = false; statusMessage!.textContent = "محتوا تولید شد؛ می‌توانید خروجی را در ادیتور تغییر دهید.";
    result?.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) { statusMessage!.textContent = error instanceof Error ? error.message : "تولید محتوا انجام نشد."; }
  finally { submit!.disabled = false; }
});

document.querySelector<HTMLButtonElement>("[data-content-copy]")?.addEventListener("click", async (event) => {
  await navigator.clipboard.writeText(output?.value || "");
  const button = event.currentTarget as HTMLButtonElement; const label = button.textContent;
  button.textContent = "کپی شد ✓"; window.setTimeout(() => { button.textContent = label; }, 1600);
});

document.querySelector<HTMLButtonElement>("[data-content-download]")?.addEventListener("click", () => {
  const blob = new Blob([output?.value || ""], { type: "text/html;charset=utf-8" });
  const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "orenza-content.html"; link.click(); URL.revokeObjectURL(link.href);
});
