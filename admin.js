
const $ = id => document.getElementById(id);

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
}[c]));

const STATUSES = [
  "Laporan Dikirim",
  "Diverifikasi",
  "Sedang Diproses",
  "Selesai Diperbaiki"
];

const statusClass = s =>
  String(s || "").toLowerCase().replaceAll(" ", "-").replaceAll("/", "-");

const dateText = s => {
  if (!s) return "-";
  try {
    return new Date(s).toLocaleString("id-ID", {
      dateStyle: "medium",
      timeStyle: "short"
    });
  } catch {
    return "-";
  }
};

const dateOnly = s => {
  if (!s) return "-";
  try {
    return new Date(s + "T00:00:00").toLocaleDateString("id-ID", {
      dateStyle: "medium"
    });
  } catch {
    return "-";
  }
};

const today = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString().slice(0, 10);
};

/* =========================================
   KONFIGURASI SUPABASE
   Ganti URL dengan Project URL yang asli.
   Gunakan publishable key, bukan secret key.
========================================= */

const SUPABASE_URL = "GANTI_DENGAN_PROJECT_URL_ASLI";
const SUPABASE_ANON_KEY = "GANTI_DENGAN_PUBLISHABLE_KEY";

let sb = null;
let CONFIG_ERROR = "";

if (!window.supabase) {
  CONFIG_ERROR =
    "Library Supabase tidak ditemukan. Periksa index.html dan koneksi internet.";
} else if (
  !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(SUPABASE_URL)
) {
  CONFIG_ERROR =
    "SUPABASE_URL belum benar. Masukkan Project URL asli dari Supabase.";
} else if (
  !SUPABASE_ANON_KEY ||
  SUPABASE_ANON_KEY.startsWith("GANTI_")
) {
  CONFIG_ERROR =
    "Publishable key Supabase belum diisi.";
} else {
  try {
    sb = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY
    );
  } catch (err) {
    console.error("Supabase initialization error:", err);
    CONFIG_ERROR = "Gagal menginisialisasi Supabase.";
  }
}

/* =========================================
   DATA APLIKASI
========================================= */

let reports = [];
let petugas = [];
let activeView = "dashboard";
let toastTimer;

const pById = id =>
  petugas.find(p => String(p.id) === String(id));

const activeTaskCount = pid =>
  reports.filter(r =>
    String(r.petugas_id) === String(pid) &&
    r.status !== "Selesai Diperbaiki"
  ).length;

const isOverdue = r =>
  !!r.tanggal_target &&
  r.status !== "Selesai Diperbaiki" &&
  r.tanggal_target < today();

function toast(msg, type = "") {
  let t = $("toast");

  if (!t) {
    t = document.createElement("div");
    t.id = "toast";
    document.body.appendChild(t);
  }

  t.textContent = msg;
  t.className = "toast show " + type;

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.className = "toast";
  }, 3800);
}

/* =========================================
   NORMALISASI DATA LAPORAN
========================================= */

const normalize = r => ({
  ...r,
  createdAt: r.created_at || r.createdAt || null,
  nama: r.nama ?? r.nama_pelapor,
  kontak: r.kontak ?? r.email ?? r.no_hp,
  alamat: r.alamat ?? r.lokasi,
  foto: r.foto ?? r.foto_url,
  lat: r.lat ?? r.latitude,
  lon: r.lon ?? r.lng ?? r.longitude,
  status: r.status || "Laporan Dikirim"
});

/* =========================================
   LOGIN ADMIN
========================================= */

function loginErrorText(err) {
  const m = String(err?.message || err || "").toLowerCase();

  if (m.includes("invalid login credentials")) {
    return "Email atau password salah. Pastikan akun tersedia di Supabase Authentication.";
  }

  if (m.includes("email not confirmed")) {
    return "Email belum dikonfirmasi di Supabase Authentication.";
  }

  if (
    m.includes("failed to fetch") ||
    m.includes("networkerror") ||
    m.includes("load failed")
  ) {
    return "Tidak dapat menghubungi Supabase. Periksa URL, koneksi internet, dan Console browser.";
  }

  if (m.includes("invalid api key") || m.includes("apikey")) {
    return "API key tidak valid. Periksa publishable key Supabase.";
  }

  return "Gagal masuk: " + (err?.message || err);
}

