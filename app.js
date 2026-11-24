
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  getAuth, RecaptchaVerifier, signInWithPhoneNumber,
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
  getDatabase, ref, get, set
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCpf8Kro639hdpSDcc6AkQ1ER2XtjOsY2M",
  authDomain: "pharmadesk-pos.firebaseapp.com",
  databaseURL: "https://pharmadesk-pos-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "pharmadesk-pos",
  storageBucket: "pharmadesk-pos.firebasestorage.app",
  messagingSenderId: "560112302571",
  appId: "1:560112302571:web:293145f0b417eee09581ae"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

const $ = id => document.getElementById(id);
const KEY = "pharmacy_management_data";

let currentUser = null;
let confirmationResult = null;
let verifier = null;
let db = { medicines: [], sales: [], purchases: [] };
let cart = [];
let saveQueue = Promise.resolve();

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};
const money = n => "Rs " + Number(n || 0).toLocaleString("en-PK",{maximumFractionDigits:2});
const esc = v => String(v ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const medicine = id => db.medicines.find(m=>String(m.id)===String(id));

function toast(message) {
  const box = $("toast");
  if (!box) return alert(message);
  box.textContent = message;
  box.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(()=>box.classList.remove("show"),3000);
}

/* LOGIN */

function createLogin() {
  if ($("pharmaLogin")) return;

  const style = document.createElement("style");
  style.textContent = `
    #pharmaLogin{position:fixed;inset:0;z-index:99999;background:#eef4f1;display:flex;align-items:center;justify-content:center;padding:18px;font-family:Arial}
    .login-card{background:white;padding:28px;border-radius:16px;width:100%;max-width:380px;box-shadow:0 10px 35px #0002}
    .login-card h2{color:#123b35}
    .login-card input{width:100%;box-sizing:border-box;padding:13px;margin:8px 0;border:1px solid #ccd8d4;border-radius:8px;font-size:16px}
    .login-card button{width:100%;padding:13px;background:#123b35;color:white;border:0;border-radius:8px;margin-top:10px;font-weight:bold}
    #loginMessage{font-size:13px;color:#555}
    #logoutBtn{margin-left:8px}
  `;
  document.head.appendChild(style);

  const gate = document.createElement("div");
  gate.id = "pharmaLogin";
  gate.innerHTML = `
    <div class="login-card">
      <h2>PharmaDesk</h2>
      <p>Login with your mobile number</p>
      <input id="loginPhone" type="tel" placeholder="03XXXXXXXXX">
      <div id="recaptcha-container"></div>
      <button id="sendOtpBtn">Send OTP</button>
      <div id="otpArea" hidden>
        <input id="loginOtp" inputmode="numeric" maxlength="6" placeholder="Enter 6-digit OTP">
        <button id="verifyOtpBtn">Verify OTP</button>
      </div>
      <p id="loginMessage"></p>
    </div>`;
  document.body.appendChild(gate);

  $("sendOtpBtn").onclick = sendOTP;
  $("verifyOtpBtn").onclick = verifyOTP;
}

async function sendOTP() {
  let phone = $("loginPhone").value.trim().replace(/[\s-]/g,"");
  if (phone.startsWith("03")) phone = "+92" + phone.slice(1);
  else if (phone.startsWith("92")) phone = "+" + phone;

  if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
    $("loginMessage").textContent = "Enter a valid mobile number.";
    return;
  }

  try {
    $("sendOtpBtn").disabled = true;
    $("loginMessage").textContent = "Preparing verification...";

    if (verifier) {
      try { await verifier.clear(); } catch(e) {}
    }

    verifier = new RecaptchaVerifier(auth,"recaptcha-container",{size:"normal"});
    await verifier.render();

    confirmationResult = await signInWithPhoneNumber(auth,phone,verifier);
    $("otpArea").hidden = false;
    $("loginMessage").textContent = "OTP sent. Check your messages.";
  } catch(e) {
    console.error(e);
    $("loginMessage").textContent = e.message || "Could not send OTP.";
    $("sendOtpBtn").disabled = false;
  }
}

