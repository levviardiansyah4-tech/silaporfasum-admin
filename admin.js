const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const STATUSES=["Laporan Dikirim","Diverifikasi","Sedang Diproses","Selesai Diperbaiki"];
const statusClass=s=>String(s||"").toLowerCase().replaceAll(" ","-").replaceAll("/","-");
const dateText=s=>{if(!s)return "-";try{return new Date(s).toLocaleString("id-ID",{dateStyle:"medium",timeStyle:"short"})}catch{return "-"}};
const dateOnly=s=>{if(!s)return "-";try{return new Date(s+"T00:00:00").toLocaleDateString("id-ID",{dateStyle:"medium"})}catch{return "-"}};
const today=()=>{const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*6e4).toISOString().slice(0,10)};

const sb=window.supabase.createClient(window.SUPABASE_URL,window.SUPABASE_ANON_KEY);
let reports=[],petugas=[],activeView="dashboard";

/* Pemetaan kolom tabel `laporan` -> field yang dipakai tampilan.
   Kalau nama kolom di Supabase kamu berbeda, ubah di sini saja. */
const normalize=r=>({...r,
  createdAt:r.created_at||r.createdAt||null,
  nama:r.nama??r.nama_pelapor,
  kontak:r.kontak??r.email??r.no_hp,
  alamat:r.alamat??r.lokasi,
  foto:r.foto??r.foto_url,
  lat:r.lat??r.latitude,
  lon:r.lon??r.lng??r.longitude,
  status:r.status||"Laporan Dikirim"});

const pById=id=>petugas.find(p=>p.id===id);
const activeTaskCount=pid=>reports.filter(r=>r.petugas_id===pid&&r.status!=="Selesai Diperbaiki").length;
const isOverdue=r=>!!r.tanggal_target&&r.status!=="Selesai Diperbaiki"&&r.tanggal_target<today();

let toastTimer;
function toast(msg,type){let t=$("toast");if(!t){t=document.createElement("div");t.id="toast";document.body.appendChild(t)}
  t.textContent=msg;t.className="toast show "+(type||"");clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.className="toast",3800)}

/* ---------- Auth ---------- */
$("loginForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const btn=$("loginBtn");btn.disabled=true;$("loginMessage").textContent="";
  const {data,error}=await sb.auth.signInWithPassword({email:$("username").value.trim(),password:$("password").value});
  btn.disabled=false;
  if(error){$("loginMessage").textContent="Email atau password belum sesuai.";return}
  showApp(data.session);
});
async function showApp(session){
  $("loginScreen").hidden=true;$("appScreen").hidden=false;
  $("adminEmail").textContent=session?.user?.email||"Pengelola sistem";
  await loadData();
}
async function logout(){await sb.auth.signOut();$("appScreen").hidden=true;$("loginScreen").hidden=false;$("password").value="";reports=[];petugas=[]}

/* ---------- Data ---------- */
async function loadData(){
  $("reportsTable").innerHTML='<div class="empty">Memuat data...</div>';
  const [r,p]=await Promise.all([sb.from("laporan").select("*"),sb.from("petugas").select("*").order("nama")]);
  if(r.error){toast("Gagal memuat laporan: "+r.error.message,"error")}
  if(p.error){toast("Gagal memuat petugas: "+p.error.message,"error")}
  reports=(r.data||[]).map(normalize).sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0));
  petugas=p.data||[];
  renderAll();
}