$("loginForm").addEventListener("submit", async e => {
  e.preventDefault();

  const msg = $("loginMessage");
  const btn = $("loginBtn");

  msg.textContent = "";

  if (!sb) {
    msg.textContent = CONFIG_ERROR;
    return;
  }

  btn.disabled = true;

  try {
    const { data, error } = await sb.auth.signInWithPassword({
      email: $("username").value.trim(),
      password: $("password").value
    });

    if (error) {
      console.error("Login error:", error);
      msg.textContent = loginErrorText(error);
      return;
    }

    await showApp(data.session);
  } catch (err) {
    console.error("Login exception:", err);
    msg.textContent = loginErrorText(err);
  } finally {
    btn.disabled = false;
  }
});

async function showApp(session) {
  $("loginScreen").hidden = true;
  $("appScreen").hidden = false;

  $("adminEmail").textContent =
    session?.user?.email || "Pengelola sistem";

  await loadData();
}

async function logout() {
  if (sb) {
    const { error } = await sb.auth.signOut();

    if (error) {
      console.error(error);
      toast("Gagal keluar dari akun.", "error");
      return;
    }
  }

  $("appScreen").hidden = true;
  $("loginScreen").hidden = false;
  $("password").value = "";
  reports = [];
  petugas = [];
}

/* =========================================
   MEMUAT DATA SUPABASE
========================================= */

async function loadData() {
  if (!sb) {
    toast(CONFIG_ERROR, "error");
    return;
  }

  $("reportsTable").innerHTML =
    '<div class="empty">Memuat data...</div>';

  try {
    const [r, p] = await Promise.all([
      sb.from("laporan").select("*"),
      sb.from("petugas").select("*").order("nama")
    ]);

    if (r.error) {
      console.error("Laporan error:", r.error);
      toast("Gagal memuat laporan: " + r.error.message, "error");
    }

    if (p.error) {
      console.error("Petugas error:", p.error);
      toast("Gagal memuat petugas: " + p.error.message, "error");
    }

    reports = (r.data || [])
      .map(normalize)
      .sort((a, b) =>
        new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      );

    petugas = p.data || [];

    renderAll();
  } catch (err) {
    console.error("Load data exception:", err);
    toast("Gagal mengambil data. Periksa koneksi Supabase.", "error");
  }
}

/* =========================================
   NAVIGASI
========================================= */

function setView(view) {
  activeView = view;

  ["dashboard", "reports", "petugas", "guide"].forEach(v => {
    const el = $(v + "View");
    if (el) el.hidden = v !== view;
  });

  document.querySelectorAll(".side-link").forEach(b => {
    b.classList.toggle("active", b.dataset.view === view);
  });

  const titles = {
    dashboard: "Dashboard",
    reports: "Data Laporan",
    petugas: "Petugas",
    guide: "Panduan Admin"
  };

  const elTitle = $("pageTitle");
  const crumb = $("crumb");

  if (elTitle) elTitle.textContent = titles[view] || "Dashboard";
  if (crumb) crumb.textContent = (titles[view] || "Dashboard").toUpperCase();
}

const badge = s =>
  `<span class="status ${statusClass(s)}">${esc(s || "Laporan Dikirim")}</span>`;

function petugasCell(r) {
  if (!r.petugas_id) {
    return '<span class="muted-text">Belum ditugaskan</span>';
  }

  const p = pById(r.petugas_id);

  return `<strong>${esc(p ? p.nama : "(tidak ditemukan)")}</strong>
    ${r.tanggal_target
      ? `<br><span>Target ${esc(dateOnly(r.tanggal_target))}</span>`
      : ""}
    ${isOverdue(r)
      ? '<span class="status terlambat">Terlambat</span>'
      : ""}`;
}

function tableMarkup(list) {
  if (!list.length) {
    return '<div class="empty">Belum ada laporan yang cocok.</div>';
  }

  return `<table>
    <thead>
      <tr>
        <th>Nomor / Pelapor</th>
        <th>Kategori</th>
        <th>Tanggal</th>
        <th>Status</th>
        <th>Petugas</th>
        <th>Aksi</th>
      </tr>
    </thead>
    <tbody>
      ${list.map(r => `<tr>
        <td>
          <strong>${esc(r.id)}</strong><br>
          <span>${esc(r.nama || "Tanpa nama")}</span>
        </td>
        <td>${esc(r.kategori || "-")}</td>
        <td>${esc(dateText(r.createdAt))}</td>
        <td>${badge(r.status)}</td>
        <td>${petugasCell(r)}</td>
        <td>
          <button class="table-action" data-detail="${esc(r.id)}">
            Detail
          </button>
        </td>
      </tr>`).join("")}
    </tbody>
  </table>`;
}

/* =========================================
   DASHBOARD
========================================= */

