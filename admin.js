/* =====================================================
   SiLaporFasum - Admin JavaScript
   Supabase + Dashboard + Laporan + Petugas
===================================================== */

const SUPABASE_URL = "https://ytasgufassdscmxnjeyr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_NJw5OMlXyxk6MY5vb3eovw_LMsuclg2";

let supabaseClient = null;
let laporanData = [];
let petugasData = [];
let currentUser = null;
let selectedLaporan = null;
let loadingData = false;

/* =====================================================
   HELPER
===================================================== */

const $ = (id) => document.getElementById(id);

const STATUS_META = {
  "Laporan Dikirim": { color: "#d97706", soft: "#fff3df", key: "pending" },
  "Diverifikasi": { color: "#7c3aed", soft: "#f3eaff", key: "verify" },
  "Sedang Diproses": { color: "#285fe8", soft: "#eaf0ff", key: "process" },
  "Selesai Diperbaiki": { color: "#159255", soft: "#e6f8ef", key: "done" }
};

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function showToast(message, type = "success") {
  const toast = $("toast");

  if (!toast) {
    console.log(message);
    return;
  }

  toast.textContent = message;
  toast.className = `toast show ${type}`;
  toast.hidden = false;

  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.className = `toast ${type}`;
    toast.hidden = true;
  }, 4000);
}

function showLoginMessage(message) {
  const element = $("loginMessage");
  if (element) element.textContent = message;
}

function formatDate(value) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function getField(row, fields, fallback = "-") {
  for (const field of fields) {
    if (
      row &&
      row[field] !== undefined &&
      row[field] !== null &&
      row[field] !== ""
    ) {
      return row[field];
    }
  }

  return fallback;
}

function getStatus(row) {
  return getField(row, ["status"], "Laporan Dikirim");
}

function getNamaPelapor(row) {
  return getField(row, ["nama"]);
}

function getKategori(row) {
  return getField(row, ["kategori"]);
}

function getLokasi(row) {
  return getField(row, ["alamat"]);
}

function getDeskripsi(row) {
  return getField(row, ["deskripsi"]);
}

function getTanggal(row) {
  return getField(row, ["created_at"]);
}

function getLaporanId(row) {
  return getField(row, ["id"], "");
}

function getPetugasId(row) {
  return getField(row, ["petugas_id"], "");
}

function statusClass(status) {
  const value = String(status).toLowerCase();

  if (value.includes("selesai")) return "done";
  if (value.includes("proses")) return "process";
  if (value.includes("verifikasi")) return "verify";

  return "pending";
}

function statusBadge(status) {
  return `<span class="status-badge ${statusClass(status)}">${escapeHTML(status)}</span>`;
}

function renderEmpty(message) {
  return `<div class="empty-state">${escapeHTML(message)}</div>`;
}

function getStatusMetrics(rows = []) {
  const metrics = {
    total: rows.length,
    sent: 0,
    verify: 0,
    process: 0,
    done: 0
  };

  rows.forEach((row) => {
    const status = getStatus(row);

    if (status === "Diverifikasi") {
      metrics.verify += 1;
    } else if (status === "Sedang Diproses") {
      metrics.process += 1;
    } else if (status === "Selesai Diperbaiki") {
      metrics.done += 1;
    } else {
      metrics.sent += 1;
    }
  });

  return metrics;
}

function countAssignedReports(rows = []) {
  return rows.filter((row) => String(getPetugasId(row) || "").trim() !== "").length;
}

function countByCategory(rows = []) {
  const categories = {};

  rows.forEach((row) => {
    const category = String(getKategori(row));
    categories[category] = (categories[category] || 0) + 1;
  });

  return Object.entries(categories)
    .filter(([label]) => label && label !== "-")
    .sort((a, b) => b[1] - a[1]);
}

function buildMonthlyTrend(rows = [], totalMonths = 6) {
  const now = new Date();
  const points = [];

  for (let i = totalMonths - 1; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    points.push({
      key: `${date.getFullYear()}-${date.getMonth()}`,
      label: date.toLocaleDateString("id-ID", { month: "short" }),
      year: date.getFullYear(),
      month: date.getMonth(),
      count: 0
    });
  }

  rows.forEach((row) => {
    const date = new Date(getTanggal(row));
    if (Number.isNaN(date.getTime())) return;

    const item = points.find(
      (point) => point.year === date.getFullYear() && point.month === date.getMonth()
    );

    if (item) item.count += 1;
  });

  return points;
}