/* ---------- Tampilan ---------- */
function setView(view){
  activeView=view;
  ["dashboard","reports","petugas","guide"].forEach(v=>$(v+"View").hidden=v!==view);
  document.querySelectorAll(".side-link").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
  $("pageTitle").textContent={dashboard:"Dashboard",reports:"Data Laporan",petugas:"Petugas",guide:"Panduan Admin"}[view];
  $("crumb").textContent={dashboard:"DASHBOARD",reports:"DATA LAPORAN",petugas:"PETUGAS",guide:"PANDUAN ADMIN"}[view];
}
const badge=s=>`<span class="status ${statusClass(s)}">${esc(s||"Laporan Dikirim")}</span>`;
function petugasCell(r){
  if(!r.petugas_id)return '<span class="muted-text">Belum ditugaskan</span>';
  const p=pById(r.petugas_id);
  return `<strong>${esc(p?p.nama:"(tidak ditemukan)")}</strong>${r.tanggal_target?`<br><span>Target ${esc(dateOnly(r.tanggal_target))}</span>`:""}${isOverdue(r)?'<span class="status terlambat">Terlambat</span>':""}`;
}
function tableMarkup(list){
  if(!list.length)return '<div class="empty">Belum ada laporan yang cocok.</div>';
  return `<table><thead><tr><th>Nomor / Pelapor</th><th>Kategori</th><th>Tanggal</th><th>Status</th><th>Petugas</th><th>Aksi</th></tr></thead><tbody>${list.map(r=>`<tr><td><strong>${esc(r.id)}</strong><br><span>${esc(r.nama||"Tanpa nama")}</span></td><td>${esc(r.kategori||"-")}</td><td>${esc(dateText(r.createdAt))}</td><td>${badge(r.status)}</td><td>${petugasCell(r)}</td><td><button class="table-action" data-detail="${esc(r.id)}">Detail</button></td></tr>`).join("")}</tbody></table>`;
}
function renderDashboard(){
  $("totalStat").textContent=reports.length;
  $("verifyStat").textContent=reports.filter(r=>r.status==="Laporan Dikirim").length;
  $("processStat").textContent=reports.filter(r=>r.status==="Sedang Diproses").length;
  $("doneStat").textContent=reports.filter(r=>r.status==="Selesai Diperbaiki").length;
  $("sideCount").textContent=reports.length;
  $("sidePetugas").textContent=petugas.filter(p=>p.aktif).length;
  $("recentTable").innerHTML=tableMarkup(reports.slice(0,5));
  const counts={};reports.forEach(r=>{const k=r.kategori||"Lainnya";counts[k]=(counts[k]||0)+1});
  const entries=Object.entries(counts).sort((a,b)=>b[1]-a[1]);
  $("categorySummary").innerHTML=entries.length?entries.map(([name,n])=>`<div><div class="cat-line"><span>${esc(name)}</span><span>${n}</span></div><div class="bar"><span style="width:${Math.round(n/Math.max(reports.length,1)*100)}%"></span></div></div>`).join(""):'<div class="empty">Belum ada data kategori.</div>';
}
function renderPetugasFilter(){
  const sel=$("petugasFilter"),cur=sel.value;
  sel.innerHTML='<option value="">Semua petugas</option><option value="__none">Belum ditugaskan</option>'+petugas.map(p=>`<option value="${esc(p.id)}">${esc(p.nama)}</option>`).join("");
  sel.value=cur;
}
function renderReports(){
  const q=$("searchInput").value.trim().toLowerCase(),st=$("statusFilter").value,cat=$("categoryFilter").value,pf=$("petugasFilter").value;
  const list=reports.filter(r=>(!st||r.status===st)&&(!cat||r.kategori===cat)
    &&(!pf||(pf==="__none"?!r.petugas_id:r.petugas_id===pf))
    &&(!q||[r.id,r.nama,r.kontak,r.alamat,r.kategori,r.deskripsi,pById(r.petugas_id)?.nama].some(v=>String(v||"").toLowerCase().includes(q))));
  $("resultCount").textContent=`${list.length} dari ${reports.length} laporan`;
  $("reportsTable").innerHTML=tableMarkup(list);
}
function renderPetugas(){
  const q=$("petugasSearch").value.trim().toLowerCase();
  const list=petugas.filter(p=>!q||[p.nama,p.kontak,p.keahlian].some(v=>String(v||"").toLowerCase().includes(q)));
  $("petugasCount").textContent=`${list.length} dari ${petugas.length} petugas`;
  $("petugasTable").innerHTML=list.length?`<table><thead><tr><th>Nama</th><th>Kontak</th><th>Keahlian</th><th>Tugas aktif</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${list.map(p=>`<tr><td><strong>${esc(p.nama)}</strong></td><td>${esc(p.kontak||"-")}</td><td>${esc(p.keahlian||"-")}</td><td>${activeTaskCount(p.id)}</td><td><span class="status ${p.aktif?"aktif":"nonaktif"}">${p.aktif?"Aktif":"Nonaktif"}</span></td><td><button class="table-action" data-edit-petugas="${esc(p.id)}">Edit</button> <button class="table-action" data-toggle-petugas="${esc(p.id)}">${p.aktif?"Nonaktifkan":"Aktifkan"}</button></td></tr>`).join("")}</tbody></table>`:'<div class="empty">Belum ada petugas. Klik "+ Tambah Petugas".</div>';
}
function renderAll(){renderDashboard();renderPetugasFilter();renderReports();renderPetugas()}

