const KEY="silaporfasum_reports_v1";
const $=id=>document.getElementById(id);
const readReports=()=>{try{return JSON.parse(localStorage.getItem(KEY)||"[]")}catch{return []}};
const saveReports=x=>localStorage.setItem(KEY,JSON.stringify(x));
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const statusClass=s=>String(s||"").toLowerCase().replaceAll(" ","-").replaceAll("/","-");
const dateText=s=>{try{return new Date(s).toLocaleString("id-ID",{dateStyle:"medium",timeStyle:"short"})}catch{return "-"}};
const statuses=["Laporan Dikirim","Diverifikasi","Sedang Diproses","Selesai Diperbaiki"];
let activeView="dashboard";

function login(){
  $("loginForm").addEventListener("submit",e=>{
    e.preventDefault();
    // Demo frontend only. Replace with secure server-side authentication before production.
    if($("username").value.trim()==="admin" && $("password").value==="admin123"){
      sessionStorage.setItem("silapor_admin_demo","yes");
      showApp();
    } else $("loginMessage").textContent="Username atau password belum sesuai.";
  });
}
function showApp(){ $("loginScreen").hidden=true; $("appScreen").hidden=false; renderAll(); }
function logout(){sessionStorage.removeItem("silapor_admin_demo");$("appScreen").hidden=true;$("loginScreen").hidden=false;$("password").value="";}
function setView(view){
  activeView=view;
  ["dashboard","reports","guide"].forEach(v=>$(v+"View").hidden=v!==view);
  document.querySelectorAll(".side-link").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
  $("pageTitle").textContent={dashboard:"Dashboard",reports:"Data Laporan",guide:"Panduan Admin"}[view];
  $("crumb").textContent={dashboard:"DASHBOARD",reports:"DATA LAPORAN",guide:"PANDUAN ADMIN"}[view];
  if(view!=="guide")renderAll();
}
function badge(status){return `<span class="status ${statusClass(status)}">${esc(status||"Laporan Dikirim")}</span>`}
function tableMarkup(reports){
  if(!reports.length)return '<div class="empty">Belum ada laporan yang cocok.</div>';
  return `<table><thead><tr><th>Nomor / Pelapor</th><th>Kategori</th><th>Tanggal</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${reports.map(r=>`<tr><td><strong>${esc(r.id||"-")}</strong><br><span>${esc(r.nama||"Tanpa nama")}</span></td><td>${esc(r.kategori||"-")}</td><td>${esc(dateText(r.createdAt))}</td><td>${badge(r.status)}</td><td><button class="table-action" data-detail="${esc(r.id)}">Detail</button></td></tr>`).join("")}</tbody></table>`;
}
function renderDashboard(reports){
  $("totalStat").textContent=reports.length;
  $("verifyStat").textContent=reports.filter(r=>!r.status||r.status==="Laporan Dikirim").length;
  $("processStat").textContent=reports.filter(r=>r.status==="Sedang Diproses").length;
  $("doneStat").textContent=reports.filter(r=>r.status==="Selesai Diperbaiki").length;
  $("sideCount").textContent=reports.length;
  $("recentTable").innerHTML=tableMarkup(reports.slice().sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,5));
  const counts={};reports.forEach(r=>counts[r.kategori||"Lainnya"]=(counts[r.kategori||"Lainnya"]||0)+1);
  const entries=Object.entries(counts).sort((a,b)=>b[1]-a[1]);
  $("categorySummary").innerHTML=entries.length?entries.map(([name,n])=>`<div><div class="cat-line"><span>${esc(name)}</span><span>${n}</span></div><div class="bar"><span style="width:${Math.round(n/Math.max(reports.length,1)*100)}%"></span></div></div>`).join(""):'<div class="empty">Belum ada data kategori.</div>';
}
function renderReports(reports){
  const q=$("searchInput").value.trim().toLowerCase(),status=$("statusFilter").value,category=$("categoryFilter").value;
  const filtered=reports.filter(r=>(!status||(r.status||"Laporan Dikirim")===status)&&(!category||r.kategori===category)&&(!q||[r.id,r.nama,r.kontak,r.alamat,r.kategori,r.deskripsi].some(v=>String(v||"").toLowerCase().includes(q))));
  $("resultCount").textContent=`${filtered.length} dari ${reports.length} laporan`;
  $("reportsTable").innerHTML=tableMarkup(filtered);
}
function renderAll(){const reports=readReports();renderDashboard(reports);renderReports(reports);}
function openDetail(id){
  const r=readReports().find(x=>String(x.id)===String(id));if(!r)return;
  $("modalTitle").textContent=`${r.kategori||"Laporan"} · ${r.id||""}`;
  $("modalBody").innerHTML=`<div class="detail-grid">
  <div class="detail-item"><small>Nama Pelapor</small><strong>${esc(r.nama||"-")}</strong></div>
  <div class="detail-item"><small>Email / Nomor Kontak</small><strong>${esc(r.kontak||"-")}</strong></div>
  <div class="detail-item detail-full"><small>Alamat / Lokasi</small><strong>${esc(r.alamat||"-")}</strong>${r.lat&&r.lon?`<p>Koordinat: ${esc(r.lat)}, ${esc(r.lon)}</p>`:""}</div>
  <div class="detail-item detail-full"><small>Deskripsi Kerusakan</small><p>${esc(r.deskripsi||"-")}</p></div>
  <div class="detail-item"><small>Tanggal Laporan</small><strong>${esc(dateText(r.createdAt))}</strong></div>
  <div class="detail-item"><small>Status Saat Ini</small>${badge(r.status||"Laporan Dikirim")}</div>
  ${r.foto?`<div class="detail-item detail-full"><small>Bukti Foto</small><img class="detail-photo" src="${r.foto}" alt="Foto kerusakan"></div>`:""}
  </div><div class="detail-actions"><label for="detailStatus"><strong>Perbarui status:</strong></label><select id="detailStatus">${statuses.map(s=>`<option ${s===(r.status||"Laporan Dikirim")?"selected":""}>${s}</option>`).join("")}</select><button id="saveStatus" class="btn primary">Simpan Status</button></div>`;
  $("detailModal").hidden=false;
  $("saveStatus").addEventListener("click",()=>{
    const all=readReports(),item=all.find(x=>String(x.id)===String(id));if(!item)return;
    item.status=$("detailStatus").value;saveReports(all);$("detailModal").hidden=true;renderAll();
  });
}
document.querySelectorAll("[data-view]").forEach(b=>b.addEventListener("click",()=>setView(b.dataset.view)));
document.querySelectorAll("[data-goto]").forEach(b=>b.addEventListener("click",()=>setView(b.dataset.goto)));
document.addEventListener("click",e=>{const btn=e.target.closest("[data-detail]");if(btn)openDetail(btn.dataset.detail);if(e.target.matches("[data-close]"))$("detailModal").hidden=true;});
$("logoutBtn").addEventListener("click",logout);
$("refreshBtn").addEventListener("click",renderAll);
["searchInput","statusFilter","categoryFilter"].forEach(id=>$(id).addEventListener("input",()=>renderReports(readReports())));
login();
if(sessionStorage.getItem("silapor_admin_demo")==="yes")showApp();