function renderDonutChart(elementId, items, centerLabel = "Total") {
  const element = $(elementId);
  if (!element) return;

  const filteredItems = items.filter((item) => item.value > 0);
  const total = items.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) {
    element.innerHTML = renderEmpty("Belum ada data untuk ditampilkan.");
    return;
  }

  let cursor = 0;
  const gradientParts = filteredItems.map((item) => {
    const start = cursor;
    const size = (item.value / total) * 100;
    cursor += size;
    return `${item.color} ${start}% ${cursor}%`;
  });

  const gradient = gradientParts.length
    ? `conic-gradient(${gradientParts.join(", ")})`
    : "#edf2f8";

  element.innerHTML = `
    <div class="donut-layout">
      <div class="donut-chart" style="--chart-fill:${gradient}">
        <div class="donut-hole">
          <strong>${total}</strong>
          <small>${escapeHTML(centerLabel)}</small>
        </div>
      </div>

      <div class="chart-legend">
        ${items.map((item) => `
          <div class="legend-item">
            <span class="legend-dot" style="background:${item.color}"></span>
            <div class="legend-text">
              <b>${escapeHTML(item.label)}</b>
              <small>${item.value} data</small>
            </div>
            <span class="legend-value">${item.value}</span>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function renderTrendChart(elementId, points) {
  const element = $(elementId);
  if (!element) return;

  if (!points.length) {
    element.innerHTML = renderEmpty("Belum ada data tren laporan.");
    return;
  }

  const maxValue = Math.max(...points.map((item) => item.count), 1);

  element.innerHTML = `
    <div class="trend-chart">
      ${points.map((item) => {
        const height = Math.max(18, Math.round((item.count / maxValue) * 170));
        return `
          <div class="trend-bar-wrap">
            <span class="trend-count">${item.count}</span>
            <div class="trend-bar" style="height:${height}px" title="${escapeHTML(item.label)}: ${item.count} laporan"></div>
            <span class="trend-label">${escapeHTML(item.label)}</span>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function renderCategoryBars(elementId, categoryEntries, emptyMessage = "Belum ada data kategori.") {
  const element = $(elementId);
  if (!element) return;

  if (!categoryEntries.length) {
    element.innerHTML = renderEmpty(emptyMessage);
    return;
  }

  const maxCount = Math.max(...categoryEntries.map(([, count]) => count), 1);

  element.innerHTML = categoryEntries.map(([category, count]) => {
    const width = Math.max(8, Math.round((count / maxCount) * 100));
    return `
      <div class="category-row">
        <div class="category-main">
          <div class="category-head">
            <span>${escapeHTML(category)}</span>
            <small>${count} laporan</small>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width:${width}%"></div>
          </div>
        </div>
        <strong>${count}</strong>
      </div>
    `;
  }).join("");
}

/* =====================================================
   INISIALISASI
===================================================== */

document.addEventListener("DOMContentLoaded", initializeAdmin);

async function initializeAdmin() {
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(SUPABASE_URL)) {
    showLoginMessage("Project URL Supabase tidak valid.");
    return;
  }

  if (!window.supabase?.createClient) {
    showLoginMessage(
      "Library Supabase belum termuat. Periksa script di index.html."
    );
    console.error("Library Supabase tidak ditemukan.");
    return;
  }

  try {
    supabaseClient = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY
    );

    bindEvents();

    const { data, error } = await supabaseClient.auth.getSession();

    if (error) throw error;

    if (data.session) {
      currentUser = data.session.user;
      await showApplication();
    } else {
      showLoginScreen();
    }

    supabaseClient.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        currentUser = session.user;
        showApplication();
      }

      if (event === "SIGNED_OUT") {
        currentUser = null;
        laporanData = [];
        petugasData = [];
        renderDashboard();
        renderReports();
        renderPetugas();
        showLoginScreen();
      }
    });

    console.log("Supabase client berhasil dibuat.");
  } catch (error) {
    console.error("Inisialisasi Supabase gagal:", error);
    showLoginMessage(`Inisialisasi Supabase gagal: ${error.message}`);
  }
}

/* =====================================================
   EVENT
===================================================== */

function bindEvents() {
  $("loginForm")?.addEventListener("submit", handleLogin);
  $("logoutBtn")?.addEventListener("click", handleLogout);

  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      showView(button.dataset.view);
    });
  });

  document.querySelectorAll("[data-goto]").forEach((button) => {
    button.addEventListener("click", () => {
      showView(button.dataset.goto);
    });
  });

  $("refreshBtn")?.addEventListener("click", loadData);

  $("searchInput")?.addEventListener("input", renderReports);
  $("statusFilter")?.addEventListener("change", () => {
    document.querySelectorAll("[data-status-tab]").forEach((tab) =>
      tab.classList.toggle("active", (tab.dataset.statusTab || "") === ($("statusFilter")?.value || ""))
    );
    renderReports();
  });
  document.querySelectorAll("[data-status-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      const value = button.dataset.statusTab || "";
      if ($("statusFilter")) $("statusFilter").value = value;
      document.querySelectorAll("[data-status-tab]").forEach((tab) => tab.classList.toggle("active", tab === button));
      renderReports();
    });
  });
  $("categoryFilter")?.addEventListener("change", renderReports);
  $("petugasFilter")?.addEventListener("change", renderReports);

  $("petugasSearch")?.addEventListener("input", renderPetugas);

  $("addPetugasBtn")?.addEventListener("click", () => {
    openPetugasForm();
  });

  $("petugasForm")?.addEventListener("submit", savePetugas);

  document.querySelectorAll("[data-close]").forEach((button) => {
    button.addEventListener("click", () => {
      const modal = button.closest(".modal");
      if (modal) modal.hidden = true;
    });
  });

  $("reportsTable")?.addEventListener("click", handleReportTableClick);
  $("recentTable")?.addEventListener("click", handleReportTableClick);
  $("petugasTable")?.addEventListener("click", handlePetugasTableClick);

  $("modalBody")?.addEventListener("click", handleModalClick);
  $("modalBody")?.addEventListener("submit", handleModalSubmit);
}