async function verifyOTP() {
  const code = $("loginOtp").value.trim();
  if (!/^\d{6}$/.test(code)) {
    $("loginMessage").textContent = "Enter the 6-digit OTP.";
    return;
  }
  try {
    $("verifyOtpBtn").disabled = true;
    await confirmationResult.confirm(code);
    $("loginMessage").textContent = "Login successful.";
  } catch(e) {
    console.error(e);
    $("loginMessage").textContent = "OTP incorrect. Try again.";
    $("verifyOtpBtn").disabled = false;
  }
}

/* CLOUD DATA */

async function loadCloud() {
  const path = `users/${currentUser.uid}/data`;
  const snap = await get(ref(database,path));

  if (snap.exists()) {
    const data = snap.val();
    db = {
      medicines: Array.isArray(data.medicines) ? data.medicines : [],
      sales: Array.isArray(data.sales) ? data.sales : [],
      purchases: Array.isArray(data.purchases) ? data.purchases : []
    };
  } else {
    try {
      const old = JSON.parse(localStorage.getItem(KEY) || "{}");
      db = {
        medicines: old.medicines || old.products || [],
        sales: old.sales || [],
        purchases: old.purchases || []
      };
    } catch(e) {
      db = { medicines: [], sales: [], purchases: [] };
    }
    await set(ref(database,path),db);
  }

  localStorage.setItem(KEY,JSON.stringify(db));
}

function save() {
  if (!currentUser) {
    toast("Please login first.");
    return Promise.reject(new Error("Not logged in"));
  }

  const data = JSON.parse(JSON.stringify(db));
  localStorage.setItem(KEY,JSON.stringify(data));

  saveQueue = saveQueue.then(() =>
    set(ref(database,`users/${currentUser.uid}/data`),data)
  );
  return saveQueue;
}

/* NAVIGATION */

function go(page) {
  const pages = ["dashboard","inventory","billing","purchases","reports"];
  if (!pages.includes(page)) return;

  document.querySelectorAll(".page").forEach(s=>{
    const active = s.id === "page-"+page;
    s.hidden = !active;
    s.classList.toggle("active",active);
  });

  document.querySelectorAll(".nav-link").forEach(b=>
    b.classList.toggle("active",b.dataset.page===page)
  );

  const titles = {
    dashboard:"Dashboard",inventory:"Inventory",
    billing:"Sales & Billing",purchases:"Purchases",reports:"Reports"
  };
  $("pageTitle").textContent = titles[page];
  $("sidebar").classList.remove("open");
  renderAll();
}

function expiryStatus(date) {
  if (!date) return "Unknown";
  const days = Math.ceil((new Date(date+"T00:00:00")-new Date(today()+"T00:00:00"))/86400000);
  if (days < 0) return "Expired";
  if (days <= 90) return "Expiring soon";
  return "Good";
}

/* MEDICINES */

function openMedicine(id="") {
  $("medicineForm").reset();
  $("medicineId").value = id;

  if (id) {
    const m = medicine(id);
    if (!m) return toast("Medicine not found");
    $("medicineModalTitle").textContent = "Edit medicine";
    $("medName").value = m.name;
    $("medCategory").value = m.category;
    $("medBatch").value = m.batch;
    $("medExpiry").value = m.expiry;
    $("medQty").value = m.quantity;
    $("medReorder").value = m.reorderLevel;
    $("medPrice").value = m.salePrice;
    $("medCost").value = m.purchasePrice;
  } else {
    $("medicineModalTitle").textContent = "Add medicine";
    $("medQty").value = 0;
    $("medReorder").value = 10;
    $("medCost").value = 0;
  }
  $("medicineDialog").showModal();
}

