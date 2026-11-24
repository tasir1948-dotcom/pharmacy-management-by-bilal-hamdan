import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

import {
  getDatabase,
  ref,
  get,
  set
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

/* ================= APP STATE ================= */

const $ = id => document.getElementById(id);
const KEY = "pharmacy_management_data";

let currentUser = null;
let eventsReady = false;
let saveQueue = Promise.resolve();

let db = {
  medicines: [],
  sales: [],
  purchases: []
};

let cart = [];
let currentPage = "dashboard";

function normalizeData(data) {
  return {
    medicines: Array.isArray(data?.medicines) ? data.medicines : [],
    sales: Array.isArray(data?.sales) ? data.sales : [],
    purchases: Array.isArray(data?.purchases) ? data.purchases : []
  };
}

function money(value) {
  return "Rs " + Number(value || 0).toLocaleString("en-PK", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* ================= TOAST ================= */

let toastTimer;

function toast(message) {
  const el = $("toast");
  if (!el) return;

  el.textContent = message;
  el.classList.add("show");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3000);
}

/* ================= EMAIL LOGIN ================= */

function createLogin() {
  if ($("loginOverlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "loginOverlay";

  overlay.innerHTML = `
    <div class="login-card">
      <div class="login-logo">✚</div>
      <h2>PharmaDesk</h2>
      <p>Secure pharmacy management login</p>

      <label>Email address</label>
      <input id="loginEmail" type="email"
        placeholder="Enter your email"
        autocomplete="email">

      <label>Password</label>
      <input id="loginPassword" type="password"
        placeholder="Enter your password"
        autocomplete="current-password">

      <button id="loginBtn" type="button">Login</button>
      <button id="registerBtn" type="button">Create Account</button>

      <p id="loginMessage"></p>
    </div>
  `;

  const style = document.createElement("style");
  style.id = "loginStyles";
  style.textContent = `
    #loginOverlay {
      position:fixed;
      inset:0;
      z-index:99999;
      background:#f2f6f5;
      display:flex;
      align-items:center;
      justify-content:center;
      padding:18px;
      font-family:Arial,sans-serif;
    }

    .login-card {
      width:100%;
      max-width:390px;
      background:white;
      padding:30px 24px;
      border-radius:18px;
      box-shadow:0 12px 45px rgba(0,0,0,.10);
      text-align:center;
    }

    .login-logo {
      width:55px;
      height:55px;
      margin:auto auto 12px;
      display:grid;
      place-items:center;
      border-radius:15px;
      background:#123b35;
      color:white;
      font-size:30px;
    }

    .login-card h2 {
      margin:8px 0;
      color:#123b35;
    }

    .login-card p {
      color:#687b77;
      font-size:13px;
    }

    .login-card label {
      display:block;
      text-align:left;
      margin:18px 0 7px;
      font-size:13px;
      font-weight:bold;
    }

    .login-card input {
      width:100%;
      box-sizing:border-box;
      padding:13px;
      border:1px solid #d8e2df;
      border-radius:9px;
      font-size:16px;
    }

    .login-card button {
      width:100%;
      padding:13px;
      margin-top:14px;
      border:0;
      border-radius:9px;
      background:#123b35;
      color:white;
      font-weight:bold;
      font-size:15px;
      cursor:pointer;
    }

    .login-card button:disabled {
      opacity:.6;
    }

    #registerBtn {
      background:#e9f0ee;
      color:#123b35;
    }

    #loginMessage {
      min-height:18px;
      margin-top:15px;
    }
  `;

  document.head.appendChild(style);
  document.body.appendChild(overlay);

  $("loginBtn").addEventListener("click", loginUser);
  $("registerBtn").addEventListener("click", registerUser);
}

async function loginUser() {
  const email = $("loginEmail").value.trim();
  const password = $("loginPassword").value;
  const button = $("loginBtn");
  const message = $("loginMessage");

  if (!email || !password) {
    message.textContent = "Enter email and password.";
    return;
  }

  button.disabled = true;
  button.textContent = "Logging in...";

  try {
    await signInWithEmailAndPassword(auth, email, password);
    message.textContent = "Login successful.";
  } catch (error) {
    console.error("Login error:", error);
    message.textContent = error.message;
    button.disabled = false;
    button.textContent = "Login";
  }
}

async function registerUser() {
  const email = $("loginEmail").value.trim();
  const password = $("loginPassword").value;
  const button = $("registerBtn");
  const message = $("loginMessage");

  if (!email || !password) {
    message.textContent = "Enter email and password.";
    return;
  }

  if (password.length < 6) {
    message.textContent = "Password must be at least 6 characters.";
    return;
  }

  button.disabled = true;
  button.textContent = "Creating account...";

  try {
    await createUserWithEmailAndPassword(auth, email, password);
    message.textContent = "Account created successfully.";
  } catch (error) {
    console.error("Registration error:", error);
    message.textContent = error.message;
    button.disabled = false;
    button.textContent = "Create Account";
  }
}

/* ================= CLOUD DATABASE ================= */

function cloudPath() {
  if (!currentUser) throw new Error("User is not logged in.");
  return `users/${currentUser.uid}/data`;
}

async function loadCloud() {
  const snapshot = await get(ref(database, cloudPath()));

  if (snapshot.exists()) {
    db = normalizeData(snapshot.val());
    localStorage.setItem(KEY, JSON.stringify(db));
    return;
  }

  const local = localStorage.getItem(KEY);

  if (local) {
    try {
      const localData = normalizeData(JSON.parse(local));

      const hasLocalData =
        localData.medicines.length ||
        localData.sales.length ||
        localData.purchases.length;

      db = localData;

      if (hasLocalData) {
        await set(ref(database, cloudPath()), db);
      }
    } catch (error) {
      console.error("Local data read error:", error);
      db = normalizeData({});
    }
  } else {
    db = normalizeData({});
  }

  localStorage.setItem(KEY, JSON.stringify(db));
}

function saveData() {
  localStorage.setItem(KEY, JSON.stringify(db));

  if (!currentUser) return Promise.resolve();

  const dataCopy = JSON.parse(JSON.stringify(db));
  const path = cloudPath();

  saveQueue = saveQueue
    .catch(error => console.error("Previous save error:", error))
    .then(() => set(ref(database, path), dataCopy))
    .catch(error => {
      console.error("Cloud save error:", error);
      toast("Cloud save failed. Check your internet or database rules.");
    });

  return saveQueue;
}

/* ================= DATE HELPERS ================= */

function daysUntil(dateString) {
  if (!dateString) return Infinity;

  const expiry = new Date(dateString + "T00:00:00");
  const now = new Date(today() + "T00:00:00");

  return Math.ceil((expiry - now) / 86400000);
}

function isExpired(medicine) {
  return daysUntil(medicine.expiry) < 0;
}

function isExpiring(medicine) {
  const days = daysUntil(medicine.expiry);
  return days >= 0 && days <= 90;
}

function isLow(medicine) {
  return Number(medicine.qty) <= Number(medicine.reorder);
}

/* ================= NAVIGATION ================= */

function go(page) {
  const target = $(`page-${page}`);
  if (!target) return;

  document.querySelectorAll(".page").forEach(el => {
    el.classList.remove("active");
  });

  target.classList.add("active");

  document.querySelectorAll(".nav-link").forEach(el => {
    el.classList.toggle("active", el.dataset.page === page);
  });

  currentPage = page;

  const titles = {
    dashboard: "Dashboard",
    inventory: "Inventory",
    billing: "Sales & Billing",
    purchases: "Purchases",
    reports: "Reports"
  };

  if ($("pageTitle")) $("pageTitle").textContent = titles[page] || page;
  if ($("sidebar")) $("sidebar").classList.remove("open");

  renderAll();
}

/* ================= DASHBOARD ================= */

function renderDashboard() {
  const medicines = db.medicines;
  const sales = db.sales.filter(sale => sale.date === today());

  const low = medicines.filter(isLow);
  const expiring = medicines.filter(isExpiring);

  if ($("statMedicines")) $("statMedicines").textContent = medicines.length;

  if ($("statSales")) {
    $("statSales").textContent = money(
      sales.reduce((sum, sale) => sum + Number(sale.total || 0), 0)
    );
  }

  if ($("statSaleCount")) {
    $("statSaleCount").textContent = `${sales.length} transactions`;
  }

  if ($("statLow")) $("statLow").textContent = low.length;
  if ($("statExpiry")) $("statExpiry").textContent = expiring.length;

  const alerts = medicines.filter(m =>
    isLow(m) || isExpired(m) || isExpiring(m)
  );

  if ($("dashboardAlerts")) {
    $("dashboardAlerts").innerHTML = alerts.length
      ? `<table><thead><tr><th>Medicine</th><th>Stock</th><th>Status</th></tr></thead><tbody>
        ${alerts.slice(0, 8).map(m => `
          <tr>
            <td>${escapeHTML(m.name)}</td>
            <td>${Number(m.qty)}</td>
            <td>${isExpired(m) ? "Expired" : isLow(m) ? "Low stock" : "Expiring soon"}</td>
          </tr>`).join("")}
        </tbody></table>`
      : `<p class="empty-state">No stock alerts.</p>`;
  }

  if ($("recentSales")) {
    const recent = [...db.sales].reverse().slice(0, 5);

    $("recentSales").innerHTML = recent.length
      ? `<table><thead><tr><th>Date</th><th>Customer</th><th>Total</th></tr></thead><tbody>
        ${recent.map(s => `
          <tr>
            <td>${escapeHTML(s.date)}</td>
            <td>${escapeHTML(s.customer || "Walk-in")}</td>
            <td>${money(s.total)}</td>
          </tr>`).join("")}
        </tbody></table>`
      : `<p class="empty-state">No sales recorded yet.</p>`;
  }
}

/* ================= INVENTORY ================= */

function renderInventory() {
  const search = ($("inventorySearch")?.value || "").toLowerCase();
  const filter = $("stockFilter")?.value || "all";

  let items = [...db.medicines];

  if (search) {
    items = items.filter(m =>
      [m.name, m.category, m.batch].join(" ").toLowerCase().includes(search)
    );
  }

  if (filter === "low") items = items.filter(isLow);
  if (filter === "expired") items = items.filter(isExpired);
  if (filter === "expiring") items = items.filter(isExpiring);

  const target = $("inventoryTable");
  if (!target) return;

  target.innerHTML = items.length
    ? `<table>
      <thead><tr>
        <th>Medicine</th><th>Batch</th><th>Expiry</th>
        <th>Stock</th><th>Sale price</th><th>Actions</th>
      </tr></thead><tbody>
      ${items.map(m => `
        <tr>
          <td><b>${escapeHTML(m.name)}</b><small>${escapeHTML(m.category || "")}</small></td>
          <td>${escapeHTML(m.batch || "-")}</td>
          <td>${escapeHTML(m.expiry || "-")}</td>
          <td>${Number(m.qty)}</td>
          <td>${money(m.price)}</td>
          <td>
            <button class="text-btn" data-edit="${escapeHTML(m.id)}">Edit</button>
            <button class="text-btn" data-delete="${escapeHTML(m.id)}">Delete</button>
          </td>
        </tr>`).join("")}
      </tbody></table>`
    : `<p class="empty-state">No medicines found. Add a medicine to get started.</p>`;

  renderPurchaseOptions();
}

/* ================= MEDICINE FORM ================= */

function openMedicine(id = "") {
  const form = $("medicineForm");
  if (!form) return;

  form.reset();

  const medicine = db.medicines.find(m => m.id === id);

  $("medicineId").value = medicine?.id || "";
  $("medicineModalTitle").textContent = medicine ? "Edit medicine" : "Add medicine";

  $("medName").value = medicine?.name || "";
  $("medCategory").value = medicine?.category || "";
  $("medBatch").value = medicine?.batch || "";
  $("medExpiry").value = medicine?.expiry || "";
  $("medQty").value = medicine?.qty ?? 0;
  $("medReorder").value = medicine?.reorder ?? 10;
  $("medPrice").value = medicine?.price ?? "";
  $("medCost").value = medicine?.cost ?? 0;

  $("medicineDialog").showModal();
}

function closeMedicine() {
  if ($("medicineDialog")?.open) $("medicineDialog").close();
}

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
  const target = $("billProducts");
  if (!target) return;

  const query = ($("billSearch")?.value || "").toLowerCase();

  const items = db.medicines.filter(m =>
    Number(m.qty) > 0 &&
    !isExpired(m) &&
    m.name.toLowerCase().includes(query)
  );

  target.innerHTML = items.length
    ? items.map(m => `
      <div class="product-item">
        <div>
          <b>${escapeHTML(m.name)}</b>
          <small>${Number(m.qty)} available · ${money(m.price)}</small>
        </div>
        <button class="btn btn-light" data-add-cart="${escapeHTML(m.id)}">Add</button>
      </div>`).join("")
    : `<p class="empty-state">No available medicines found.</p>`;
}

function addToCart(id) {
  const medicine = db.medicines.find(m => m.id === id);

  if (!medicine || Number(medicine.qty) <= 0 || isExpired(medicine)) {
    toast("Medicine is unavailable.");
    return;
  }

  const existing = cart.find(item => item.id === id);

  if (existing) {
    if (existing.qty >= Number(medicine.qty)) {
      toast("Not enough stock.");
      return;
    }

    existing.qty++;
  } else {
    cart.push({
      id: medicine.id,
      name: medicine.name,
      price: Number(medicine.price),
      qty: 1
    });
  }

  renderCart();
}

function renderCart() {
  const target = $("cartItems");
  if (!target) return;

  target.innerHTML = cart.length
    ? cart.map(item => `
      <div class="cart-item">
        <div>
          <b>${escapeHTML(item.name)}</b>
          <small>${money(item.price)} each</small>
        </div>
        <div>
          <button data-cart-minus="${escapeHTML(item.id)}">−</button>
          <span>${item.qty}</span>
          <button data-cart-plus="${escapeHTML(item.id)}">+</button>
          <button data-cart-remove="${escapeHTML(item.id)}">×</button>
        </div>
      </div>`).join("")
    : `<p class="empty-state">Your bill is empty.</p>`;

  const total = cart.reduce((sum, item) =>
    sum + item.price * item.qty, 0
  );

  if ($("billTotal")) $("billTotal").textContent = money(total);
}

function changeCartQty(id, amount) {
  const item = cart.find(i => i.id === id);
  const medicine = db.medicines.find(m => m.id === id);

  if (!item || !medicine) return;

  const next = item.qty + amount;

  if (next <= 0) {
    cart = cart.filter(i => i.id !== id);
  } else if (next > Number(medicine.qty)) {
    toast("Not enough stock.");
    return;
  } else {
    item.qty = next;
  }

  renderCart();
}

async function completeSale() {
  if (!cart.length) {
    toast("Please add items to the bill.");
    return;
  }

  for (const item of cart) {
    const medicine = db.medicines.find(m => m.id === item.id);

    if (!medicine || Number(medicine.qty) < item.qty || isExpired(medicine)) {
      toast(`Stock problem: ${item.name}`);
      return;
    }
  }

  const items = cart.map(item => ({
    ...item,
    subtotal: item.price * item.qty
  }));

  const total = items.reduce((sum, item) =>
    sum + item.subtotal, 0
  );

  for (const item of cart) {
    const medicine = db.medicines.find(m => m.id === item.id);
    medicine.qty = Number(medicine.qty) - item.qty;
  }

  db.sales.push({
    id: makeId(),
    date: today(),
    customer: $("customerName")?.value.trim() || "Walk-in",
    items,
    total
  });

  cart = [];

  if ($("customerName")) $("customerName").value = "";

  await saveData();
  renderAll();
  toast("Sale completed successfully.");
}

/* ================= PURCHASES ================= */

function renderPurchaseOptions() {
  const select = $("purchaseMedicine");
  if (!select) return;

  const previous = select.value;

  select.innerHTML = `<option value="">Select medicine</option>` +
    db.medicines.map(m => `
      <option value="${escapeHTML(m.id)}">${escapeHTML(m.name)}</option>
    `).join("");

  if (db.medicines.some(m => m.id === previous)) {
    select.value = previous;
  }
}

async function savePurchase(event) {
  event.preventDefault();

  const id = $("purchaseMedicine").value;
  const quantity = Number($("purchaseQty").value);

  const medicine = db.medicines.find(m => m.id === id);

  if (!medicine) {
    toast("Please select a medicine.");
    return;
  }

  if (!Number.isInteger(quantity) || quantity <= 0) {
    toast("Enter a valid quantity.");
    return;
  }

  const cost = Number($("purchaseCost").value || medicine.cost || 0);

  medicine.qty = Number(medicine.qty) + quantity;

  if ($("purchaseCost").value !== "") {
    medicine.cost = cost;
  }

  db.purchases.push({
    id: makeId(),
    medicineId: id,
    medicineName: medicine.name,
    quantity,
    supplier: $("purchaseSupplier").value.trim(),
    cost,
    total: cost * quantity,
    date: today()
  });

  $("purchaseForm").reset();

  await saveData();
  renderAll();
  toast("Purchase saved and stock updated.");
}

function renderPurchases() {
  const target = $("purchaseTable");
  if (!target) return;

  const purchases = [...db.purchases].reverse();

  target.innerHTML = purchases.length
    ? `<table><thead><tr>
      <th>Date</th><th>Medicine</th><th>Quantity</th>
      <th>Supplier</th><th>Total cost</th>
    </tr></thead><tbody>
      ${purchases.map(p => `
        <tr>
          <td>${escapeHTML(p.date)}</td>
          <td>${escapeHTML(p.medicineName)}</td>
          <td>${Number(p.quantity)}</td>
          <td>${escapeHTML(p.supplier || "-")}</td>
          <td>${money(p.total)}</td>
        </tr>`).join("")}
    </tbody></table>`
    : `<p class="empty-state">No purchases recorded yet.</p>`;
}

/* ================= REPORTS ================= */

function renderReports() {
  const sales = db.sales;

  const total = sales.reduce((sum, sale) =>
    sum + Number(sale.total || 0), 0
  );

  const units = sales.reduce((sum, sale) =>
    sum + (sale.items || []).reduce((n, item) =>
      n + Number(item.qty || 0), 0
    ), 0
  );

  if ($("reportTotal")) $("reportTotal").textContent = money(total);
  if ($("reportCount")) $("reportCount").textContent = sales.length;
  if ($("reportUnits")) $("reportUnits").textContent = units;

  const target = $("salesTable");
  if (!target) return;

  target.innerHTML = sales.length
    ? `<table><thead><tr>
      <th>Date</th><th>Customer</th><th>Items</th><th>Total</th>
    </tr></thead><tbody>
      ${[...sales].reverse().map(s => `
        <tr>
          <td>${escapeHTML(s.date)}</td>
          <td>${escapeHTML(s.customer || "Walk-in")}</td>
          <td>${(s.items || []).reduce((n, i) =>
            n + Number(i.qty || 0), 0
          )}</td>
          <td>${money(s.total)}</td>
        </tr>`).join("")}
    </tbody></table>`
    : `<p class="empty-state">No sales recorded yet.</p>`;
}

/* ================= EXPORT ================= */

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

function exportData() {
  downloadFile(
    JSON.stringify(db, null, 2),
    "pharmadesk-backup.json",
    "application/json"
  );

  toast("Data backup downloaded.");
}

function exportSales() {
  const rows = [["Date", "Customer", "Items", "Total"]];

  db.sales.forEach(s => {
    rows.push([
      s.date,
      s.customer || "Walk-in",
      (s.items || []).reduce((n, i) =>
        n + Number(i.qty || 0), 0
      ),
      s.total
    ]);
  });

  const csv = rows.map(row =>
    row.map(value =>
      `"${String(value ?? "").replace(/"/g, '""')}"`
    ).join(",")
  ).join("\n");

  downloadFile(
    csv,
    "pharmadesk-sales.csv",
    "text/csv;charset=utf-8"
  );

  toast("Sales CSV downloaded.");
}

/* ================= EVENT SETUP ================= */

function setupEvents() {
  if (eventsReady) return;
  eventsReady = true;

  document.querySelectorAll("[data-page]").forEach(button => {
    button.addEventListener("click", () =>
      go(button.dataset.page)
    );
  });

  document.querySelectorAll("[data-go]").forEach(button => {
    button.addEventListener("click", () =>
      go(button.dataset.go)
    );
  });

  $("menuBtn")?.addEventListener("click", () => {
    $("sidebar")?.classList.toggle("open");
  });

  $("addMedicineBtn")?.addEventListener("click", () =>
    openMedicine()
  );

  $("closeMedicine")?.addEventListener("click", closeMedicine);
  $("cancelMedicine")?.addEventListener("click", closeMedicine);

  $("medicineForm")?.addEventListener("submit", saveMedicine);

  $("inventorySearch")?.addEventListener("input", renderInventory);
  $("stockFilter")?.addEventListener("change", renderInventory);

  $("inventoryTable")?.addEventListener("click", async event => {
    const editButton = event.target.closest("[data-edit]");
    const deleteButton = event.target.closest("[data-delete]");

    if (editButton) {
      openMedicine(editButton.dataset.edit);
    }

    if (deleteButton) {
      const id = deleteButton.dataset.delete;
      const medicine = db.medicines.find(m => m.id === id);

      if (!medicine) return;

      if (!confirm(`Delete ${medicine.name}?`)) return;

      db.medicines = db.medicines.filter(m => m.id !== id);
      cart = cart.filter(item => item.id !== id);

      await saveData();
      renderAll();
      toast("Medicine deleted.");
    }
  });

  $("billSearch")?.addEventListener("input", renderBillProducts);

  $("billProducts")?.addEventListener("click", event => {
    const button = event.target.closest("[data-add-cart]");
    if (button) addToCart(button.dataset.addCart);
  });

  $("cartItems")?.addEventListener("click", event => {
    const plus = event.target.closest("[data-cart-plus]");
    const minus = event.target.closest("[data-cart-minus]");
    const remove = event.target.closest("[data-cart-remove]");

    if (plus) changeCartQty(plus.dataset.cartPlus, 1);
    if (minus) changeCartQty(minus.dataset.cartMinus, -1);

    if (remove) {
      cart = cart.filter(item =>
        item.id !== remove.dataset.cartRemove
      );
      renderCart();
    }
  });

  $("clearCart")?.addEventListener("click", () => {
    cart = [];
    renderCart();
  });

  $("completeSale")?.addEventListener("click", completeSale);
  $("purchaseForm")?.addEventListener("submit", savePurchase);

  $("exportTop")?.addEventListener("click", exportData);
  $("exportSales")?.addEventListener("click", exportSales);

  if ($("todayLabel")) {
    $("todayLabel").textContent = new Date().toLocaleDateString("en-PK", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  }

  if ($("billDate")) {
    $("billDate").textContent = new Date().toLocaleDateString("en-PK");
  }
}

/* ================= LOGOUT BUTTON ================= */

function addLogoutButton() {
  const actions = document.querySelector(".top-actions");

  if (!actions || $("logoutBtn")) return;

  const button = document.createElement("button");
  button.id = "logoutBtn";
  button.className = "btn btn-light";
  button.textContent = "Logout";

  button.addEventListener("click", async () => {
    if (!confirm("Are you sure you want to logout?")) return;

    try {
      await signOut(auth);
    } catch (error) {
      console.error(error);
      toast("Logout failed.");
    }
  });

  actions.appendChild(button);
}

/* ================= RENDER ALL ================= */

function renderAll() {
  renderDashboard();
  renderInventory();
  renderBillProducts();
  renderCart();
  renderPurchaseOptions();
  renderPurchases();
  renderReports();
}

/* ================= APP START ================= */

async function startApp(user) {
  currentUser = user;

  try {
    await loadCloud();

    setupEvents();
    addLogoutButton();
    renderAll();

    const overlay = $("loginOverlay");
    if (overlay) overlay.remove();

    toast("PharmaDesk ready.");
  } catch (error) {
    console.error("App startup error:", error);
    toast("Could not load cloud data. Check Firebase database rules and internet.");
  }
}

/* ================= AUTH LISTENER ================= */

createLogin();

onAuthStateChanged(auth, async user => {
  if (user) {
    await startApp(user);
  } else {
    currentUser = null;
    cart = [];

    if (!$("loginOverlay")) {
      createLogin();
    }
  }
});