/* =====================================================
   LOGIN DAN LOGOUT
===================================================== */

async function handleLogin(event) {
  event.preventDefault();
  showLoginMessage("");

  if (!supabaseClient) {
    showLoginMessage("Koneksi belum siap. Muat ulang halaman.");
    return;
  }

  const email = $("username")?.value.trim();
  const password = $("password")?.value;

  if (!email || !password) {
    showLoginMessage("Email dan password harus diisi.");
    return;
  }

  const button = $("loginBtn");

  if (button) {
    button.disabled = true;
    button.textContent = "Memproses...";
  }

  try {
    const { data, error } =
      await supabaseClient.auth.signInWithPassword({
        email,
        password
      });

    if (error) throw error;

    currentUser = data.user;
    await showApplication();
  } catch (error) {
    console.error("Login gagal:", error);
    showLoginMessage(
      error.message || "Login gagal. Periksa email dan password."
    );
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "Masuk ke Dashboard →";
    }
  }
}

async function handleLogout() {
  if (!supabaseClient) return;

  try {
    const { error } = await supabaseClient.auth.signOut();

    if (error) throw error;

    currentUser = null;
    laporanData = [];
    petugasData = [];
    showLoginScreen();
  } catch (error) {
    console.error("Logout gagal:", error);
    showToast(`Logout gagal: ${error.message}`, "error");
  }
}

function showLoginScreen() {
  if ($("loginScreen")) $("loginScreen").hidden = false;
  if ($("appScreen")) $("appScreen").hidden = true;
}

async function showApplication() {
  if ($("loginScreen")) $("loginScreen").hidden = true;
  if ($("appScreen")) $("appScreen").hidden = false;

  if ($("adminEmail")) {
    $("adminEmail").textContent = currentUser?.email || "Administrator";
  }

  await loadData();
}

/* =====================================================
   NAVIGASI
===================================================== */

function showView(viewName) {
  const views = ["dashboard", "reports", "petugas", "guide"];

  views.forEach((name) => {
    const element = $(`${name}View`);
    if (element) element.hidden = name !== viewName;
  });

  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === viewName);
  });

  const titles = {
    dashboard: "Dashboard",
    reports: "Data Laporan",
    petugas: "Data Petugas",
    guide: "Panduan Admin"
  };

  if ($("pageTitle")) {
    $("pageTitle").textContent = titles[viewName] || "Admin";
  }

  if ($("crumb")) {
    $("crumb").textContent = (viewName || "").toUpperCase();
  }
}

/* =====================================================
   MEMUAT DATA
===================================================== */

async function loadData() {
  if (!supabaseClient) {
    showToast("Koneksi Supabase belum siap.", "error");
    return;
  }

  if (loadingData) return;
  loadingData = true;

  const button = $("refreshBtn");

  if (button) {
    button.disabled = true;
    button.textContent = "Memuat...";
  }

  try {
    const laporanResult = await supabaseClient
      .from("laporan")
      .select("*")
      .order("created_at", { ascending: false });

    if (laporanResult.error) {
      throw new Error(
        `Gagal memuat tabel laporan: ${laporanResult.error.message}`
      );
    }

    laporanData = await hydrateReportPhotoUrls(laporanResult.data || []);

    renderDashboard();
    renderReports();

    const petugasResult = await supabaseClient
      .from("petugas")
      .select("*")
      .order("created_at", { ascending: false });

    if (petugasResult.error) {
      console.error("Gagal memuat tabel petugas:", petugasResult.error);

      petugasData = [];

      renderDashboard();
      renderPetugas();
      renderPetugasFilter();

      showToast(
        `Laporan berhasil dimuat, tetapi petugas gagal dimuat: ${petugasResult.error.message}`,
        "error"
      );

      return;
    }

    petugasData = petugasResult.data || [];

    renderDashboard();
    renderReports();
    renderPetugas();
    renderPetugasFilter();

    showToast(`Data berhasil dimuat. Total laporan: ${laporanData.length}.`);
  } catch (error) {
    console.error("Gagal memuat data:", error);
    showToast(error.message, "error");
  } finally {
    loadingData = false;

    if (button) {
      button.disabled = false;
      button.textContent = "↻ Muat ulang";
    }
  }
}

/* =====================================================
   DASHBOARD
===================================================== */

