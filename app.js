
/* =====================================================
   PHARMADESK - COMPLETE PHARMACY MANAGEMENT SOFTWARE
   Compatible with the supplied index.html
===================================================== */

"use strict";

const KEY = "pharmacy_management_data";

let db = {
  medicines: [],
  sales: [],
  purchases: []
};

let cart = [];

const $ = id => document.getElementById(id);

const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

function today() {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0")
  ].join("-");
}

function money(value) {
  return "Rs " + Number(value || 0).toLocaleString("en-PK", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

/* NOTIFICATIONS */

function toast(message) {
  const box = $("toast");

  if (!box) {
    alert(message);
    return;
  }

  box.textContent = message;
  box.classList.add("show");

  clearTimeout(toast.timer);

  toast.timer = setTimeout(() => {
    box.classList.remove("show");
  }, 3000);
}

/* DATA STORAGE */

function load() {
  try {
    const saved = localStorage.getItem(KEY);

    if (!saved) return;

    const old = JSON.parse(saved);

    db.medicines = old.medicines || old.products || [];
    db.sales = old.sales || [];
    db.purchases = old.purchases || [];

    db.medicines = db.medicines.map(m => ({
      id: String(m.id || uid()),
      name: m.name || "",
      category: m.category || "",
      batch: m.batch || "",
      expiry: m.expiry || "",
      quantity: Number(m.quantity || 0),
      reorderLevel: Number(m.reorderLevel ?? 10),
      salePrice: Number(m.salePrice ?? m.price ?? 0),
      purchasePrice: Number(m.purchasePrice ?? m.cost ?? 0)
    }));

    db.sales = db.sales.map(s => ({
      ...s,
      id: String(s.id || uid()),
      date: s.date || today(),
      customer: s.customer || "Walk-in Customer",
      items: Array.isArray(s.items) ? s.items : [],
      quantity: Number(s.quantity || 0),
      total: Number(s.total || 0)
    }));

    db.purchases = db.purchases.map(p => ({
      ...p,
      id: String(p.id || uid()),
      quantity: Number(p.quantity || 0),
      unitCost: Number(p.unitCost || 0),
      total: Number(p.total || 0)
    }));

  } catch (error) {
    console.error("Loading error:", error);
    toast("Unable to load saved data");
  }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
    return true;
  } catch (error) {
    console.error("Saving error:", error);
    toast("Storage full or unavailable. Data was not saved.");
    return false;
  }
}

function medicine(id) {
  return db.medicines.find(m => String(m.id) === String(id));
}

/* NAVIGATION */

function go(page) {
  const validPages = [
    "dashboard",
    "inventory",
    "billing",
    "purchases",
    "reports"
  ];

  if (!validPages.includes(page)) return;

  document.querySelectorAll(".page").forEach(section => {
    const active = section.id === "page-" + page;
    section.hidden = !active;
    section.classList.toggle("active", active);
  });

  document.querySelectorAll(".nav-link").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.page === page
    );
  });

  const titles = {
    dashboard: "Dashboard",
    inventory: "Inventory",
    billing: "Sales & Billing",
    purchases: "Purchases",
    reports: "Reports"
  };

  $("pageTitle").textContent = titles[page];
  $("sidebar").classList.remove("open");

  renderAll();
}

/* DATE AND EXPIRY */

function expiryStatus(date) {
  if (!date) return "Unknown";

  const days = Math.ceil(
    (new Date(date + "T00:00:00") -
     new Date(today() + "T00:00:00")) / 86400000
  );

  if (days < 0) return "Expired";
  if (days <= 90) return "Expiring soon";

  return "Good";
}

/* MEDICINE MANAGEMENT */