function renderDashboard() {
  $("totalStat").textContent = reports.length;

  $("verifyStat").textContent = reports.filter(
    r => r.status === "Laporan Dikirim"
  ).length;

  $("processStat").textContent = reports.filter(
    r => r.status === "Sedang Diproses"
  ).length;

  $("doneStat").textContent = reports.filter(
    r => r.status === "Selesai Diperbaiki"
  ).length;

  $("sideCount").textContent = reports.length;

  $("sidePetugas").textContent =
    petugas.filter(p => p.aktif).length;

  $("recentTable").innerHTML = tableMarkup(reports.slice(0, 5));

  const counts = {};

  reports.forEach(r => {
    const k = r.kategori || "Lainnya";
    counts[k] = (counts[k] || 0) + 1;
  });

  const entries = Object.entries(counts)
    .sort((a, b) => b[1] - a[1]);

  $("categorySummary").innerHTML = entries.length
    ? entries.map(([name, n]) => `
        <div>
          <div class="cat-line">
            <span>${esc(name)}</span>
            <span>${n}</span>
          </div>
          <div class="bar">
            <span style="width:${Math.round(
              n / Math.max(reports.length, 1) * 100
            )}%"></span>
          </div>
        </div>
      `).join("")
    : '<div class="empty">Belum ada data kategori.</div>';
}

/* =========================================
   FILTER LAPORAN
========================================= */

function renderPetugasFilter() {
  const sel = $("petugasFilter");
  const cur = sel.value;

  sel.innerHTML =
    '<option value="">Semua petugas</option>' +
    '<option value="__none">Belum ditugaskan</option>' +
    petugas.map(p =>
      `<option value="${esc(p.id)}">${esc(p.nama)}</option>`
    ).join("");

  sel.value = cur;
}

function renderReports() {
  const q = $("searchInput").value.trim().toLowerCase();
  const st = $("statusFilter").value;
  const cat = $("categoryFilter").value;
  const pf = $("petugasFilter").value;

  const list = reports.filter(r =>
    (!st || r.status === st) &&
    (!cat || r.kategori === cat) &&
    (!pf || (
      pf === "__none"
        ? !r.petugas_id
        : String(r.petugas_id) === String(pf)
    )) &&
    (!q || [
      r.id,
      r.nama,
      r.kontak,
      r.alamat,
      r.kategori,
      r.deskripsi,
      pById(r.petugas_id)?.nama
    ].some(v => String(v || "").toLowerCase().includes(q)))
  );

  $("resultCount").textContent =
    `${list.length} dari ${reports.length} laporan`;

  $("reportsTable").innerHTML = tableMarkup(list);
}

/* =========================================
   DATA PETUGAS
========================================= */

function renderPetugas() {
  const q = $("petugasSearch").value.trim().toLowerCase();

  const list = petugas.filter(p =>
    !q || [p.nama, p.kontak, p.keahlian]
      .some(v => String(v || "").toLowerCase().includes(q))
  );

  $("petugasCount").textContent =
    `${list.length} dari ${petugas.length} petugas`;

  $("petugasTable").innerHTML = list.length
    ? `<table>
        <thead>
          <tr>
            <th>Nama</th>
            <th>Kontak</th>
            <th>Keahlian</th>
            <th>Tugas aktif</th>
            <th>Status</th>
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody>
          ${list.map(p => `<tr>
            <td><strong>${esc(p.nama)}</strong></td>
            <td>${esc(p.kontak || "-")}</td>
            <td>${esc(p.keahlian || "-")}</td>
            <td>${activeTaskCount(p.id)}</td>
            <td>
              <span class="status ${p.aktif ? "aktif" : "nonaktif"}">
                ${p.aktif ? "Aktif" : "Nonaktif"}
              </span>
            </td>
            <td>
              <button class="table-action"
                data-edit-petugas="${esc(p.id)}">Edit</button>
              <button class="table-action"
                data-toggle-petugas="${esc(p.id)}">
                ${p.aktif ? "Nonaktifkan" : "Aktifkan"}
              </button>
            </td>
          </tr>`).join("")}
        </tbody>
      </table>`
    : '<div class="empty">Belum ada petugas. Klik Tambah Petugas.</div>';
}

function renderAll() {
  renderDashboard();
  renderPetugasFilter();
  renderReports();
  renderPetugas();
}

/* =========================================
   DETAIL DAN PENUGASAN LAPORAN
========================================= */