function renderDashboard() {
  const metrics = getStatusMetrics(laporanData);

  if ($("totalStat")) $("totalStat").textContent = metrics.total;
  if ($("verifyStat")) $("verifyStat").textContent = metrics.verify;
  if ($("processStat")) $("processStat").textContent = metrics.process;
  if ($("doneStat")) $("doneStat").textContent = metrics.done;
  if ($("sideCount")) $("sideCount").textContent = metrics.total;
  if ($("sidePetugas")) $("sidePetugas").textContent = petugasData.length;

  const recent = laporanData.slice(0, 5);

  if ($("recentTable")) {
    $("recentTable").innerHTML = recent.length
      ? `<table>
          <thead>
            <tr>
              <th>Pelapor</th>
              <th>Kategori</th>
              <th>Tanggal</th>
              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${recent.map((row) => `
              <tr>
                <td>${escapeHTML(getNamaPelapor(row))}</td>
                <td>${escapeHTML(getKategori(row))}</td>
                <td>${escapeHTML(formatDate(getTanggal(row)))}</td>
                <td>${statusBadge(getStatus(row))}</td>
                <td>
                  <button class="btn small secondary"
                    data-action="detail"
                    data-id="${escapeHTML(getLaporanId(row))}">
                    Detail
                  </button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>`
      : renderEmpty("Belum ada laporan.");
  }

  renderDonutChart("statusChart", [
    { label: "Laporan Dikirim", value: metrics.sent, color: STATUS_META["Laporan Dikirim"].color },
    { label: "Diverifikasi", value: metrics.verify, color: STATUS_META["Diverifikasi"].color },
    { label: "Sedang Diproses", value: metrics.process, color: STATUS_META["Sedang Diproses"].color },
    { label: "Selesai Diperbaiki", value: metrics.done, color: STATUS_META["Selesai Diperbaiki"].color }
  ], "Total Laporan");

  renderTrendChart("trendChart", buildMonthlyTrend(laporanData));
  renderCategoryBars("categorySummary", countByCategory(laporanData));
}

/* =====================================================
   DAFTAR LAPORAN
===================================================== */

function getReportPhotoUrl(row) {
  if (row?._foto_display_url) return row._foto_display_url;
  const raw = getField(row, ["foto_url", "foto_laporan", "photo_url"], "");
  if (!raw || raw === "-") return "";
  const value = String(raw).trim();
  // URL publik dari bucket lain tetap bisa dipakai langsung. URL dari bucket
  // foto-laporan tidak boleh dibuat dengan getPublicUrl karena bucket ini privat.
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      const match = url.pathname.match(/\/storage\/v1\/object\/(?:sign|public)\/([^/]+)\/(.+)$/i);
      if (!match || match[1] !== "foto-laporan") return value;
    } catch (_) {
      return "";
    }
  }
  return ""; // URL tampilan disiapkan async oleh hydrateReportPhotoUrls().
}

function getPhotoStoragePath(rawValue) {
  const value = String(rawValue || "").trim();
  if (!value || value === "-") return null;

  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      // Hanya URL storage dari project Supabase ini yang diproses ulang.
      if (url.hostname !== new URL(SUPABASE_URL).hostname) return { externalUrl: value };
      const match = url.pathname.match(/\/storage\/v1\/object\/(?:sign|public)\/([^/]+)\/(.+)$/i);
      if (!match) return { externalUrl: value };
      return { bucket: match[1], path: decodeURIComponent(match[2]) };
    } catch (_) {
      return null;
    }
  }

  const clean = value.replace(/^\/+/, "").replace(/^storage\/v1\/object\/(?:sign|public)\//i, "");
  const withBucket = clean.match(/^([^/]+)\/(.+)$/);
  if (withBucket && ["foto-laporan", "laporan-foto", "bukti-perbaikan"].includes(withBucket[1])) {
    return { bucket: withBucket[1], path: withBucket[2] };
  }
  return { bucket: "foto-laporan", path: clean };
}

async function hydrateReportPhotoUrls(rows) {
  return Promise.all((rows || []).map(async (row) => {
    const raw = getField(row, ["foto_url", "foto_laporan", "photo_url"], "");
    const parsed = getPhotoStoragePath(raw);
    if (!parsed) return { ...row, _foto_display_url: "" };
    if (parsed.externalUrl) return { ...row, _foto_display_url: parsed.externalUrl };
    if (!parsed.path || !supabaseClient?.storage) return { ...row, _foto_display_url: "" };

    if (parsed.bucket === "foto-laporan") {
      const { data, error } = await supabaseClient.storage
        .from(parsed.bucket)
        .createSignedUrl(parsed.path, 3600);
      if (error) {
        console.warn("URL foto laporan tidak dapat dibuat:", row.id, error.message);
        return { ...row, _foto_display_url: "" };
      }
      return { ...row, _foto_display_url: data?.signedUrl || "" };
    }

    const { data } = supabaseClient.storage.from(parsed.bucket).getPublicUrl(parsed.path);
    return { ...row, _foto_display_url: data?.publicUrl || "" };
  }));
}

function renderReports() {
  const query = ($("searchInput")?.value || "").toLowerCase().trim();
  const status = $("statusFilter")?.value || "";
  const category = $("categoryFilter")?.value || "";
  const assigned = $("petugasFilter")?.value || "";

  const filtered = laporanData.filter((row) => {
    const searchable = [
      getLaporanId(row),
      getNamaPelapor(row),
      getKategori(row),
      getLokasi(row),
      getDeskripsi(row),
      getStatus(row),
      getField(row, ["kontak"], ""),
      getField(petugasData.find((petugas) => String(petugas.id) === String(getPetugasId(row))), ["nama"], "")
    ].join(" ").toLowerCase();

    return (
      (!query || searchable.includes(query)) &&
      (!status || getStatus(row) === status) &&
      (!category || getKategori(row) === category) &&
      (!assigned || String(getPetugasId(row)) === assigned)
    );
  });

  if ($("resultCount")) {
    $("resultCount").textContent = `${filtered.length} laporan`;
  }

  const countStatus = (value) => laporanData.filter((row) => value ? getStatus(row) === value : true).length;
  if ($("tabCountAll")) $("tabCountAll").textContent = countStatus("");
  if ($("tabCountSent")) $("tabCountSent").textContent = countStatus("Laporan Dikirim");
  if ($("tabCountVerify")) $("tabCountVerify").textContent = countStatus("Diverifikasi");
  if ($("tabCountProcess")) $("tabCountProcess").textContent = countStatus("Sedang Diproses");
  if ($("tabCountDone")) $("tabCountDone").textContent = countStatus("Selesai Diperbaiki");

  const metrics = getStatusMetrics(filtered);
  const assignedCount = countAssignedReports(filtered);
  const unassignedCount = filtered.length - assignedCount;

  if ($("reportVisibleCount")) $("reportVisibleCount").textContent = filtered.length;
  if ($("reportAssignedCount")) $("reportAssignedCount").textContent = assignedCount;
  if ($("reportUnassignedCount")) $("reportUnassignedCount").textContent = unassignedCount;
  if ($("reportDoneCount")) $("reportDoneCount").textContent = metrics.done;

  renderDonutChart("reportStatusChart", [
    { label: "Laporan Dikirim", value: metrics.sent, color: STATUS_META["Laporan Dikirim"].color },
    { label: "Diverifikasi", value: metrics.verify, color: STATUS_META["Diverifikasi"].color },
    { label: "Sedang Diproses", value: metrics.process, color: STATUS_META["Sedang Diproses"].color },
    { label: "Selesai Diperbaiki", value: metrics.done, color: STATUS_META["Selesai Diperbaiki"].color }
  ], "Hasil Filter");

  renderCategoryBars(
    "reportCategoryChart",
    countByCategory(filtered),
    "Tidak ada kategori pada hasil pencarian."
  );

  if (!$("reportsTable")) return;

  $("reportsTable").innerHTML = filtered.length
    ? `<table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Foto</th>
            <th>Pelapor</th>
            <th>Kategori</th>
            <th>Lokasi</th>
            <th>Tanggal</th>
            <th>Status</th>
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map((row) => `
            <tr>
              <td data-label="ID Laporan">#${escapeHTML(getLaporanId(row))}</td>
              <td data-label="Foto Laporan">${getReportPhotoUrl(row) ? `<a href="${escapeHTML(getReportPhotoUrl(row))}" target="_blank" rel="noopener noreferrer"><img class="report-thumb" src="${escapeHTML(getReportPhotoUrl(row))}" alt="Foto laporan" loading="lazy" onerror="this.outerHTML='<span class=&quot;photo-missing&quot;>Foto tidak tersedia</span>'"></a>` : `<span class="photo-missing">Belum ada foto</span>`}</td>
              <td data-label="Pelapor">${escapeHTML(getNamaPelapor(row))}</td>
              <td data-label="Kategori">${escapeHTML(getKategori(row))}</td>
              <td data-label="Lokasi">${escapeHTML(getLokasi(row))}</td>
              <td data-label="Tanggal">${escapeHTML(formatDate(getTanggal(row)))}</td>
              <td data-label="Status">${statusBadge(getStatus(row))}</td>
              <td data-label="Aksi">
                <div class="row-actions">
                  <button class="btn small primary"
                    data-action="detail"
                    data-id="${escapeHTML(getLaporanId(row))}">Detail</button>
                  <button class="btn small danger"
                    data-action="delete"
                    data-id="${escapeHTML(getLaporanId(row))}">Hapus</button>
                </div>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>`
    : renderEmpty("Tidak ada laporan yang sesuai dengan pencarian.");
}

async function handleReportTableClick(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  if (button.dataset.action === "detail") {
    openDetail(button.dataset.id);
    return;
  }

  if (button.dataset.action === "delete") {
    const id = button.dataset.id;
    const row = laporanData.find((item) => String(getLaporanId(item)) === String(id));
    if (!row) return showToast("Data laporan tidak ditemukan.", "error");
    const ok = window.confirm(`Hapus laporan #${id}? Data yang dihapus tidak dapat dipulihkan.`);
    if (!ok) return;

    button.disabled = true;
    button.textContent = "Menghapus...";
    try {
      const { data, error } = await supabaseClient
        .from("laporan")
        .delete({ count: "exact" })
        .eq("id", id)
        .select("id");
      if (error) {
        if (error.code === "42501" || /row-level security|permission denied/i.test(error.message || "")) {
          throw new Error("Akun ini tidak diizinkan menghapus laporan. Jalankan SQL policy DELETE admin pada file SQL_PERBAIKAN_HAPUS.sql di Supabase.");
        }
        throw error;
      }
      if (!data || data.length === 0) {
        const { data: authData } = await supabaseClient.auth.getUser();
        const emailAktif = authData?.user?.email || currentUser?.email || "tidak diketahui";
        console.error("DELETE tidak mengembalikan baris. Periksa email login, ID, dan policy RLS.", {
          emailAktif,
          idLaporan: id,
          jumlahBarisKembali: data?.length ?? 0
        });
        throw new Error(`Tidak ada baris yang terhapus untuk ID ${id}. Email login terdeteksi: ${emailAktif}. Pastikan email ini diizinkan policy DELETE di Supabase dan laporan dengan ID tersebut masih ada.`);
      }
      showToast(`Laporan #${id} berhasil dihapus.`);
      await loadData();
    } catch (error) {
      console.error("Hapus laporan gagal:", error);
      showToast(`Gagal menghapus: ${error.message}`, "error");
      button.disabled = false;
      button.textContent = "Hapus";
    }
  }
}

/* =====================================================
   DETAIL LAPORAN
===================================================== */

function openDetail(id) {
  selectedLaporan = laporanData.find(
    (row) => String(getLaporanId(row)) === String(id)
  );

  if (!selectedLaporan) {
    showToast("Data laporan tidak ditemukan.", "error");
    return;
  }

  const row = selectedLaporan;
  const assignedId = String(getPetugasId(row) || "");

  if ($("modalTitle")) {
    $("modalTitle").textContent = `Laporan #${getLaporanId(row)}`;
  }

  const petugasOptions = petugasData
    .filter((petugas) => petugas.aktif === true)
    .map((petugas) => `
      <option value="${escapeHTML(petugas.id)}"
        ${String(petugas.id) === assignedId ? "selected" : ""}>
        ${escapeHTML(petugas.nama)}
      </option>
    `).join("");

  const imageUrl = getReportPhotoUrl(row);

  if (!$("modalBody")) return;

  $("modalBody").innerHTML = `
    <div class="detail-grid">
      <div class="detail-item">
        <small>Nama pelapor</small>
        <strong>${escapeHTML(getNamaPelapor(row))}</strong>
      </div>

      <div class="detail-item">
        <small>Kontak</small>
        <strong>${escapeHTML(getField(row, ["kontak"]))}</strong>
      </div>

      <div class="detail-item">
        <small>Kategori</small>
        <strong>${escapeHTML(getKategori(row))}</strong>
      </div>

      <div class="detail-item">
        <small>Tanggal laporan</small>
        <strong>${escapeHTML(formatDate(getTanggal(row)))}</strong>
      </div>

      <div class="detail-item">
        <small>Status saat ini</small>
        <strong>${statusBadge(getStatus(row))}</strong>
      </div>

      <div class="detail-item detail-full">
        <small>Lokasi</small>
        <strong>${escapeHTML(getLokasi(row))}</strong>
      </div>

      <div class="detail-item detail-full">
        <small>Deskripsi laporan</small>
        <p>${escapeHTML(getDeskripsi(row))}</p>
      </div>

      <div class="detail-item detail-full report-photo-detail">
        <small>Foto laporan dari masyarakat</small>
        ${imageUrl ? `
          <a href="${escapeHTML(imageUrl)}" target="_blank" rel="noopener noreferrer">Buka foto ukuran penuh</a>
          <img src="${escapeHTML(imageUrl)}" alt="Foto laporan dari masyarakat"
            style="display:block;width:100%;max-width:560px;max-height:420px;object-fit:contain;background:#f3f6fb;border-radius:12px;margin-top:10px"
            onerror="this.style.display='none';this.nextElementSibling.hidden=false">
          <p hidden class="photo-missing">Foto gagal dimuat. Periksa URL/path file dan izin bucket foto-laporan di Supabase.</p>
        ` : `<p class="photo-missing">Belum ada foto atau kolom foto_url masih kosong.</p>`}
      </div>

     <form id="updateLaporanForm" class="detail-full" onsubmit="return false;">
        <input type="hidden" name="id"
          value="${escapeHTML(getLaporanId(row))}">

        <label class="field">
          Ubah status
          <select name="status" required>
            ${[
              "Laporan Dikirim",
              "Diverifikasi",
              "Sedang Diproses",
              "Selesai Diperbaiki"
            ].map((value) => `
              <option value="${value}"
                ${getStatus(row) === value ? "selected" : ""}>
                ${value}
              </option>
            `).join("")}
          </select>
        </label>

        <label class="field">
          Tugaskan petugas
          <select name="petugas_id">
            <option value="">Belum ditugaskan</option>
            ${petugasOptions}
          </select>
        </label>

        <label class="field">
          Tanggal penugasan
          <input type="date" name="tanggal_penugasan"
            value="${escapeHTML(row.tanggal_penugasan || "")}">
        </label>

        <label class="field">
          Tanggal target penyelesaian
          <input type="date" name="tanggal_target"
            value="${escapeHTML(row.tanggal_target || "")}">
        </label>

        <label class="field">
          Catatan penugasan
          <textarea name="catatan_penugasan" rows="3"
            placeholder="Catatan untuk petugas">${escapeHTML(
              row.catatan_penugasan || ""
            )}</textarea>
        </label>

        <div class="detail-actions">
          <button type="button" class="btn secondary" data-close>
            Tutup
          </button>
          <button type="submit" class="btn primary">
            Simpan Perubahan
          </button>
        </div>
      </form>
    </div>
  `;

  // Bind directly to the newly-created form. This avoids relying only on
  // delegated modal listeners after innerHTML replaces the form content.
  const updateForm = $("updateLaporanForm");
  if (updateForm) {
    updateForm.addEventListener("submit", handleModalSubmit);
  }

  if ($("detailModal")) $("detailModal").hidden = false;
}

/* =====================================================
   SIMPAN PERUBAHAN LAPORAN
===================================================== */

async function handleModalSubmit(event) {
  if (event.target.id !== "updateLaporanForm") return;
  event.preventDefault();
  event.stopPropagation();

  if (!supabaseClient) {
    showToast("Koneksi Supabase belum siap. Muat ulang halaman.", "error");
    return;
  }
  if (!currentUser) {
    showToast("Sesi admin tidak ditemukan. Silakan login kembali.", "error");
    return;
  }

  const form = event.target;
  const formData = new FormData(form);
  const id = String(formData.get("id") || "").trim();
  const newStatus = String(formData.get("status") || "").trim();

  if (!id || !newStatus) {
    showToast("ID laporan atau status belum terisi.", "error");
    return;
  }

  const updateData = {
    status: newStatus,
    petugas_id: formData.get("petugas_id") || null,
    tanggal_penugasan: formData.get("tanggal_penugasan") || null,
    tanggal_target: formData.get("tanggal_target") || null,
    catatan_penugasan: formData.get("catatan_penugasan") || null
  };

  const button = form.querySelector("button[type='submit']");
  const originalText = button?.textContent || "Simpan Perubahan";
  if (button) {
    button.disabled = true;
    button.textContent = "Menyimpan...";
  }

  try {
    // Update only the selected report, then request the saved row back.
    console.info("Menyimpan laporan ke Supabase", { id, status: newStatus });
    const { data: updatedRows, error: updateError } = await supabaseClient
      .from("laporan")
      .update(updateData)
      .eq("id", id)
      .select("id,status,petugas_id,tanggal_penugasan,tanggal_target,catatan_penugasan");

    if (updateError) {
      const hint = updateError.code === "42501"
        ? " Izin RLS UPDATE untuk akun admin kemungkinan belum diberikan."
        : "";
      throw new Error(`${updateError.message}${hint}`);
    }

    if (!updatedRows || updatedRows.length === 0) {
      throw new Error(
        "Tidak ada baris laporan yang diperbarui. Biasanya ini karena policy RLS UPDATE tidak mengizinkan akun admin, ID tidak cocok, atau akun admin tidak memiliki akses SELECT ke baris tersebut. Periksa policy UPDATE dan SELECT di Supabase."
      );
    }

    const savedRow = updatedRows[0];
    if (String(savedRow.status) !== newStatus) {
      throw new Error(`Status yang terbaca setelah simpan adalah "${savedRow.status}", bukan "${newStatus}".`);
    }

    // Re-fetch all rows so dashboard and list use the actual database state.
    const { data: freshRows, error: refreshError } = await supabaseClient
      .from("laporan")
      .select("*")
      .order("created_at", { ascending: false });

    if (refreshError) {
      throw new Error(`Status tersimpan, tetapi daftar belum bisa diperbarui: ${refreshError.message}`);
    }

    laporanData = await hydrateReportPhotoUrls(freshRows || []);
    renderDashboard();
    renderReports();

    const freshSelected = laporanData.find(
      (row) => String(getLaporanId(row)) === id
    );
    if (freshSelected) selectedLaporan = freshSelected;

    if ($("detailModal")) $("detailModal").hidden = true;
    showToast(`Status berhasil disimpan: ${savedRow.status}`);
    await loadData();
  } catch (error) {
    console.error("Update laporan gagal:", {
      message: error?.message,
      code: error?.code,
      details: error?.details,
      hint: error?.hint,
      userId: currentUser?.id
    });
    showToast(`Gagal menyimpan perubahan: ${error.message}`, "error");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
}

function handleModalClick(event) {
  const closeButton = event.target.closest("[data-close]");
  if (!closeButton) return;

  const modal = closeButton.closest(".modal");
  if (modal) modal.hidden = true;
}

/* =====================================================
   FILTER PETUGAS
===================================================== */

function renderPetugasFilter() {
  const select = $("petugasFilter");
  if (!select) return;

  const currentValue = select.value;

  select.innerHTML = `
    <option value="">Semua petugas</option>
    ${petugasData.map((row) => `
      <option value="${escapeHTML(row.id)}">
        ${escapeHTML(row.nama)}
      </option>
    `).join("")}
  `;

  select.value = currentValue;
}

/* =====================================================
   DATA PETUGAS
===================================================== */

function renderPetugas() {
  if ($("petugasCount")) {
    $("petugasCount").textContent = `${petugasData.length} petugas`;
  }

  if ($("sidePetugas")) {
    $("sidePetugas").textContent = petugasData.length;
  }

  const activeCount = petugasData.filter((row) => row.aktif === true).length;
  const inactiveCount = petugasData.length - activeCount;

  if ($("petugasTotalStat")) $("petugasTotalStat").textContent = petugasData.length;
  if ($("petugasActiveStat")) $("petugasActiveStat").textContent = activeCount;
  if ($("petugasInactiveStat")) $("petugasInactiveStat").textContent = inactiveCount;

  if (!$("petugasTable")) return;

  const query = ($("petugasSearch")?.value || "").toLowerCase().trim();

  const filtered = petugasData.filter((row) => {
    const text = [
      row.nama,
      row.kontak,
      row.keahlian
    ].join(" ").toLowerCase();

    return !query || text.includes(query);
  });

  $("petugasTable").innerHTML = filtered.length
    ? `<table>
        <thead>
          <tr>
            <th>Nama</th>
            <th>Kontak</th>
            <th>Keahlian</th>
            <th>Status</th>
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map((row) => `
            <tr>
              <td>${escapeHTML(row.nama)}</td>
              <td>${escapeHTML(row.kontak)}</td>
              <td>${escapeHTML(row.keahlian)}</td>
              <td>
                ${row.aktif
                  ? '<span class="status-badge done">Aktif</span>'
                  : '<span class="status-badge pending">Nonaktif</span>'}
              </td>
              <td>
                <button class="btn small secondary"
                  data-action="edit-petugas"
                  data-id="${escapeHTML(row.id)}">
                  Edit
                </button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>`
    : renderEmpty("Belum ada data petugas.");
}

function handlePetugasTableClick(event) {
  const button = event.target.closest("[data-action='edit-petugas']");
  if (!button) return;

  const row = petugasData.find(
    (item) => String(item.id) === String(button.dataset.id)
  );

  if (row) openPetugasForm(row);
}

function openPetugasForm(row = null) {
  const form = $("petugasForm");
  if (!form) return;

  form.reset();

  if ($("petugasId")) $("petugasId").value = row?.id || "";
  if ($("petugasNama")) $("petugasNama").value = row?.nama || "";
  if ($("petugasKontak")) $("petugasKontak").value = row?.kontak || "";
  if ($("petugasKeahlian")) $("petugasKeahlian").value = row?.keahlian || "";
  if ($("petugasAktif")) {
    $("petugasAktif").checked = row ? row.aktif === true : true;
  }

  if ($("petugasModalTitle")) {
    $("petugasModalTitle").textContent = row
      ? "Edit Petugas"
      : "Tambah Petugas";
  }

  if ($("petugasModal")) $("petugasModal").hidden = false;
}

/* =====================================================
   SIMPAN PETUGAS
===================================================== */

async function savePetugas(event) {
  event.preventDefault();

  if (!supabaseClient) {
    showToast("Koneksi Supabase belum siap.", "error");
    return;
  }

  const id = $("petugasId")?.value.trim();
  const nama = $("petugasNama")?.value.trim();
  const kontak = $("petugasKontak")?.value.trim();
  const keahlian = $("petugasKeahlian")?.value.trim();
  const aktif = $("petugasAktif")?.checked ?? true;

  if (!nama) {
    showToast("Nama petugas harus diisi.", "error");
    return;
  }

  const data = {
    nama,
    kontak: kontak || null,
    keahlian: keahlian || null,
    aktif
  };

  const button = $("petugasSaveBtn");

  if (button) {
    button.disabled = true;
    button.textContent = "Menyimpan...";
  }

  try {
    let result;

    if (id) {
      result = await supabaseClient
        .from("petugas")
        .update(data)
        .eq("id", id)
        .select();
    } else {
      result = await supabaseClient
        .from("petugas")
        .insert(data)
        .select();
    }

    if (result.error) throw result.error;

    if (!result.data || result.data.length === 0) {
      throw new Error(
        "Data petugas tidak tersimpan. Periksa izin INSERT/UPDATE pada RLS."
      );
    }

    if ($("petugasModal")) $("petugasModal").hidden = true;

    showToast(
      id ? "Data petugas berhasil diperbarui." : "Petugas berhasil ditambahkan."
    );

    await loadData();
  } catch (error) {
    console.error("Simpan petugas gagal:", error);
    showToast(`Gagal menyimpan petugas: ${error.message}`, "error");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "Simpan";
    }
  }
}