async function saveMedicine(e) {
  e.preventDefault();
  const id = $("medicineId").value;
  const data = {
    name:$("medName").value.trim(),
    category:$("medCategory").value.trim(),
    batch:$("medBatch").value.trim(),
    expiry:$("medExpiry").value,
    quantity:Number($("medQty").value),
    reorderLevel:Number($("medReorder").value),
    salePrice:Number($("medPrice").value),
    purchasePrice:Number($("medCost").value)
  };

  if (!data.name || !data.expiry ||
      Object.values(data).some(v=>typeof v==="number" && (!Number.isFinite(v)||v<0))) {
    return toast("Enter valid medicine details.");
  }

  const old = id ? medicine(id) : null;
  if (id && !old) return toast("Medicine not found");

  if (old) Object.assign(old,data);
  else db.medicines.push({id:uid(),...data});

  try {
    await save();
    $("medicineDialog").close();
    renderAll();
    toast(old ? "Medicine updated" : "Medicine added");
  } catch(e) {
    toast("Cloud save failed. Check internet and database rules.");
  }
}

function renderInventory() {
  const search = $("inventorySearch").value.trim().toLowerCase();
  const filter = $("stockFilter").value;

  const list = db.medicines.filter(m=>{
    const text = [m.name,m.category,m.batch].join(" ").toLowerCase();
    let match = text.includes(search);
    if (filter==="low") match = match && m.quantity<=m.reorderLevel;
    if (filter==="expired") match = match && expiryStatus(m.expiry)==="Expired";
    if (filter==="expiring") match = match && expiryStatus(m.expiry)==="Expiring soon";
    return match;
  });

  $("inventoryTable").innerHTML = `
    <table><thead><tr>
    <th>Medicine</th><th>Category</th><th>Batch</th><th>Expiry</th>
    <th>Stock</th><th>Sale Price</th><th>Actions</th>
    </tr></thead><tbody>
    ${list.map(m=>`<tr>
      <td>${esc(m.name)}</td><td>${esc(m.category)}</td>
      <td>${esc(m.batch)}</td><td>${esc(m.expiry)}</td>
      <td>${m.quantity}</td><td>${money(m.salePrice)}</td>
      <td><button data-edit="${esc(m.id)}">Edit</button>
      <button data-delete="${esc(m.id)}">Delete</button></td>
    </tr>`).join("")}
    </tbody></table>${list.length?"":"<p>No medicines found.</p>"}`;
}

/* BILLING */

function addCart(id) {
  const m = medicine(id);
  if (!m || m.quantity<=0) return toast("Out of stock");
  if (expiryStatus(m.expiry)==="Expired") return toast("Expired medicine cannot be sold");

  const item = cart.find(x=>x.productId===id);
  if (item) {
    if (item.quantity>=m.quantity) return toast("Not enough stock");
    item.quantity++;
  } else cart.push({productId:id,quantity:1});
  renderCart();
}

function renderBillProducts() {
  const search = $("billSearch").value.trim().toLowerCase();
  const list = db.medicines.filter(m=>
    m.name.toLowerCase().includes(search) &&
    m.quantity>0 && expiryStatus(m.expiry)!=="Expired"
  );

  $("billProducts").innerHTML = list.map(m=>`
    <button type="button" class="product-card" data-add="${esc(m.id)}">
      <strong>${esc(m.name)}</strong>
      <span>${money(m.salePrice)}</span><small>Stock: ${m.quantity}</small>
    </button>`).join("") || "<p>No medicines available</p>";
}

function renderCart() {
  let total = 0;
  $("cartItems").innerHTML = cart.map(item=>{
    const m = medicine(item.productId);
    if (!m) return "";
    const line = m.salePrice*item.quantity;
    total += line;
    return `<div class="cart-item">
      <span>${esc(m.name)}</span><span>${money(m.salePrice)}</span>
      <button data-minus="${esc(m.id)}">−</button>
      <span>${item.quantity}</span>
      <button data-plus="${esc(m.id)}">+</button>
      <strong>${money(line)}</strong>
      <button data-remove="${esc(m.id)}">Remove</button>
    </div>`;
  }).join("") || "<p>Cart is empty</p>";
  $("billTotal").textContent = money(total);
}