/* ---------- Detail laporan + penugasan ---------- */
function openDetail(id){
  const r=reports.find(x=>String(x.id)===String(id));if(!r)return;
  const opts=petugas.filter(p=>p.aktif||p.id===r.petugas_id);
  $("modalTitle").textContent=`${r.kategori||"Laporan"} · ${r.id}`;
  $("modalBody").innerHTML=`<div class="detail-grid">
  <div class="detail-item"><small>Nama Pelapor</small><strong>${esc(r.nama||"-")}</strong></div>
  <div class="detail-item"><small>Email / Nomor Kontak</small><strong>${esc(r.kontak||"-")}</strong></div>
  <div class="detail-item detail-full"><small>Alamat / Lokasi</small><strong>${esc(r.alamat||"-")}</strong>${r.lat&&r.lon?`<p>Koordinat: ${esc(r.lat)}, ${esc(r.lon)}</p>`:""}</div>
  <div class="detail-item detail-full"><small>Deskripsi Kerusakan</small><p>${esc(r.deskripsi||"-")}</p></div>
  <div class="detail-item"><small>Tanggal Laporan</small><strong>${esc(dateText(r.createdAt))}</strong></div>
  <div class="detail-item"><small>Status Saat Ini</small>${badge(r.status)}${isOverdue(r)?'<span class="status terlambat">Terlambat</span>':""}</div>
  ${r.foto?`<div class="detail-item detail-full"><small>Bukti Foto</small><img class="detail-photo" src="${esc(r.foto)}" alt="Foto kerusakan"></div>`:""}
  </div>
  <div class="assign-box"><h3>Penugasan &amp; Status</h3><div class="form-grid">
    <label class="field detail-full">Petugas<select id="asgPetugas"><option value="">— Belum ditugaskan —</option>${opts.map(p=>`<option value="${esc(p.id)}" ${p.id===r.petugas_id?"selected":""}>${esc(p.nama)}${p.keahlian?" · "+esc(p.keahlian):""}${p.aktif?"":" (nonaktif)"}</option>`).join("")}</select></label>
    <label class="field">Tanggal penugasan<input type="date" id="asgMulai" value="${esc(r.tanggal_penugasan||"")}"></label>
    <label class="field">Tanggal target selesai<input type="date" id="asgTarget" value="${esc(r.tanggal_target||"")}"></label>
    <label class="field detail-full">Catatan penugasan<textarea id="asgCatatan" rows="3" placeholder="Instruksi untuk petugas...">${esc(r.catatan_penugasan||"")}</textarea></label>
    <label class="field detail-full">Status laporan<select id="detailStatus">${STATUSES.map(s=>`<option ${s===r.status?"selected":""}>${s}</option>`).join("")}</select></label>
  </div></div>
  <div class="detail-actions"><button class="btn secondary" data-close>Batal</button><button id="saveAssign" class="btn primary">Simpan</button></div>`;
  $("detailModal").hidden=false;
  if(!opts.length)toast("Belum ada petugas aktif. Tambahkan dulu di menu Petugas.");
  $("saveAssign").addEventListener("click",async()=>{
    const pid=$("asgPetugas").value||null;
    let mulai=$("asgMulai").value||null,target=$("asgTarget").value||null,catatan=$("asgCatatan").value.trim()||null;
    if(pid&&!mulai)mulai=today();
    if(!pid){mulai=null;target=null;catatan=null}
    if(mulai&&target&&target<mulai){toast("Tanggal target tidak boleh sebelum tanggal penugasan.","error");return}
    const btn=$("saveAssign");btn.disabled=true;
    const {data,error}=await sb.from("laporan").update({status:$("detailStatus").value,petugas_id:pid,tanggal_penugasan:mulai,tanggal_target:target,catatan_penugasan:catatan}).eq("id",r.id).select();
    btn.disabled=false;
    if(error){toast("Gagal menyimpan: "+error.message,"error");return}
    if(!data||!data.length){toast("Tidak ada data yang berubah. Cek policy RLS UPDATE pada tabel laporan.","error");return}
    $("detailModal").hidden=true;await loadData();toast("Laporan diperbarui.");
  });
}