function openDetail(id) {
  const r = reports.find(x => String(x.id) === String(id));
  if (!r) return;

  const opts = petugas.filter(p =>
    p.aktif || String(p.id) === String(r.petugas_id)
  );

  $("modalTitle").textContent =
    `${r.kategori || "Laporan"} · ${r.id}`;

  $("modalBody").innerHTML = `
    <div class="detail-grid">
      <div class="detail-item">
        <small>Nama Pelapor</small>
        <strong>${esc(r.nama || "-")}</strong>
      </div>

      <div class="detail-item">
        <small>Email / Nomor Kontak</small>
        <strong>${esc(r.kontak || "-")}</strong>
      </div>

      <div class="detail-item detail-full">
        <small>Alamat / Lokasi</small>
        <strong>${esc(r.alamat || "-")}</strong>
        ${r.lat != null && r.lon != null
          ? `<p>Koordinat: ${esc(r.lat)}, ${esc(r.lon)}</p>`
          : ""}
      </div>

      <div class="detail-item detail-full">
        <small>Deskripsi Kerusakan</small>
        <p>${esc(r.deskripsi || "-")}</p>
      </div>

      <div class="detail-item">
        <small>Tanggal Laporan</small>
        <strong>${esc(dateText(r.createdAt))}</strong>
      </div>

      <div class="detail-item">
        <small>Status Saat Ini</small>
        ${badge(r.status)}
        ${isOverdue(r)
          ? '<span class="status terlambat">Terlambat</span>'
          : ""}
      </div>

      ${r.foto
        ? `<div class="detail-item detail-full">
            <small>Bukti Foto</small>
            <img class="detail-photo"
              src="${esc(r.foto)}" alt="Foto kerusakan">
          </div>`
        : ""}
    </div>

    <div class="assign-box">
      <h3>Penugasan &amp; Status</h3>

      <div class="form-grid">
        <label class="field detail-full">
          Petugas
          <select id="asgPetugas">
            <option value="">— Belum ditugaskan —</option>
            ${opts.map(p => `
              <option value="${esc(p.id)}"
                ${String(p.id) === String(r.petugas_id) ? "selected" : ""}>
                ${esc(p.nama)}
                ${p.keahlian ? " · " + esc(p.keahlian) : ""}
                ${p.aktif ? "" : " (nonaktif)"}
              </option>
            `).join("")}
          </select>
        </label>

        <label class="field">
          Tanggal penugasan
          <input type="date" id="asgMulai"
            value="${esc(r.tanggal_penugasan || "")}">
        </label>

        <label class="field">
          Tanggal target selesai
          <input type="date" id="asgTarget"
            value="${esc(r.tanggal_target || "")}">
        </label>

        <label class="field detail-full">
          Catatan penugasan
          <textarea id="asgCatatan" rows="3"
            placeholder="Instruksi untuk petugas...">${esc(r.catatan_penugasan || "")}</textarea>
        </label>

        <label class="field detail-full">
          Status laporan
          <select id="detailStatus">
            ${STATUSES.map(s => `
              <option ${s === r.status ? "selected" : ""}>${s}</option>
            `).join("")}
          </select>
        </label>
      </div>
    </div>

    <div class="detail-actions">
      <button class="btn secondary" data-close>Batal</button>
      <button id="saveAssign" class="btn primary">Simpan</button>
    </div>
  `;

  $("detailModal").hidden = false;

  $("saveAssign").addEventListener("click", async () => {
    const pid = $("asgPetugas").value || null;

    let mulai = $("asgMulai").value || null;
    const target = $("asgTarget").value || null;
    let catatan = $("asgCatatan").value.trim() || null;

    if (pid && !mulai) mulai = today();

    if (!pid) {
      mulai = null;
      catatan = null;
    }

    if (mulai && target && target < mulai) {
      toast("Tanggal target tidak boleh sebelum tanggal penugasan.", "error");
      return;
    }

    const btn = $("saveAssign");
    btn.disabled = true;

    try {
      const { data, error } = await sb
        .from("laporan")
        .update({
          status: $("detailStatus").value,
          petugas_id: pid,
          tanggal_penugasan: mulai,
          tanggal_target: target,
          catatan_penugasan: catatan
        })
        .eq("id", r.id)
        .select();

      if (error) throw error;

      if (!data || !data.length) {
        toast("Data tidak berubah. Periksa izin UPDATE pada RLS.", "error");
        return;
      }

      $("detailModal").hidden = true;
      await loadData();
      toast("Laporan berhasil diperbarui.");
    } catch (err) {
      console.error(err);
      toast("Gagal menyimpan laporan: " + err.message, "error");
    } finally {
      btn.disabled = false;
    }
  });

  if (!opts.length) {
    toast("Belum ada petugas aktif. Tambahkan petugas terlebih dahulu.");
  }
}

/* =========================================
   TAMBAH DAN EDIT PETUGAS
========================================= */