function changeCart(button) {
  const id = button.dataset.minus || button.dataset.plus || button.dataset.remove;
  const item = cart.find(x=>x.productId===id);
  const m = medicine(id);

  if (button.dataset.remove!==undefined) {
    cart = cart.filter(x=>x.productId!==id);
  } else if (item && m) {
    if (button.dataset.minus!==undefined) item.quantity--;
    else if (item.quantity<m.quantity) item.quantity++;
    else toast("Not enough stock");
    if (item.quantity<=0) cart = cart.filter(x=>x.productId!==id);
  }
  renderCart();
}

async function completeSale() {
  if (!cart.length) return toast("Cart is empty");

  for (const item of cart) {
    const m = medicine(item.productId);
    if (!m || m.quantity<item.quantity || expiryStatus(m.expiry)==="Expired")
      return toast("Check medicine stock and expiry.");
  }

  const items = cart.map(item=>{
    const m = medicine(item.productId);
    return {
      productId:m.id,name:m.name,quantity:item.quantity,
      price:m.salePrice,total:m.salePrice*item.quantity
    };
  });

  const sale = {
    id:uid(),date:today(),
    customer:$("customerName").value.trim() || "Walk-in Customer",
    items,
    quantity:items.reduce((s,i)=>s+i.quantity,0),
    total:items.reduce((s,i)=>s+i.total,0)
  };

  items.forEach(i=>medicine(i.productId).quantity-=i.quantity);
  db.sales.unshift(sale);

  try {
    await save();
    cart=[];
    $("customerName").value="";
    renderAll();
    toast("Sale saved successfully");
    printInvoice(sale);
  } catch(e) {
    items.forEach(i=>medicine(i.productId).quantity+=i.quantity);
    db.sales.shift();
    toast("Sale could not be saved. Please try again.");
  }
}

function printInvoice(sale) {
  const w = window.open("","_blank");
  if (!w) return toast("Allow pop-ups to print invoice");

  const rows = sale.items.map(i=>`
    <tr><td>${esc(i.name)}</td><td>${i.quantity}</td>
    <td>${money(i.price)}</td><td>${money(i.total)}</td></tr>`).join("");

  w.document.write(`<!doctype html><html><head><title>Invoice</title>
  <style>body{font-family:Arial;padding:25px}table{width:100%;border-collapse:collapse;margin-top:20px}td,th{border:1px solid #ccc;padding:9px}.total{text-align:right;margin-top:20px}</style>
  </head><body><h2>PharmaDesk Pharmacy</h2><p>Invoice: ${esc(sale.id)}</p>
  <p>Date: ${esc(sale.date)} | Customer: ${esc(sale.customer)}</p>
  <table><thead><tr><th>Medicine</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
  <tbody>${rows}</tbody></table><h3 class="total">Total: ${money(sale.total)}</h3>
  <script>window.onload=()=>window.print();<\/script></body></html>`);
  w.document.close();
}

/* PURCHASES */

function renderPurchaseOptions() {
  const select = $("purchaseMedicine");
  const old = select.value;
  select.innerHTML = '<option value="">Select medicine</option>' +
    db.medicines.map(m=>`<option value="${esc(m.id)}">${esc(m.name)}</option>`).join("");
  if (medicine(old)) select.value=old;
}

async function savePurchase(e) {
  e.preventDefault();
  const m = medicine($("purchaseMedicine").value);
  const qty = Number($("purchaseQty").value);
  const cost = Number($("purchaseCost").value || 0);

  if (!m || !Number.isInteger(qty) || qty<=0 || !Number.isFinite(cost) || cost<0)
    return toast("Enter valid purchase details");

  const oldQty=m.quantity, oldCost=m.purchasePrice;
  m.quantity+=qty;
  if ($("purchaseCost").value!=="") m.purchasePrice=cost;

  const purchase={
    id:uid(),date:today(),productName:m.name,quantity:qty,
    supplier:$("purchaseSupplier").value.trim(),
    unitCost:cost,total:qty*cost
  };
  db.purchases.unshift(purchase);

  try {
    await save();
    $("purchaseForm").reset();
    renderAll();
    toast("Purchase saved");
  } catch(e) {
    m.quantity=oldQty;
    m.purchasePrice=oldCost;
    db.purchases.shift();
    toast("Purchase could not be saved");
  }
}

