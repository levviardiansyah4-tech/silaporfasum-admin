
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
  toast.className = `toast ${type}`;
  toast.hidden = false;

  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
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
    showLoginMessage(
      `Inisialisasi Supabase gagal: ${error.message}`
    );
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
  $("statusFilter")?.addEventListener("change", renderReports);
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
   Laporan dan petugas dimuat secara terpisah.
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
    // 1. Muat laporan terlebih dahulu.
    const laporanResult = await supabaseClient
      .from("laporan")
      .select("*")
      .order("created_at", { ascending: false });

    if (laporanResult.error) {
      throw new Error(
        `Gagal memuat tabel laporan: ${laporanResult.error.message}`
      );
    }

    laporanData = laporanResult.data || [];

    renderDashboard();
    renderReports();

    console.log("Jumlah laporan:", laporanData.length);

    // 2. Muat petugas secara terpisah.
    const petugasResult = await supabaseClient
      .from("petugas")
      .select("*")
      .order("created_at", { ascending: false });

    if (petugasResult.error) {
      console.error(
        "Gagal memuat tabel petugas:",
        petugasResult.error
      );

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

    console.log("Jumlah petugas:", petugasData.length);

    showToast(
      `Data berhasil dimuat. Total laporan: ${laporanData.length}.`
    );
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
  const total = laporanData.length;

  const verify = laporanData.filter((row) =>
    getStatus(row).toLowerCase().includes("verifikasi")
  ).length;

  const process = laporanData.filter((row) =>
    getStatus(row).toLowerCase().includes("proses")
  ).length;

  const done = laporanData.filter((row) =>
    getStatus(row).toLowerCase().includes("selesai")
  ).length;

  if ($("totalStat")) $("totalStat").textContent = total;
  if ($("verifyStat")) $("verifyStat").textContent = verify;
  if ($("processStat")) $("processStat").textContent = process;
  if ($("doneStat")) $("doneStat").textContent = done;
  if ($("sideCount")) $("sideCount").textContent = total;
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

  const categories = {};

  laporanData.forEach((row) => {
    const category = String(getKategori(row));
    categories[category] = (categories[category] || 0) + 1;
  });

  if ($("categorySummary")) {
    const entries = Object.entries(categories);

    $("categorySummary").innerHTML = entries.length
      ? entries.map(([category, count]) => `
          <div class="category-row">
            <span>${escapeHTML(category)}</span>
            <strong>${count}</strong>
          </div>
        `).join("")
      : renderEmpty("Belum ada data kategori.");
  }
}

/* =====================================================
   DAFTAR LAPORAN
===================================================== */

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
      getStatus(row)
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

  if (!$("reportsTable")) return;

  $("reportsTable").innerHTML = filtered.length
    ? `<table>
        <thead>
          <tr>
            <th>ID</th>
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
              <td>#${escapeHTML(getLaporanId(row))}</td>
              <td>${escapeHTML(getNamaPelapor(row))}</td>
              <td>${escapeHTML(getKategori(row))}</td>
              <td>${escapeHTML(getLokasi(row))}</td>
              <td>${escapeHTML(formatDate(getTanggal(row)))}</td>
              <td>${statusBadge(getStatus(row))}</td>
              <td>
                <button class="btn small primary"
                  data-action="detail"
                  data-id="${escapeHTML(getLaporanId(row))}">
                  Detail
                </button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>`
    : renderEmpty("Tidak ada laporan yang sesuai dengan pencarian.");
}

function handleReportTableClick(event) {
  const button = event.target.closest("[data-action='detail']");
  if (!button) return;

  openDetail(button.dataset.id);
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

  const imageUrl = getField(row, ["foto_url"], "");

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

      ${imageUrl && /^https?:\/\//i.test(String(imageUrl)) ? `
        <div class="detail-item detail-full">
          <small>Foto laporan</small>
          <a href="${escapeHTML(imageUrl)}"
             target="_blank" rel="noopener noreferrer">
            Buka foto laporan
          </a>
          <img src="${escapeHTML(imageUrl)}"
            alt="Foto laporan"
            style="max-width:100%;height:auto;border-radius:10px">
        </div>
      ` : ""}

      <form id="updateLaporanForm" class="detail-full">
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

  if ($("detailModal")) $("detailModal").hidden = false;
}

/* =====================================================
   SIMPAN PERUBAHAN LAPORAN
===================================================== */

async function handleModalSubmit(event) {
  if (event.target.id !== "updateLaporanForm") return;

  event.preventDefault();

  const form = event.target;
  const formData = new FormData(form);
  const id = formData.get("id");

  const updateData = {
    status: formData.get("status"),
    petugas_id: formData.get("petugas_id") || null,
    tanggal_penugasan: formData.get("tanggal_penugasan") || null,
    tanggal_target: formData.get("tanggal_target") || null,
    catatan_penugasan: formData.get("catatan_penugasan") || null
  };

  const button = form.querySelector("button[type='submit']");

  if (button) {
    button.disabled = true;
    button.textContent = "Menyimpan...";
  }

  try {
    const { data, error } = await supabaseClient
      .from("laporan")
      .update(updateData)
      .eq("id", id)
      .select();

    if (error) throw error;

    if (!data || data.length === 0) {
      throw new Error(
        "Laporan tidak diperbarui. Periksa izin UPDATE pada RLS."
      );
    }

    if ($("detailModal")) $("detailModal").hidden = true;

    showToast("Perubahan laporan berhasil disimpan.");
    await loadData();
  } catch (error) {
    console.error("Update laporan gagal:", error);
    showToast(`Gagal menyimpan perubahan: ${error.message}`, "error");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "Simpan Perubahan";
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