function openPetugasForm(id) {
  const p = id ? pById(id) : null;

  $("petugasModalTitle").textContent =
    p ? "Edit petugas" : "Tambah petugas";

  $("petugasId").value = p ? p.id : "";
  $("petugasNama").value = p?.nama || "";
  $("petugasKontak").value = p?.kontak || "";
  $("petugasKeahlian").value = p?.keahlian || "";
  $("petugasAktif").checked = p ? !!p.aktif : true;

  $("petugasModal").hidden = false;
  $("petugasNama").focus();
}

$("petugasForm").addEventListener("submit", async e => {
  e.preventDefault();

  if (!sb) {
    toast(CONFIG_ERROR, "error");
    return;
  }

  const id = $("petugasId").value;

  const row = {
    nama: $("petugasNama").value.trim(),
    kontak: $("petugasKontak").value.trim() || null,
    keahlian: $("petugasKeahlian").value.trim() || null,
    aktif: $("petugasAktif").checked
  };

  if (!row.nama) return;

  const btn = $("petugasSaveBtn");
  btn.disabled = true;

  try {
    const result = id
      ? await sb.from("petugas").update(row).eq("id", id).select()
      : await sb.from("petugas").insert(row).select();

    if (result.error) throw result.error;

    if (!result.data || !result.data.length) {
      toast("Petugas tidak tersimpan. Periksa izin INSERT/UPDATE RLS.", "error");
      return;
    }

    $("petugasModal").hidden = true;
    await loadData();
    toast("Data petugas berhasil disimpan.");
  } catch (err) {
    console.error(err);
    toast("Gagal menyimpan petugas: " + err.message, "error");
  } finally {
    btn.disabled = false;
  }
});

async function togglePetugas(id) {
  if (!sb) {
    toast(CONFIG_ERROR, "error");
    return;
  }

  const p = pById(id);
  if (!p) return;

  const n = activeTaskCount(id);

  if (
    p.aktif && n &&
    !confirm(`${p.nama} masih menangani ${n} laporan yang belum selesai. Tetap nonaktifkan?`)
  ) return;

  try {
    const { data, error } = await sb
      .from("petugas")
      .update({ aktif: !p.aktif })
      .eq("id", id)
      .select();

    if (error) throw error;

    if (!data || !data.length) {
      toast("Status tidak berubah. Periksa policy UPDATE pada tabel petugas.", "error");
      return;
    }

    await loadData();
    toast(p.aktif ? "Petugas dinonaktifkan." : "Petugas diaktifkan.");
  } catch (err) {
    console.error(err);
    toast("Gagal mengubah status petugas: " + err.message, "error");
  }
}

/* =========================================
   EVENT LISTENER
========================================= */

document.querySelectorAll("[data-view]").forEach(b => {
  b.addEventListener("click", () => setView(b.dataset.view));
});

document.querySelectorAll("[data-goto]").forEach(b => {
  b.addEventListener("click", () => setView(b.dataset.goto));
});

document.addEventListener("click", e => {
  const d = e.target.closest("[data-detail]");
  if (d) openDetail(d.dataset.detail);

  const ed = e.target.closest("[data-edit-petugas]");
  if (ed) openPetugasForm(ed.dataset.editPetugas);

  const tg = e.target.closest("[data-toggle-petugas]");
  if (tg) togglePetugas(tg.dataset.togglePetugas);

  const c = e.target.closest("[data-close]");
  if (c) {
    const m = c.closest(".modal");
    if (m) m.hidden = true;
  }
});

document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    document.querySelectorAll(".modal").forEach(m => {
      m.hidden = true;
    });
  }
});

$("logoutBtn").addEventListener("click", logout);
$("refreshBtn").addEventListener("click", loadData);
$("addPetugasBtn").addEventListener("click", () => openPetugasForm());

[
  "searchInput",
  "statusFilter",
  "categoryFilter",
  "petugasFilter"
].forEach(id => {
  $(id).addEventListener("input", renderReports);
});

$("petugasSearch").addEventListener("input", renderPetugas);

/* =========================================
   CEK SESSION SUPABASE
========================================= */

if (sb) {
  sb.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") {
      $("appScreen").hidden = true;
      $("loginScreen").hidden = false;
    }
  });

  (async () => {
    try {
      const { data, error } = await sb.auth.getSession();

      if (error) throw error;

      if (data.session) {
        await showApp(data.session);
      }
    } catch (err) {
      console.error("Session error:", err);
    }
  })();
} else {
  console.error("Konfigurasi Supabase:", CONFIG_ERROR);

  const msg = $("loginMessage");
  if (msg) msg.textContent = CONFIG_ERROR;
}