function renderPurchases() {
  $("purchaseTable").innerHTML=`
  <table><thead><tr><th>Date</th><th>Medicine</th><th>Quantity</th><th>Supplier</th><th>Cost</th><th>Total</th></tr></thead>
  <tbody>${db.purchases.map(p=>`<tr><td>${esc(p.date)}</td><td>${esc(p.productName)}</td><td>${p.quantity}</td><td>${esc(p.supplier)}</td><td>${money(p.unitCost)}</td><td>${money(p.total)}</td></tr>`).join("")}</tbody></table>
  ${db.purchases.length?"":"<p>No purchases yet.</p>"}`;
}

/* DASHBOARD AND REPORTS */

function renderDashboard() {
  const low=db.medicines.filter(m=>m.quantity<=m.reorderLevel);
  const expired=db.medicines.filter(m=>expiryStatus(m.expiry)==="Expired");
  const expiring=db.medicines.filter(m=>expiryStatus(m.expiry)==="Expiring soon");
  const salesToday=db.sales.filter(s=>s.date===today());

  $("statMedicines").textContent=db.medicines.length;
  $("statSales").textContent=money(salesToday.reduce((s,x)=>s+x.total,0));
  $("statSaleCount").textContent=salesToday.length+" transactions";
  $("statLow").textContent=low.length;
  $("statExpiry").textContent=expired.length+expiring.length;

  const alerts=[
    ...low.map(m=>"Low stock: "+m.name),
    ...expired.map(m=>"Expired: "+m.name),
    ...expiring.map(m=>"Expiring soon: "+m.name)
  ];
  $("dashboardAlerts").innerHTML=alerts.length
    ? alerts.map(x=>`<p>${esc(x)}</p>`).join("")
    : "<p>No stock alerts</p>";

  $("recentSales").innerHTML=`
  <table><thead><tr><th>Date</th><th>Customer</th><th>Quantity</th><th>Total</th></tr></thead>
  <tbody>${db.sales.slice(0,5).map(s=>`<tr><td>${esc(s.date)}</td><td>${esc(s.customer)}</td><td>${s.quantity}</td><td>${money(s.total)}</td></tr>`).join("")}</tbody></table>
  ${db.sales.length?"":"<p>No sales yet.</p>"}`;
}

function renderReports() {
  $("reportTotal").textContent=money(db.sales.reduce((s,x)=>s+x.total,0));
  $("reportCount").textContent=db.sales.length;
  $("reportUnits").textContent=db.sales.reduce((s,x)=>s+x.quantity,0);

  $("salesTable").innerHTML=`
  <table><thead><tr><th>Date</th><th>Customer</th><th>Items</th><th>Quantity</th><th>Total</th></tr></thead>
  <tbody>${db.sales.map(s=>`<tr><td>${esc(s.date)}</td><td>${esc(s.customer)}</td><td>${(s.items||[]).map(i=>esc(i.name)).join(", ")}</td><td>${s.quantity}</td><td>${money(s.total)}</td></tr>`).join("")}</tbody></table>
  ${db.sales.length?"":"<p>No sales records.</p>"}`;
}

function renderAll() {
  renderDashboard();
  renderInventory();
  renderBillProducts();
  renderCart();
  renderPurchaseOptions();
  renderPurchases();
  renderReports();
  $("todayLabel").textContent=new Date().toLocaleDateString();
  $("billDate").textContent=today();
}

/* EXPORT */

function download(name,content,type) {
  const blob=new Blob([content],{type});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;a.download=name;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
}

function exportBackup() {
  download("pharmacy-backup.json",JSON.stringify(db,null,2),"application/json");
  toast("Backup downloaded");
}