function openMedicine(id = "") {
  $("medicineForm").reset();
  $("medicineId").value = id;

  if (id) {
    const m = medicine(id);

    if (!m) {
      toast("Medicine not found");
      return;
    }

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

function saveMedicine(event) {
  event.preventDefault();

  const id = $("medicineId").value;

  const data = {
    name: $("medName").value.trim(),
    category: $("medCategory").value.trim(),
    batch: $("medBatch").value.trim(),
    expiry: $("medExpiry").value,
    quantity: Number($("medQty").value),
    reorderLevel: Number($("medReorder").value),
    salePrice: Number($("medPrice").value),
    purchasePrice: Number($("medCost").value)
  };

  if (!data.name || !data.expiry) {
    toast("Please enter medicine name and expiry");
    return;
  }

  if (Object.values(data).some(v =>
    typeof v === "number" && (!Number.isFinite(v) || v < 0)
  )) {
    toast("Please enter valid numbers");
    return;
  }

  if (id) {
    const existing = medicine(id);

    if (!existing) return;

    Object.assign(existing, data);
    toast("Medicine updated successfully");

  } else {
    db.medicines.push({
      id: uid(),
      ...data
    });

    toast("Medicine added successfully");
  }

  save();
  $("medicineDialog").close();
  renderAll();
}

/* INVENTORY */

function renderInventory() {
  const box = $("inventoryTable");
  const search = $("inventorySearch").value.trim().toLowerCase();
  const filter = $("stockFilter").value;

  const list = db.medicines.filter(m => {
    const text = [
      m.name,
      m.category,
      m.batch
    ].join(" ").toLowerCase();

    const matchesSearch = text.includes(search);

    let matchesFilter = true;

    if (filter === "low") {
      matchesFilter = m.quantity <= m.reorderLevel;
    }

    if (filter === "expired") {
      matchesFilter = expiryStatus(m.expiry) === "Expired";
    }

    if (filter === "expiring") {
      matchesFilter = expiryStatus(m.expiry) === "Expiring soon";
    }

    return matchesSearch && matchesFilter;
  });

  box.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Medicine</th>
          <th>Category</th>
          <th>Batch</th>
          <th>Expiry</th>
          <th>Stock</th>
          <th>Sale Price</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${list.map(m => `
          <tr>
            <td>${esc(m.name)}</td>
            <td>${esc(m.category)}</td>
            <td>${esc(m.batch)}</td>
            <td>${esc(m.expiry)}</td>
            <td>${m.quantity}</td>
            <td>${money(m.salePrice)}</td>
            <td>
              <button type="button" data-edit="${esc(m.id)}">Edit</button>
              <button type="button" data-delete="${esc(m.id)}">Delete</button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
    ${list.length ? "" : "<p>No medicines found.</p>"}
  `;
}

/* BILLING AND CART */

function addCart(id) {
  const m = medicine(id);

  if (!m || m.quantity <= 0) {
    toast("Medicine is out of stock");
    return;
  }

  if (expiryStatus(m.expiry) === "Expired") {
    toast("Expired medicine cannot be sold");
    return;
  }

  let item = cart.find(x => x.productId === id);

  if (item) {
    if (item.quantity >= m.quantity) {
      toast("Not enough stock");
      return;
    }

    item.quantity++;

  } else {
    cart.push({
      productId: id,
      quantity: 1
    });
  }

  renderCart();
}

function renderBillProducts() {
  const box = $("billProducts");
  const search = $("billSearch").value.trim().toLowerCase();

  const list = db.medicines.filter(m =>
    m.name.toLowerCase().includes(search) &&
    m.quantity > 0 &&
    expiryStatus(m.expiry) !== "Expired"
  );

  box.innerHTML = list.map(m => `
    <button type="button" class="product-card" data-add="${esc(m.id)}">
      <strong>${esc(m.name)}</strong>
      <span>${money(m.salePrice)}</span>
      <small>Stock: ${m.quantity}</small>
    </button>
  `).join("") || "<p>No medicines available</p>";
}

function renderCart() {
  const box = $("cartItems");

  let total = 0;

  box.innerHTML = cart.map(item => {
    const m = medicine(item.productId);

    if (!m) return "";

    const line = m.salePrice * item.quantity;
    total += line;

    return `
      <div class="cart-item">
        <span>${esc(m.name)}</span>
        <span>${money(m.salePrice)}</span>
        <button type="button" data-minus="${esc(m.id)}">−</button>
        <span>${item.quantity}</span>
        <button type="button" data-plus="${esc(m.id)}">+</button>
        <strong>${money(line)}</strong>
        <button type="button" data-remove="${esc(m.id)}">Remove</button>
      </div>
    `;
  }).join("") || "<p>Cart is empty</p>";

  $("billTotal").textContent = money(total);
}

function changeCart(button) {
  const id =
    button.dataset.minus ||
    button.dataset.plus ||
    button.dataset.remove;

  const item = cart.find(x => x.productId === id);
  const m = medicine(id);

  if (button.dataset.remove !== undefined) {
    cart = cart.filter(x => x.productId !== id);
  } else if (item && m) {
    if (button.dataset.minus !== undefined) {
      item.quantity--;
    } else {
      if (item.quantity < m.quantity) {
        item.quantity++;
      } else {
        toast("Not enough stock");
      }
    }

    if (item.quantity <= 0) {
      cart = cart.filter(x => x.productId !== id);
    }
  }

  renderCart();
}

/* COMPLETE SALE */

function completeSale() {
  if (!cart.length) {
    toast("Cart is empty");
    return;
  }

  for (const item of cart) {
    const m = medicine(item.productId);

    if (!m || m.quantity < item.quantity ||
        expiryStatus(m.expiry) === "Expired") {
      toast("Please check stock and expiry");
      return;
    }
  }

  const items = cart.map(item => {
    const m = medicine(item.productId);

    return {
      productId: m.id,
      name: m.name,
      quantity: item.quantity,
      price: m.salePrice,
      total: m.salePrice * item.quantity
    };
  });

  const sale = {
    id: uid(),
    date: today(),
    customer: $("customerName").value.trim() || "Walk-in Customer",
    items,
    quantity: items.reduce((sum, item) => sum + item.quantity, 0),
    total: items.reduce((sum, item) => sum + item.total, 0)
  };

  items.forEach(item => {
    medicine(item.productId).quantity -= item.quantity;
  });

  db.sales.unshift(sale);

  if (!save()) {
    // Restore stock if storage fails.
    items.forEach(item => {
      medicine(item.productId).quantity += item.quantity;
    });

    db.sales.shift();
    return;
  }

  cart = [];

  $("customerName").value = "";

  renderAll();

  toast("Sale completed successfully");

  printInvoice(sale);
}

/* PRINT INVOICE */

function printInvoice(sale) {
  const w = window.open("", "_blank");

  if (!w) {
    toast("Please allow pop-ups to print invoice");
    return;
  }

  const rows = sale.items.map(item => `
    <tr>
      <td>${esc(item.name)}</td>
      <td>${item.quantity}</td>
      <td>${money(item.price)}</td>
      <td>${money(item.total)}</td>
    </tr>
  `).join("");

  w.document.write(`
    <!doctype html>
    <html>
    <head>
      <title>PharmaDesk Invoice</title>
      <style>
        body {font-family:Arial;padding:25px;color:#222}
        h2,p{text-align:center}
        table{width:100%;border-collapse:collapse;margin-top:25px}
        td,th{border:1px solid #ccc;padding:10px;text-align:left}
        .total{text-align:right;margin-top:20px;font-size:20px}
      </style>
    </head>
    <body>
      <h2>PharmaDesk Pharmacy</h2>
      <p>Sales Invoice</p>
      <p>Invoice: ${esc(sale.id)}</p>
      <p>Date: ${esc(sale.date)}</p>
      <p>Customer: ${esc(sale.customer)}</p>
      <table>
        <thead>
          <tr>
            <th>Medicine</th>
            <th>Qty</th>
            <th>Price</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="total">
        <strong>Total: ${money(sale.total)}</strong>
      </div>
      <p>Thank you for your visit!</p>
      <script>
        window.onload = () => window.print();
      <\/script>
    </body>
    </html>
  `);

  w.document.close();
}

/* PURCHASES */

function renderPurchaseOptions() {
  const select = $("purchaseMedicine");
  const old = select.value;

  select.innerHTML =
    '<option value="">Select medicine</option>' +
    db.medicines.map(m => `
      <option value="${esc(m.id)}">${esc(m.name)}</option>
    `).join("");

  if (medicine(old)) {
    select.value = old;
  }
}

function savePurchase(event) {
  event.preventDefault();

  const m = medicine($("purchaseMedicine").value);
  const qty = Number($("purchaseQty").value);
  const cost = Number($("purchaseCost").value || 0);
  const supplier = $("purchaseSupplier").value.trim();

  if (!m || !Number.isInteger(qty) || qty <= 0 ||
      !Number.isFinite(cost) || cost < 0) {
    toast("Please enter valid purchase details");
    return;
  }

  m.quantity += qty;

  if ($("purchaseCost").value !== "") {
    m.purchasePrice = cost;
  }

  db.purchases.unshift({
    id: uid(),
    date: today(),
    productName: m.name,
    quantity: qty,
    supplier,
    unitCost: cost,
    total: qty * cost
  });

  if (!save()) {
    m.quantity -= qty;
    db.purchases.shift();
    return;
  }

  $("purchaseForm").reset();

  renderAll();

  toast("Purchase saved successfully");
}

function renderPurchases() {
  $("purchaseTable").innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Medicine</th>
          <th>Quantity</th>
          <th>Supplier</th>
          <th>Cost</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        ${db.purchases.map(p => `
          <tr>
            <td>${esc(p.date)}</td>
            <td>${esc(p.productName)}</td>
            <td>${p.quantity}</td>
            <td>${esc(p.supplier)}</td>
            <td>${money(p.unitCost)}</td>
            <td>${money(p.total)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
    ${db.purchases.length ? "" : "<p>No purchases yet.</p>"}
  `;
}

/* DASHBOARD */

function renderDashboard() {
  const low = db.medicines.filter(
    m => m.quantity <= m.reorderLevel
  );

  const expired = db.medicines.filter(
    m => expiryStatus(m.expiry) === "Expired"
  );

  const expiring = db.medicines.filter(
    m => expiryStatus(m.expiry) === "Expiring soon"
  );

  const salesToday = db.sales.filter(
    s => s.date === today()
  );

  $("statMedicines").textContent = db.medicines.length;

  $("statSales").textContent = money(
    salesToday.reduce((sum, s) => sum + s.total, 0)
  );

  $("statSaleCount").textContent =
    salesToday.length + " transactions";

  $("statLow").textContent = low.length;

  $("statExpiry").textContent =
    expired.length + expiring.length;

  const alerts = [
    ...low.map(m => "Low stock: " + m.name),
    ...expired.map(m => "Expired: " + m.name),
    ...expiring.map(m => "Expiring soon: " + m.name)
  ];

  $("dashboardAlerts").innerHTML = alerts.length
    ? alerts.map(x => `<p>${esc(x)}</p>`).join("")
    : "<p>No stock alerts</p>";

  $("recentSales").innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Customer</th>
          <th>Quantity</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        ${db.sales.slice(0, 5).map(s => `
          <tr>
            <td>${esc(s.date)}</td>
            <td>${esc(s.customer)}</td>
            <td>${s.quantity}</td>
            <td>${money(s.total)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
    ${db.sales.length ? "" : "<p>No sales yet.</p>"}
  `;
}

/* REPORTS */

function renderReports() {
  $("reportTotal").textContent = money(
    db.sales.reduce((sum, s) => sum + s.total, 0)
  );

  $("reportCount").textContent = db.sales.length;

  $("reportUnits").textContent = db.sales.reduce(
    (sum, s) => sum + s.quantity, 0
  );

  $("salesTable").innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Customer</th>
          <th>Items</th>
          <th>Quantity</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        ${db.sales.map(s => `
          <tr>
            <td>${esc(s.date)}</td>
            <td>${esc(s.customer)}</td>
            <td>${(s.items || []).map(i => esc(i.name)).join(", ")}</td>
            <td>${s.quantity}</td>
            <td>${money(s.total)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
    ${db.sales.length ? "" : "<p>No sales records.</p>"}
  `;
}

/* EXPORT AND BACKUP */

function download(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = name;

  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function exportBackup() {
  download(
    "pharmacy-backup.json",
    JSON.stringify(db, null, 2),
    "application/json"
  );

  toast("Backup downloaded");
}

function exportSales() {
  const rows = [
    ["Date", "Customer", "Medicine", "Quantity", "Total"]
  ];

  db.sales.forEach(s => {
    (s.items || []).forEach(i => {
      rows.push([
        s.date,
        s.customer,
        i.name,
        i.quantity,
        i.total
      ]);
    });
  });

  const csv = rows.map(row =>
    row.map(value =>
      '"' + String(value ?? "").replace(/"/g, '""') + '"'
    ).join(",")
  ).join("\n");

  download(
    "pharmacy-sales.csv",
    "\uFEFF" + csv,
    "text/csv;charset=utf-8"
  );

  toast("Sales CSV downloaded");
}

/* FOOTER */

function footerCredit() {
  const footer = document.querySelector("footer");

  if (footer) {
    footer.innerHTML =
      'PharmaDesk · Software Creator Bilal Hamdan · Contact: ' +
      '<a href="tel:03239276900">03239276900</a>';
  }
}

/* RENDER ALL */

function renderAll() {
  renderDashboard();
  renderInventory();
  renderBillProducts();
  renderCart();
  renderPurchaseOptions();
  renderPurchases();
  renderReports();

  $("todayLabel").textContent =
    new Date().toLocaleDateString();

  $("billDate").textContent = today();
}

/* ALL BUTTON EVENTS */

function setupEvents() {

  // Navigation
  document.querySelectorAll("[data-page]").forEach(button => {
    button.addEventListener("click", () => {
      go(button.dataset.page);
    });
  });

  document.querySelectorAll("[data-go]").forEach(button => {
    button.addEventListener("click", () => {
      go(button.dataset.go);
    });
  });

  // Mobile menu
  $("menuBtn").addEventListener("click", () => {
    $("sidebar").classList.toggle("open");
  });

  // Medicine buttons
  $("addMedicineBtn").addEventListener("click", () => {
    openMedicine();
  });

  $("closeMedicine").addEventListener("click", () => {
    $("medicineDialog").close();
  });

  $("cancelMedicine").addEventListener("click", () => {
    $("medicineDialog").close();
  });

  $("medicineForm").addEventListener("submit", saveMedicine);

  // Inventory
  $("inventorySearch").addEventListener("input", renderInventory);
  $("stockFilter").addEventListener("change", renderInventory);

  $("inventoryTable").addEventListener("click", event => {
    const edit = event.target.closest("[data-edit]");
    const del = event.target.closest("[data-delete]");

    if (edit) {
      openMedicine(edit.dataset.edit);
    }

    if (del) {
      const m = medicine(del.dataset.delete);

      if (m && confirm("Delete " + m.name + "?")) {
        db.medicines = db.medicines.filter(
          x => x.id !== m.id
        );

        cart = cart.filter(
          x => x.productId !== m.id
        );

        save();
        renderAll();
        toast("Medicine deleted");
      }
    }
  });

  // Billing
  $("billSearch").addEventListener("input", renderBillProducts);

  $("billProducts").addEventListener("click", event => {
    const button = event.target.closest("[data-add]");

    if (button) {
      addCart(button.dataset.add);
    }
  });

  $("cartItems").addEventListener("click", event => {
    const button = event.target.closest(
      "[data-minus], [data-plus], [data-remove]"
    );

    if (button) changeCart(button);
  });

  $("clearCart").addEventListener("click", () => {
    cart = [];
    renderCart();
    toast("Cart cleared");
  });

  $("completeSale").addEventListener("click", completeSale);

  // Purchases
  $("purchaseForm").addEventListener("submit", savePurchase);

  // Exports
  $("exportTop").addEventListener("click", exportBackup);
  $("exportSales").addEventListener("click", exportSales);
}

/* START APPLICATION */

function startApp() {
  try {
    load();
    setupEvents();
    footerCredit();
    renderAll();
    go("dashboard");

    console.log("PharmaDesk started successfully");

  } catch (error) {
    console.error("PharmaDesk error:", error);
    toast("Software error. Please check app.js");
  }
}

startApp();
