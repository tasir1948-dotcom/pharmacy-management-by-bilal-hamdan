
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signOut,
signInWithEmailAndPassword, createUserWithEmailAndPassword,
sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
  getDatabase, ref, get, set, onValue, onDisconnect, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";

/* ================= FIREBASE CONFIG ================= */
const firebaseConfig = {
  apiKey: "AIzaSyCpf8Kro639hdpSDcc6AkQ1ER2XtjOsY2M",
  authDomain: "pharmadesk-pos.firebaseapp.com",
  databaseURL: "https://pharmadesk-pos-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "pharmadesk-pos",
  storageBucket: "pharmadesk-pos.firebasestorage.app",
  messagingSenderId: "560112302571",
  appId: "1:560112302571:web:293145f0b417eee09581ae"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const database = getDatabase(firebaseApp);
const ADMIN_UID = "2G0NYXe6FNOsos45dFLBBEF7b0K3";
/* ================= USER ONLINE STATUS ================= */
let onlineUnsubscribe = null;

async function startOnlineStatus(user) {
  const statusRef = ref(database, `onlineUsers/${user.uid}`);

  try {
    await onDisconnect(statusRef).set({
      email: user.email || "",
      online: false,
      lastSeen: serverTimestamp()
    });

    await set(statusRef, {
      email: user.email || "",
      online: true,
      lastSeen: serverTimestamp()
    });
  } catch (error) {
    console.error("Online status error:", error);
  }
}

/* ================= APP STATE ================= */
const $ = id => document.getElementById(id);
const KEY = "pharmacy_management_data";
let currentUser = null;
let eventsReady = false;
let saveQueue = Promise.resolve();
let accessUnsubscribe = [];
let authRun = 0;
let db = { medicines: [], sales: [], purchases: [] };
let cart = [];
let currentPage = "dashboard";
let toastTimer;

function localDataKey() {
  return `${KEY}_${currentUser?.uid || "guest"}`;
}
function normalizeData(data) {
  return {
    medicines: Array.isArray(data?.medicines) ? data.medicines : [],
    sales: Array.isArray(data?.sales) ? data.sales : [],
    purchases: Array.isArray(data?.purchases) ? data.purchases : []
  };
}
function money(value) {
  return "Rs " + Number(value || 0).toLocaleString("en-PK", {
    minimumFractionDigits: 0, maximumFractionDigits: 2
  });
}
function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  })[c]);
}
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2,8);
}
function toast(message) {
  const el = $("toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3000);
}

/* ================= LOGIN / STYLES ================= */
function addAuthStyles() {
  if ($("authStyles")) return;
  const style = document.createElement("style");
  style.id = "authStyles";
  style.textContent = `
    #loginOverlay,#accessOverlay{position:fixed;inset:0;z-index:999999;background:#f2f6f5;display:flex;align-items:center;justify-content:center;padding:18px;font-family:Arial,sans-serif;overflow:auto}
    .login-card,.access-card{width:100%;max-width:390px;background:white;padding:30px 24px;border-radius:18px;box-shadow:0 12px 45px rgba(0,0,0,.10);text-align:center;box-sizing:border-box}
    .login-logo{width:55px;height:55px;margin:auto auto 12px;display:grid;place-items:center;border-radius:15px;background:#123b35;color:white;font-size:30px}
    .login-card h2,.access-card h2{margin:8px 0;color:#123b35}
    .login-card p,.access-card p{color:#687b77;font-size:13px;line-height:1.6}
    .login-card label{display:block;text-align:left;margin:18px 0 7px;font-size:13px;font-weight:bold}
    .login-card input{width:100%;box-sizing:border-box;padding:13px;border:1px solid #d8e2df;border-radius:9px;font-size:16px}
    .login-card button,.access-card button{width:100%;padding:13px;margin-top:14px;border:0;border-radius:9px;background:#123b35;color:white;font-weight:bold;font-size:15px;cursor:pointer}
    .login-card button:disabled{opacity:.6}
    #registerBtn{background:#e9f0ee;color:#123b35}
    #loginMessage{min-height:18px;margin-top:15px}
    #adminRequestsOverlay{position:fixed;inset:0;z-index:99998;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:15px}
    .admin-requests-card{background:white;width:100%;max-width:650px;max-height:85vh;overflow:auto;padding:20px;border-radius:15px;box-sizing:border-box}
    .request-row{border:1px solid #dce6e3;border-radius:10px;padding:13px;margin:12px 0;overflow-wrap:anywhere}
    .request-actions{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}
    .request-actions button{flex:1;min-width:110px;border:0;padding:10px;border-radius:7px;color:white;cursor:pointer}
    .approve-request{background:#16794b}.reject-request{background:#bd3434}
    .admin-close{background:#123b35;color:white;border:0;padding:10px 16px;border-radius:7px;cursor:pointer}
  `;
  document.head.appendChild(style);
}
function createLogin() {
  addAuthStyles();
  if ($("loginOverlay")) return;
  const overlay = document.createElement("div");
  overlay.id = "loginOverlay";
  overlay.innerHTML = `
    <div class="login-card">
      <div class="login-logo">✚</div><h2>PharmaDesk</h2>
      <p>Secure pharmacy management login</p>
      <label>Email address</label><input id="loginEmail" type="email" placeholder="Enter your email" autocomplete="email">
      <label>Password</label><input id="loginPassword" type="password" placeholder="Enter your password" autocomplete="current-password">
      <button id="loginBtn" type="button">Login</button>
      <button id="forgotPasswordBtn" type="button">Forgot Password?</button>
      <button id="registerBtn" type="button">Create Account</button>
      <p id="loginMessage"></p>
    </div>`;
  document.body.appendChild(overlay);
  $("forgotPasswordBtn").addEventListener("click", forgotPassword);
  $("loginBtn").addEventListener("click", loginUser);
  $("registerBtn").addEventListener("click", registerUser);
}
async function forgotPassword() {
  const email = $("loginEmail").value.trim();

  if (!email) {
    $("loginMessage").textContent = "Please enter your email first.";
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    $("loginMessage").textContent =
      "Password reset link sent to your email.";
  } catch (error) {
    $("loginMessage").textContent = error.message;
  }
}
async function loginUser() {
  const email = $("loginEmail").value.trim(), password = $("loginPassword").value;
  const button = $("loginBtn"), message = $("loginMessage");
  if (!email || !password) { message.textContent = "Enter email and password."; return; }
  button.disabled = true; button.textContent = "Logging in...";
  try { await signInWithEmailAndPassword(auth,email,password); }
  catch (error) { console.error(error); message.textContent = error.message; button.disabled = false; button.textContent = "Login"; }
}
async function registerUser() {
  const email = $("loginEmail").value.trim(), password = $("loginPassword").value;
  const button = $("registerBtn"), message = $("loginMessage");
  if (!email || !password) { message.textContent = "Enter email and password."; return; }
  if (password.length < 6) { message.textContent = "Password must be at least 6 characters."; return; }
  button.disabled = true; button.textContent = "Creating account...";
  try {
    const credential = await createUserWithEmailAndPassword(auth,email,password);
    await ensureAccessRequest(credential.user);
    message.textContent = "Account created. Waiting for admin approval.";
  } catch (error) {
    console.error(error); message.textContent = error.message;
    button.disabled = false; button.textContent = "Create Account";
  }
}

/* ================= ACCESS REQUESTS ================= */
async function ensureAccessRequest(user) {
  if (!user || user.uid === ADMIN_UID) return;
  const requestRef = ref(database,`accessRequests/${user.uid}/request`);
  const snapshot = await get(requestRef);
  if (!snapshot.exists()) {
    await set(requestRef,{email:user.email || "",requestedAt:new Date().toISOString()});
  }
}
async function getApprovalStatus(user) {
  const approved = await get(ref(database,`approvedUsers/${user.uid}`));
  if (approved.val() === true) return "approved";
  const status = await get(ref(database,`accessRequests/${user.uid}/status`));
  return status.val() || "pending";
}
function stopAccessMonitoring() {
  accessUnsubscribe.forEach(unsubscribe => {
    if (typeof unsubscribe === "function") unsubscribe();
  });
  accessUnsubscribe = [];
}
function showAccessScreen(user,status) {
  $("loginOverlay")?.remove();
  $("sidebar")?.style.setProperty("display","none");
  document.querySelector(".main")?.style.setProperty("display","none");
  $("accessOverlay")?.remove();

  const info = {
    rejected:["Access Request Rejected","Your access request was rejected. Please contact the administrator."],
    revoked:["Access Removed","The administrator has removed your access."],
    pending:["Waiting for Admin Approval","Your account has been created. Please wait for administrator approval."]
  }[status] || ["Waiting for Admin Approval","Please wait for administrator approval."];

  const overlay = document.createElement("div");
  overlay.id = "accessOverlay";
  overlay.innerHTML = `
    <div class="access-card">
      <div class="login-logo">✚</div>
      <h2>PharmaDesk</h2>
      <h3>${info[0]}</h3>
      <p>${info[1]}</p>
      <p><b>${escapeHTML(user.email || "")}</b></p>
      <p>For assistance, contact Admin on WhatsApp:</p>
      <h3>03239276900</h3>
      <button onclick="window.open('https://wa.me/923239276900','_blank')">
        Contact Admin on WhatsApp
      </button>
      <button id="pendingLogoutBtn">Logout</button>
    </div>
  `;
  document.body.appendChild(overlay);
  $("pendingLogoutBtn").addEventListener("click",() => signOut(auth));
}
function showAccessError(message) {
  $("loginOverlay")?.remove(); $("accessOverlay")?.remove();
  const overlay = document.createElement("div");
  overlay.id = "accessOverlay";
  overlay.innerHTML = `<div class="access-card"><h2>PharmaDesk</h2><h3>Unable to verify access</h3><p>${escapeHTML(message)}</p><button id="accessRetryBtn">Retry</button><button id="accessErrorLogoutBtn">Logout</button></div>`;
  document.body.appendChild(overlay);
  $("accessRetryBtn").addEventListener("click",() => { if (currentUser) startApp(currentUser); });
  $("accessErrorLogoutBtn").addEventListener("click",() => signOut(auth));
}
function startAccessMonitoring(user) {
  stopAccessMonitoring();
  let approvedValue = false;
  let statusValue = "pending";
  const approvedRef = ref(database,`approvedUsers/${user.uid}`);
  const statusRef = ref(database,`accessRequests/${user.uid}/status`);
  const check = () => {
    if (!currentUser || currentUser.uid !== user.uid) return;
    if (approvedValue) {
      $("accessOverlay")?.remove();
      $("sidebar")?.style.removeProperty("display");
      document.querySelector(".main")?.style.removeProperty("display");
    } else {
      showAccessScreen(user,statusValue);
    }
  };
  accessUnsubscribe.push(onValue(approvedRef,snap => {
    approvedValue = snap.val() === true; check();
  },error => { console.error(error); showAccessError("Unable to monitor access. Check internet and Firebase rules."); }));
  accessUnsubscribe.push(onValue(statusRef,snap => {
    statusValue = snap.val() || "pending"; check();
  },error => console.error("Status listener:",error)));
}

/* ================= ADMIN ACCESS PANEL ================= */
function addAdminButton() {
  if (!currentUser || currentUser.uid !== ADMIN_UID) return;

  const actions = document.querySelector(".top-actions");

  if (actions && !$("adminRequestsBtn")) {
    const button = document.createElement("button");
    button.id = "adminRequestsBtn";
    button.className = "btn btn-light";
    button.textContent = "Access Requests";
    button.addEventListener("click", showAdminRequests);
    actions.appendChild(button);
  }

  watchOnlineUsers();
}
/* ================= ADMIN ONLINE USERS ================= */
let adminOnlineUsersUnsubscribe = null;

function watchOnlineUsers() {
  if (!currentUser || currentUser.uid !== ADMIN_UID) return;

  const panel = $("onlineUsersPanel");
  const list = $("onlineUsersList");

  if (!panel || !list) {
    console.error("Online users HTML elements missing!");
    return;
  }

  panel.style.display = "block";
  list.innerHTML = "<p>Loading users...</p>";

  if (adminOnlineUsersUnsubscribe) {
    adminOnlineUsersUnsubscribe();
    adminOnlineUsersUnsubscribe = null;
  }

  adminOnlineUsersUnsubscribe = onValue(
    ref(database, "onlineUsers"),
    snapshot => {
      console.log("Online users data:", snapshot.val());

      const users = snapshot.val() || {};
      const rows = Object.entries(users);

      list.innerHTML = rows.length
        ? rows.map(([uid, user]) => `
            <div class="request-row">
              <b>${escapeHTML(user.email || "Unknown user")}</b>
              <p>Status: <b>${user.online ? "Online" : "Offline"}</b></p>
            </div>
          `).join("")
        : "<p>No users found.</p>";
    },
    error => {
      console.error("Online users Firebase error:", error);
      list.innerHTML = "<p>Unable to load users. Check Firebase rules.</p>";
    }
  );
}
async function showAdminRequests() {
  if (!currentUser || currentUser.uid !== ADMIN_UID) return;
  try {
    const snapshot = await get(ref(database,"accessRequests"));
    const requests = snapshot.val() || {};
    $("adminRequestsOverlay")?.remove();
    const rows = Object.entries(requests).map(([uid,item]) => ({
      uid, email:item?.request?.email || "Unknown email",
      requestedAt:item?.request?.requestedAt || "",
      status:item?.status || "pending"
    }));
    const pending = rows.filter(r=>r.status==="pending").length;
    const approved = rows.filter(r=>r.status==="approved").length;
    const inactive = rows.filter(r=>["rejected","revoked"].includes(r.status)).length;
    const overlay = document.createElement("div");
    overlay.id = "adminRequestsOverlay";
    overlay.innerHTML = `
      <div class="admin-requests-card">
        <h2>PharmaDesk Access Management</h2>
        <p>Pending: ${pending} | Approved: ${approved} | Rejected/Removed: ${inactive}</p>
        <div id="adminRequestList">
          ${rows.length ? rows.map(item=>`
            <div class="request-row">
              <b>${escapeHTML(item.email)}</b><p>Status: <b>${escapeHTML(item.status)}</b></p>
              <small>${escapeHTML(item.requestedAt)}</small>
              <div class="request-actions">
                ${item.status==="pending" ? `
                  <button class="approve-request" data-action="approved" data-uid="${escapeHTML(item.uid)}">Approve</button>
                  <button class="reject-request" data-action="rejected" data-uid="${escapeHTML(item.uid)}">Reject</button>` : ""}
                ${item.status==="approved" ? `
                  <button class="reject-request" data-action="revoked" data-uid="${escapeHTML(item.uid)}">Remove Access</button>` : ""}
                ${["rejected","revoked"].includes(item.status) ? `
                  <button class="approve-request" data-action="approved" data-uid="${escapeHTML(item.uid)}">Approve Again</button>` : ""}
              </div>
            </div>`).join("") : "<p>No access requests found.</p>"}
        </div><button class="admin-close" id="closeAdminRequests">Close</button>
      </div>`;
    document.body.appendChild(overlay);
    $("closeAdminRequests").addEventListener("click",()=>overlay.remove());
    overlay.addEventListener("click",async event=>{
      const button = event.target.closest("[data-action]");
      if (!button) return;
      await updateUserAccess(button.dataset.uid,button.dataset.action);
    });
  } catch(error) {
    console.error(error); toast("Could not load requests. Check Firebase rules.");
  }
}
async function updateUserAccess(uid,action) {
  if (!currentUser || currentUser.uid !== ADMIN_UID || !uid || uid===ADMIN_UID) return;
  if (!["approved","rejected","revoked"].includes(action)) return;
  try {
    await set(ref(database,`approvedUsers/${uid}`),action==="approved");
    await set(ref(database,`accessRequests/${uid}/status`),action);
    toast(action==="approved" ? "User approved successfully." :
      action==="revoked" ? "User access removed." : "User rejected.");
    await showAdminRequests();
  } catch(error) {
    console.error(error); toast("Could not update access. Check Firebase rules.");
  }
}

/* ================= CLOUD DATA ================= */
function cloudPath() {
  if (!currentUser) throw new Error("User is not logged in.");
  return `users/${currentUser.uid}/data`;
}
async function loadCloud() {
  const snapshot = await get(ref(database,cloudPath()));
  if (snapshot.exists()) {
    db = normalizeData(snapshot.val());
    localStorage.setItem(localDataKey(),JSON.stringify(db));
    return;
  }
  const local = currentUser.uid===ADMIN_UID
    ? (localStorage.getItem(KEY)||localStorage.getItem(localDataKey()))
    : localStorage.getItem(localDataKey());
  if (local) {
    try {
      db = normalizeData(JSON.parse(local));
      const hasData = db.medicines.length || db.sales.length || db.purchases.length;
      if (hasData) await set(ref(database,cloudPath()),db);
    } catch(error) { console.error("Local data read:",error); db=normalizeData({}); }
  } else db=normalizeData({});
  localStorage.setItem(localDataKey(),JSON.stringify(db));
}
function saveData() {
  localStorage.setItem(localDataKey(),JSON.stringify(db));
  if (!currentUser) return Promise.resolve();
  const copy = JSON.parse(JSON.stringify(db)), path = cloudPath();
  saveQueue = saveQueue.catch(e=>console.error(e))
    .then(()=>set(ref(database,path),copy))
    .catch(error=>{console.error(error);toast("Cloud save failed. Check internet or database rules.");});
  return saveQueue;
}

/* ================= DATE / STOCK HELPERS ================= */
function daysUntil(dateString) {
  if (!dateString) return Infinity;
  return Math.ceil((new Date(dateString+"T00:00:00")-new Date(today()+"T00:00:00"))/86400000);
}
function isExpired(m) {
  return daysUntil(m.expiry) < 0;
}

function isUrgentExpiring(m) {
  const d = daysUntil(m.expiry);
  return d >= 0 && d <= 7;
}

function isExpiring(m) {
  const d = daysUntil(m.expiry);
  return d >= 0 && d <= 30;
}

function isLow(m) {
  return Number(m.qty) <= Number(m.reorder);
}
/* ================= MEDICINE STOCK DONUT GRAPH ================= */
function renderStockDonut() {
  const medicines = db.medicines;
  const total = medicines.length;

  const expired = medicines.filter(m =>
    m.expiry && m.expiry < today()
  ).length;

  const activeMedicines = medicines.filter(m =>
    !m.expiry || m.expiry >= today()
  );

  const low = activeMedicines.filter(isLow).length;
  const available = total - expired - low;

  const availablePercent = total
    ? Math.round((available / total) * 100)
    : 0;

  const lowPercent = total
    ? Math.round((low / total) * 100)
    : 0;

  const expiredPercent = total
    ? 100 - availablePercent - lowPercent
    : 0;

  if ($("stockPercent"))
    $("stockPercent").textContent = total;

  if ($("availablePercent"))
    $("availablePercent").textContent = availablePercent + "%";

  if ($("lowPercent"))
    $("lowPercent").textContent = lowPercent + "%";

  if ($("expiredPercent"))
    $("expiredPercent").textContent = expiredPercent + "%";

  const chart = $("stockDonut");

  if (chart) {
    chart.style.background = `conic-gradient(
      #16a34a 0% ${availablePercent}%,
      #f59e0b ${availablePercent}% ${availablePercent + lowPercent}%,
      #ef4444 ${availablePercent + lowPercent}% 100%
    )`;
  }
}
    

/* ================= NAVIGATION ================= */
function go(page) {
  const target=$(`page-${page}`); if(!target)return;
  document.querySelectorAll(".page").forEach(el=>el.classList.remove("active"));
  target.classList.add("active");
  document.querySelectorAll(".nav-link").forEach(el=>el.classList.toggle("active",el.dataset.page===page));
  currentPage=page;
  const titles={dashboard:"Dashboard",inventory:"Inventory",billing:"Sales & Billing",purchases:"Purchases",reports:"Reports"};
  if($("pageTitle"))$("pageTitle").textContent=titles[page]||page;
  $("sidebar")?.classList.remove("open"); renderAll();
}

/* ================= DASHBOARD ================= */
function renderDashboard() {
  const medicines=db.medicines, sales=db.sales.filter(s=>s.date===today());
renderStockDonut();  
const totalStockPayment = medicines.reduce(
  (total, medicine) => {
    return total +
      (Number(medicine.qty || 0) *
       Number(medicine.cost || 0));
  },
  0
);

if ($("statStockValue")) {
  $("statStockValue").textContent =
    money(totalStockPayment);
}
  const low=medicines.filter(isLow), expiring=medicines.filter(isExpiring);
  const urgentExpiry = medicines.filter(isUrgentExpiring);
const expiredMedicines = medicines.filter(isExpired);
  if($("statMedicines"))$("statMedicines").textContent=medicines.length;
  if($("statSales"))$("statSales").textContent=money(sales.reduce((n,s)=>n+Number(s.total||0),0));
  if($("statSaleCount"))$("statSaleCount").textContent=`${sales.length} transactions`;
  if($("statLow"))$("statLow").textContent=low.length;
  if($("statExpiry"))$("statExpiry").textContent=expiring.length;
  if($("statUrgentExpiry"))$("statUrgentExpiry").textContent=urgentExpiry.length;
if($("statExpired"))$("statExpired").textContent=expiredMedicines.length;
const alerts = medicines.filter(m =>
  isLow(m) || isExpired(m) || isExpiring(m)
);

if ($("dashboardAlerts")) {
  $("dashboardAlerts").innerHTML = alerts.length
    ? `<table>
        <thead>
          <tr>
            <th>Medicine</th>
            <th>Stock</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${alerts.slice(0, 12).map(m => `
            <tr>
              <td>${escapeHTML(m.name)}</td>
              <td>${Number(m.qty)}</td>
              <td>
                ${isExpired(m)
                  ? "⚫ Expired"
                  : isUrgentExpiring(m)
                    ? "🔴 Urgent - Within 7 Days"
                    : isExpiring(m)
                      ? "🟠 Warning - Within 30 Days"
                      : "🟡 Low Stock"}
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>`
    : `<p class="empty-state">No stock alerts.</p>`;
}
  if($("recentSales")) {
    const recent=[...db.sales].reverse().slice(0,5);
    $("recentSales").innerHTML=recent.length
      ? `<table><thead><tr><th>Date</th><th>Customer</th><th>Total</th></tr></thead><tbody>${recent.map(s=>`<tr><td>${escapeHTML(s.date)}</td><td>${escapeHTML(s.customer||"Walk-in")}</td><td>${money(s.total)}</td></tr>`).join("")}</tbody></table>`
      : `<p class="empty-state">No sales recorded yet.</p>`;
  }
}

/* ================= INVENTORY ================= */
function renderInventory() {
  const search=($("inventorySearch")?.value||"").toLowerCase(), filter=$("stockFilter")?.value||"all";
  let items=[...db.medicines];
  if(search)items=items.filter(m=>[m.name,m.category,m.batch].join(" ").toLowerCase().includes(search));
  if(filter==="low")items=items.filter(isLow);
  if(filter==="expired")items=items.filter(isExpired);
  if(filter==="expiring")items=items.filter(isExpiring);
  if(filter==="urgent")items=items.filter(isUrgentExpiring);
  const target=$("inventoryTable"); if(!target)return;
  target.innerHTML=items.length
    ? `<table><thead><tr><th>Medicine</th><th>Batch</th><th>Expiry</th><th>Stock</th><th>Sale price</th><th>Actions</th></tr></thead><tbody>${items.map(m=>`
      <tr><td><b>${escapeHTML(m.name)}</b><small>${escapeHTML(m.category||"")}</small></td>
      <td>${escapeHTML(m.batch||"-")}</td><td>${escapeHTML(m.expiry||"-")}</td><td>${Number(m.qty)}</td><td>${money(m.price)}</td>
      <td><button class="text-btn" data-edit="${escapeHTML(m.id)}">Edit</button>
      <button class="text-btn" data-delete="${escapeHTML(m.id)}">Delete</button></td></tr>`).join("")}</tbody></table>`
    : `<p class="empty-state">No medicines found. Add a medicine to get started.</p>`;
  renderPurchaseOptions();
}

/* ================= MEDICINE FORM ================= */
function openMedicine(id="") {
  const form=$("medicineForm"); if(!form)return; form.reset();
  const m=db.medicines.find(x=>x.id===id);
  $("medicineId").value=m?.id||"";
  $("medicineModalTitle").textContent=m?"Edit medicine":"Add medicine";
  $("medName").value=m?.name||""; $("medCategory").value=m?.category||"";
  $("medBatch").value=m?.batch||""; $("medExpiry").value=m?.expiry||"";
  $("medQty").value=m?.qty??0; $("medReorder").value=m?.reorder??10;
  $("medPrice").value=m?.price??""; $("medCost").value=m?.cost??0;
  $("medicineDialog").showModal();
}
function closeMedicine() { if($("medicineDialog")?.open)$("medicineDialog").close(); }
async function saveMedicine(event) {
  event.preventDefault();

  const id = $("medicineId").value || makeId();

  const medicine = {
    id,
    name: $("medName").value.trim(),
    category: $("medCategory").value.trim(),
    batch: $("medBatch").value.trim(),
    expiry: $("medExpiry").value,
    qty: Number($("medQty").value),
    reorder: Number($("medReorder").value),
    price: Number($("medPrice").value),
    cost: Number($("medCost").value || 0)
  };

  if (!medicine.name || !medicine.expiry) {
    toast("Please complete required fields.");
    return;
  }
const index = db.medicines.findIndex(m => m.id === id);

  if (index >= 0) {
    db.medicines[index] = medicine;
  } else {
    db.medicines.push(medicine);
  }

  await saveData();
  closeMedicine();
  renderAll();
  toast("Medicine saved successfully.");
}
/* ================= BILLING ================= */
function renderBillProducts() {
  const target=$("billProducts"); if(!target)return;
  const query=($("billSearch")?.value||"").toLowerCase();
  const items=db.medicines.filter(m=>Number(m.qty)>0&&!isExpired(m)&&m.name.toLowerCase().includes(query));
  target.innerHTML=items.length?items.map(m=>`<div class="product-item"><div><b>${escapeHTML(m.name)}</b><small>${Number(m.qty)} available · ${money(m.price)}</small></div><button class="btn btn-light" data-add-cart="${escapeHTML(m.id)}">Add</button></div>`).join(""):`<p class="empty-state">No available medicines found.</p>`;
}
function addToCart(id) {
  const m=db.medicines.find(x=>x.id===id);
  if(!m||Number(m.qty)<=0||isExpired(m)){toast("Medicine is unavailable.");return;}
  const existing=cart.find(x=>x.id===id);
  if(existing){if(existing.qty>=Number(m.qty)){toast("Not enough stock.");return;}existing.qty++;}
  else cart.push({id:m.id,name:m.name,price:Number(m.price),qty:1});
  renderCart();
}
function renderCart() {
  const target=$("cartItems"); if(!target)return;
  target.innerHTML=cart.length?cart.map(i=>`<div class="cart-item"><div><b>${escapeHTML(i.name)}</b><small>${money(i.price)} each</small></div><div><button data-cart-minus="${escapeHTML(i.id)}">−</button><span>${i.qty}</span><button data-cart-plus="${escapeHTML(i.id)}">+</button><button data-cart-remove="${escapeHTML(i.id)}">×</button></div></div>`).join(""):`<p class="empty-state">Your bill is empty.</p>`;
  if($("billTotal"))$("billTotal").textContent=money(cart.reduce((n,i)=>n+i.price*i.qty,0));
}
function changeCartQty(id,amount) {
  const item=cart.find(i=>i.id===id), medicine=db.medicines.find(m=>m.id===id);
  if(!item||!medicine)return;
  const next=item.qty+amount;
  if(next<=0)cart=cart.filter(i=>i.id!==id);
  else if(next>Number(medicine.qty)){toast("Not enough stock.");return;}
  else item.qty=next;
  renderCart();
}
async function completeSale() {
  if(!cart.length){toast("Please add items to the bill.");return;}
  for(const item of cart){const m=db.medicines.find(x=>x.id===item.id);if(!m||Number(m.qty)<item.qty||isExpired(m)){toast(`Stock problem: ${item.name}`);return;}}
  const items=cart.map(i=>({...i,subtotal:i.price*i.qty}));
  const total=items.reduce((n,i)=>n+i.subtotal,0);
  for(const item of cart){const m=db.medicines.find(x=>x.id===item.id);m.qty=Number(m.qty)-item.qty;}
  db.sales.push({id:makeId(),date:today(),customer:$("customerName")?.value.trim()||"Walk-in",items,total});
  cart=[]; if($("customerName"))$("customerName").value="";
  await saveData(); renderAll(); toast("Sale completed successfully.");
}

/* ================= PURCHASES ================= */
function renderPurchaseOptions() {
  const select=$("purchaseMedicine"); if(!select)return;
  const previous=select.value;
  select.innerHTML=`<option value="">Select medicine</option>`+db.medicines.map(m=>`<option value="${escapeHTML(m.id)}">${escapeHTML(m.name)}</option>`).join("");
  if(db.medicines.some(m=>m.id===previous))select.value=previous;
}
async function savePurchase(event) {
  event.preventDefault();
  const id=$("purchaseMedicine").value, quantity=Number($("purchaseQty").value);
  const m=db.medicines.find(x=>x.id===id);
  if(!m){toast("Please select a medicine.");return;}
  if(!Number.isInteger(quantity)||quantity<=0){toast("Enter a valid quantity.");return;}
  const cost=Number($("purchaseCost").value||m.cost||0);
  m.qty=Number(m.qty)+quantity;
  if($("purchaseCost").value!=="")m.cost=cost;
  db.purchases.push({id:makeId(),medicineId:id,medicineName:m.name,quantity,
    supplier:$("purchaseSupplier").value.trim(),cost,total:cost*quantity,date:today()});
  $("purchaseForm").reset(); await saveData(); renderAll(); toast("Purchase saved and stock updated.");
}
function renderPurchases() {
  const target=$("purchaseTable"); if(!target)return;
  const purchases=[...db.purchases].reverse();
  target.innerHTML=purchases.length?`<table><thead><tr><th>Date</th><th>Medicine</th><th>Quantity</th><th>Supplier</th><th>Total cost</th></tr></thead><tbody>${purchases.map(p=>`<tr><td>${escapeHTML(p.date)}</td><td>${escapeHTML(p.medicineName)}</td><td>${Number(p.quantity)}</td><td>${escapeHTML(p.supplier||"-")}</td><td>${money(p.total)}</td></tr>`).join("")}</tbody></table>`:`<p class="empty-state">No purchases recorded yet.</p>`;
}
/* ================= PRINT INVOICE ================= */
function printInvoice(saleId) {
  const sale = db.sales.find(s => s.id === saleId);

  if (!sale) {
    toast("Invoice not found.");
    return;
  }

  const invoiceWindow = window.open("", "_blank");

  if (!invoiceWindow) {
    toast("Please allow popups to print invoice.");
    return;
  }

  const items = (sale.items || []).map(item => `
    <tr>
      <td>${escapeHTML(item.name)}</td>
      <td>${Number(item.qty)}</td>
      <td>Rs ${Number(item.price).toLocaleString("en-PK")}</td>
      <td>Rs ${Number(item.subtotal ?? item.price * item.qty).toLocaleString("en-PK")}</td>
    </tr>
  `).join("");

  invoiceWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>PharmaDesk Invoice</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          padding: 25px;
          color: #222;
        }
        .invoice {
          max-width: 700px;
          margin: auto;
        }
        h1 {
          text-align: center;
          color: #123b35;
        }
        .info {
          margin: 25px 0;
          line-height: 1.8;
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        th, td {
          border: 1px solid #ddd;
          padding: 10px;
          text-align: left;
        }
        th {
          background: #123b35;
          color: white;
        }
        .total {
          text-align: right;
          margin-top: 25px;
          font-size: 20px;
          font-weight: bold;
        }
        .footer {
          text-align: center;
          margin-top: 45px;
          color: #666;
        }
        @media print {
          button { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="invoice">
        <h1>PharmaDesk</h1>
        <h2 style="text-align:center">SALES INVOICE</h2>

        <div class="info">
          <b>Invoice ID:</b> ${escapeHTML(sale.id)}<br>
          <b>Date:</b> ${escapeHTML(sale.date)}<br>
          <b>Customer:</b> ${escapeHTML(sale.customer || "Walk-in")}
        </div>

        <table>
          <thead>
            <tr>
              <th>Medicine</th>
              <th>Qty</th>
              <th>Price</th>
              <th>Subtotal</th>
            </tr>
          </thead>
          <tbody>${items}</tbody>
        </table>

        <div class="total">
          Total: Rs ${Number(sale.total || 0).toLocaleString("en-PK")}
        </div>

        <div class="footer">
          Thank you for your purchase!<br>
          Powered by PharmaDesk
        </div>

        <button onclick="window.print()">Print Invoice</button>
<button onclick="window.close();">
  Back to Home
</button>
      </div>
    </body>
    </html>
  `);

  invoiceWindow.document.close();
}
/* ================= REPORTS ================= */
function renderReports() {
  const sales=db.sales;
  const total=sales.reduce((n,s)=>n+Number(s.total||0),0);
  const units=sales.reduce((n,s)=>n+(s.items||[]).reduce((x,i)=>x+Number(i.qty||0),0),0);

  if($("reportTotal"))$("reportTotal").textContent=money(total);
  if($("reportCount"))$("reportCount").textContent=sales.length;
  if($("reportUnits"))$("reportUnits").textContent=units;

  const target=$("salesTable");
  if(!target)return;

  target.innerHTML=sales.length
  ? `<table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Customer</th>
        <th>Items</th>
        <th>Total</th>
        <th>Invoice</th>
      </tr>
    </thead>
    <tbody>
      ${[...sales].reverse().map(s=>`
        <tr>
          <td>${escapeHTML(s.date)}</td>
          <td>${escapeHTML(s.customer||"Walk-in")}</td>
          <td>${(s.items||[]).reduce((n,i)=>n+Number(i.qty||0),0)}</td>
          <td>${money(s.total)}</td>
          <td>
            <button class="btn btn-light" data-print-sale="${escapeHTML(s.id)}">
              Print Invoice
            </button>
          </td>
        </tr>
      `).join("")}
    </tbody>
  </table>`
  : `<p class="empty-state">No sales recorded yet.</p>`;
}

/* ================= EXPORT ================= */
function downloadFile(content,filename,type) {
  const blob=new Blob([content],{type}), url=URL.createObjectURL(blob), a=document.createElement("a");
  a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
function exportData() {
  downloadFile(JSON.stringify(db,null,2),"pharmadesk-backup.json","application/json");
  toast("Data backup downloaded.");
}
function exportSales() {
  const rows=[["Date","Customer","Items","Total"]];
  db.sales.forEach(s=>rows.push([s.date,s.customer||"Walk-in",(s.items||[]).reduce((n,i)=>n+Number(i.qty||0),0),s.total]));
  const csv=rows.map(row=>row.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(",")).join("\n");
  downloadFile(csv,"pharmadesk-sales.csv","text/csv;charset=utf-8");
  toast("Sales CSV downloaded.");
}

/* ================= EVENTS ================= */
function setupEvents() {
  if(eventsReady)return; eventsReady=true;
  document.querySelectorAll("[data-page]").forEach(button=>button.addEventListener("click",()=>go(button.dataset.page)));
  document.querySelectorAll("[data-go]").forEach(button=>button.addEventListener("click",()=>go(button.dataset.go)));
  $("menuBtn")?.addEventListener("click",()=>$("sidebar")?.classList.toggle("open"));
  $("addMedicineBtn")?.addEventListener("click",()=>openMedicine());
  $("closeMedicine")?.addEventListener("click",closeMedicine);
  $("cancelMedicine")?.addEventListener("click",closeMedicine);
  $("medicineForm")?.addEventListener("submit",saveMedicine);
  $("inventorySearch")?.addEventListener("input",renderInventory);
  $("stockFilter")?.addEventListener("change",renderInventory);
  $("inventoryTable")?.addEventListener("click",async event=>{
    const edit=event.target.closest("[data-edit]"), del=event.target.closest("[data-delete]");
    if(edit)openMedicine(edit.dataset.edit);
    if(del){
      const id=del.dataset.delete, m=db.medicines.find(x=>x.id===id);
      if(!m||!confirm(`Delete ${m.name}?`))return;
      db.medicines=db.medicines.filter(x=>x.id!==id); cart=cart.filter(x=>x.id!==id);
      await saveData(); renderAll(); toast("Medicine deleted.");
    }
  });
  $("billSearch")?.addEventListener("input",renderBillProducts);
  $("billProducts")?.addEventListener("click",e=>{const b=e.target.closest("[data-add-cart]");if(b)addToCart(b.dataset.addCart);});
  $("cartItems")?.addEventListener("click",e=>{
    const plus=e.target.closest("[data-cart-plus]"), minus=e.target.closest("[data-cart-minus]"), remove=e.target.closest("[data-cart-remove]");
    if(plus)changeCartQty(plus.dataset.cartPlus,1);
    if(minus)changeCartQty(minus.dataset.cartMinus,-1);
    if(remove){cart=cart.filter(i=>i.id!==remove.dataset.cartRemove);renderCart();}
  });
  $("clearCart")?.addEventListener("click",()=>{cart=[];renderCart();});
  $("completeSale")?.addEventListener("click",completeSale);
  $("salesTable")?.addEventListener("click", event => {
  const button = event.target.closest("[data-print-sale]");
  if (!button) return;

  printInvoice(button.dataset.printSale);
});
  $("purchaseForm")?.addEventListener("submit",savePurchase);
  $("exportTop")?.addEventListener("click",exportData);
  $("exportSales")?.addEventListener("click",exportSales);
  if($("todayLabel"))$("todayLabel").textContent=new Date().toLocaleDateString("en-PK",{weekday:"long",year:"numeric",month:"long",day:"numeric"});
  if($("billDate"))$("billDate").textContent=new Date().toLocaleDateString("en-PK");
}

/* ================= LOGOUT / RENDER ================= */
function addLogoutButton() {
  const actions=document.querySelector(".top-actions");
  if(!actions||$("logoutBtn"))return;
  const button=document.createElement("button");
  button.id="logoutBtn"; button.className="btn btn-light"; button.textContent="Logout";
  button.addEventListener("click",async()=>{if(!confirm("Are you sure you want to logout?"))return;try{await signOut(auth);}catch(e){console.error(e);toast("Logout failed.");}});
  actions.appendChild(button);
}
function renderAll() {
  renderDashboard(); renderInventory(); renderBillProducts(); renderCart();
  renderPurchaseOptions(); renderPurchases(); renderReports();
}

/* ================= APP START ================= */
async function startApp(user) {
  const thisRun=++authRun;
  currentUser=user;
  try {
    $("accessOverlay")?.remove();
    if(user.uid!==ADMIN_UID) {
      await ensureAccessRequest(user);
      const status=await getApprovalStatus(user);
      if(thisRun!==authRun||!auth.currentUser||auth.currentUser.uid!==user.uid)return;
      if(status!=="approved"){showAccessScreen(user,status);return;}
      startAccessMonitoring(user);
    } else stopAccessMonitoring();

await startOnlineStatus(user);

$("sidebar")?.style.removeProperty("display");
    document.querySelector(".main")?.style.removeProperty("display");
    await loadCloud();
    if(thisRun!==authRun||!auth.currentUser||auth.currentUser.uid!==user.uid)return;
    setupEvents(); addLogoutButton(); addAdminButton(); renderAll();
    $("loginOverlay")?.remove(); toast("PharmaDesk ready.");
  } catch(error) {
    console.error("App startup error:",error);
    showAccessError("Could not verify your account or load cloud data. Check your internet connection and Firebase database rules.");
  }
}

/* ================= AUTH LISTENER ================= */
addAuthStyles();
createLogin();
onAuthStateChanged(auth,async user=>{
  if(user) await startApp(user);
  else {
    authRun++;
    stopAccessMonitoring();
    currentUser=null; cart=[];
    $("accessOverlay")?.remove(); $("adminRequestsOverlay")?.remove();
    $("sidebar")?.style.removeProperty("display");
    document.querySelector(".main")?.style.removeProperty("display");
    $("logoutBtn")?.remove(); $("adminRequestsBtn")?.remove();
    createLogin();
  }
});