function exportSales() {
  const rows=[["Date","Customer","Medicine","Quantity","Total"]];
  db.sales.forEach(s=>(s.items||[]).forEach(i=>rows.push([s.date,s.customer,i.name,i.quantity,i.total])));
  const csv=rows.map(r=>r.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(",")).join("\n");
  download("pharmacy-sales.csv","\uFEFF"+csv,"text/csv;charset=utf-8");
  toast("Sales CSV downloaded");
}

/* LOGOUT */

function addLogoutButton() {
  if ($("logoutBtn")) return;
  const actions=document.querySelector(".top-actions");
  if (!actions) return;
  const button=document.createElement("button");
  button.id="logoutBtn";
  button.className="btn btn-light";
  button.textContent="Logout";
  button.onclick=async()=>{
    if(confirm("Are you sure you want to logout?")) await signOut(auth);
  };
  actions.appendChild(button);
}

/* EVENTS */

function setupEvents() {
  document.querySelectorAll("[data-page]").forEach(b=>b.addEventListener("click",()=>go(b.dataset.page)));
  document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>go(b.dataset.go)));

  $("menuBtn").onclick=()=>$("sidebar").classList.toggle("open");
  $("addMedicineBtn").onclick=()=>openMedicine();
  $("closeMedicine").onclick=()=>$("medicineDialog").close();
  $("cancelMedicine").onclick=()=>$("medicineDialog").close();
  $("medicineForm").addEventListener("submit",saveMedicine);

  $("inventorySearch").addEventListener("input",renderInventory);
  $("stockFilter").addEventListener("change",renderInventory);

  $("inventoryTable").addEventListener("click",async e=>{
    const edit=e.target.closest("[data-edit]");
    const del=e.target.closest("[data-delete]");
    if(edit) openMedicine(edit.dataset.edit);
    if(del) {
      const m=medicine(del.dataset.delete);
      if(m && confirm("Delete "+m.name+"?")) {
        const old=db.medicines;
        db.medicines=db.medicines.filter(x=>x.id!==m.id);
        cart=cart.filter(x=>x.productId!==m.id);
        try { await save();renderAll();toast("Medicine deleted"); }
        catch(err) { db.medicines=old;toast("Delete failed"); }
      }
    }
  });

  $("billSearch").addEventListener("input",renderBillProducts);
  $("billProducts").addEventListener("click",e=>{
    const b=e.target.closest("[data-add]");
    if(b) addCart(b.dataset.add);
  });
  $("cartItems").addEventListener("click",e=>{
    const b=e.target.closest("[data-minus],[data-plus],[data-remove]");
    if(b) changeCart(b);
  });
  $("clearCart").onclick=()=>{cart=[];renderCart();toast("Cart cleared");};
  $("completeSale").onclick=completeSale;
  $("purchaseForm").addEventListener("submit",savePurchase);
  $("exportTop").onclick=exportBackup;
  $("exportSales").onclick=exportSales;
}

/* START */

function startApp() {
  loadCloud().then(()=>{
    $("pharmaLogin")?.remove();
    $("sidebar").hidden=false;
    document.querySelector(".main").hidden=false;
    setupEvents();
    addLogoutButton();
    const footer=document.querySelector("footer");
    if(footer) footer.textContent="PharmaDesk · Cloud workspace · Protect customer privacy.";
    const badge=document.querySelector(".local-badge");
    if(badge) badge.textContent="● Synced to cloud";
    renderAll();
    go("dashboard");
  }).catch(error=>{
    console.error(error);
    toast("Could not load cloud data. Check Firebase database rules and internet.");
  });
}

createLoginScreen();
$("sidebar").hidden=true;
document.querySelector(".main").hidden=true;

onAuthStateChanged(auth,async user=>{
  currentUser=user;
  if(user) {
    try {
      await startApp();
    } catch(e) {
      console.error(e);
      toast("App could not start.");
    }
  } else {
    $("sidebar").hidden=true;
    document.querySelector(".main").hidden=true;
    createLoginScreen();
  }
});