/* ---------- CRUD petugas ---------- */
function openPetugasForm(id){
  const p=id?pById(id):null;
  $("petugasModalTitle").textContent=p?"Edit petugas":"Tambah petugas";
  $("petugasId").value=p?p.id:"";
  $("petugasNama").value=p?.nama||"";$("petugasKontak").value=p?.kontak||"";$("petugasKeahlian").value=p?.keahlian||"";
  $("petugasAktif").checked=p?p.aktif:true;
  $("petugasModal").hidden=false;$("petugasNama").focus();
}
$("petugasForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const id=$("petugasId").value;
  const row={nama:$("petugasNama").value.trim(),kontak:$("petugasKontak").value.trim()||null,keahlian:$("petugasKeahlian").value.trim()||null,aktif:$("petugasAktif").checked};
  if(!row.nama)return;
  const btn=$("petugasSaveBtn");btn.disabled=true;
  const {data,error}=await(id?sb.from("petugas").update(row).eq("id",id).select():sb.from("petugas").insert(row).select());
  btn.disabled=false;
  if(error||!data||!data.length){toast("Gagal menyimpan petugas"+(error?": "+error.message:". Cek policy RLS."),"error");return}
  $("petugasModal").hidden=true;await loadData();toast("Petugas disimpan.");
});
async function togglePetugas(id){
  const p=pById(id);if(!p)return;
  const n=activeTaskCount(id);
  if(p.aktif&&n&&!confirm(`${p.nama} masih menangani ${n} laporan yang belum selesai. Tetap nonaktifkan?`))return;
  const {data,error}=await sb.from("petugas").update({aktif:!p.aktif}).eq("id",id).select();
  if(error||!data||!data.length){toast("Gagal mengubah status petugas.","error");return}
  await loadData();toast(p.aktif?"Petugas dinonaktifkan.":"Petugas diaktifkan.");
}

/* ---------- Event ---------- */
document.querySelectorAll("[data-view]").forEach(b=>b.addEventListener("click",()=>setView(b.dataset.view)));
document.querySelectorAll("[data-goto]").forEach(b=>b.addEventListener("click",()=>setView(b.dataset.goto)));
document.addEventListener("click",e=>{
  const d=e.target.closest("[data-detail]");if(d)openDetail(d.dataset.detail);
  const ed=e.target.closest("[data-edit-petugas]");if(ed)openPetugasForm(ed.dataset.editPetugas);
  const tg=e.target.closest("[data-toggle-petugas]");if(tg)togglePetugas(tg.dataset.togglePetugas);
  const c=e.target.closest("[data-close]");if(c){const m=c.closest(".modal");if(m)m.hidden=true}
});
document.addEventListener("keydown",e=>{if(e.key==="Escape")document.querySelectorAll(".modal").forEach(m=>m.hidden=true)});
$("logoutBtn").addEventListener("click",logout);
$("refreshBtn").addEventListener("click",loadData);
$("addPetugasBtn").addEventListener("click",()=>openPetugasForm());
["searchInput","statusFilter","categoryFilter","petugasFilter"].forEach(id=>$(id).addEventListener("input",renderReports));
$("petugasSearch").addEventListener("input",renderPetugas);
sb.auth.onAuthStateChange(ev=>{if(ev==="SIGNED_OUT"){$("appScreen").hidden=true;$("loginScreen").hidden=false}});
(async()=>{const {data}=await sb.auth.getSession();if(data.session)showApp(data.session)})();
