
/* PharmaDesk - Pharmacy Management System */

const KEY = "pharmacy_management_data";

let db = {
  medicines: [],
  sales: [],
  purchases: []
};

let cart = [];

const $ = id => document.getElementById(id);

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function money(n) {
  return "Rs " + Number(n || 0).toLocaleString("en-PK", {
    maximumFractionDigits: 2
  });
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  })[c]);
}

function toast(message) {
  const box = $("toast");
  if (!box) return alert(message);
  box.textContent = message;
  box.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => box.classList.remove("show"), 2500);
}

/* STORAGE */

function load() {
  try {
    const old = JSON.parse(localStorage.getItem(KEY));
    if (old) {
      db.medicines = old.medicines || old.products || [];
      db.sales = old.sales || [];
      db.purchases = old.purchases || [];
    }

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
      id: s.id || uid(),
      date: s.date || today(),
      customer: s.customer || "Walk-in Customer",
      items: s.items || [{
        name: s.productName || s.name || "Medicine",
        quantity: Number(s.quantity || 0),
        price: Number(s.price || 0),
        total: Number(s.total || 0)
      }],
      quantity: Number(s.quantity || 0),
      total: Number(s.total || 0)
    }));
  } catch (e) {
    console.error(e);
    toast("Saved data could not be loaded");
  }
}

function save() {
  localStorage.setItem(KEY, JSON.stringify(db));
}

function medicine(id) {
  return db.medicines.find(m => String(m.id) === String(id));
}

/* NAVIGATION */

function go(page) {
  document.querySelectorAll(".page").forEach(p => {
    const active = p.id === "page-" + page;
    p.hidden = !active;
    p.classList.toggle("active", active);
  });

  document.querySelectorAll("[data-page]").forEach(b => {
    b.classList.toggle("active", b.dataset.page === page);
  });

  const titles = {
    dashboard:"Dashboard",
    inventory:"Inventory",
    billing:"Sales & Billing",
    purchases:"Purchases",
    reports:"Reports"
  };

  $("pageTitle").textContent = titles[page] || "PharmaDesk";
  $("sidebar").classList.remove("open");
  renderAll();
}

document.querySelectorAll("[data-page]").forEach(b => {
  b.addEventListener("click", () => go(b.dataset.page));
});

document.querySelectorAll("[data-go]").forEach(b => {
  b.addEventListener("click", () => go(b.dataset.go));
});

$("menuBtn").addEventListener("click", () => {
  $("sidebar").classList.toggle("open");
});

/* MEDICINE FORM */

function openMedicine(id = "") {
  $("medicineForm").reset();
  $("medicineId").value = id;

  if (id) {
    const m = medicine(id);
    if (!m) return;

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

$("addMedicineBtn").addEventListener("click", () => openMedicine());

$("closeMedicine").addEventListener("click", () => {
  $("medicineDialog").close();
});

$("cancelMedicine").addEventListener("click", () => {
  $("medicineDialog").close();
});

$("medicineForm").addEventListener("submit", e => {
  e.preventDefault();

  const m = {
    name: $("medName").value.trim(),
    category: $("medCategory").value.trim(),
    batch: $("medBatch").value.trim(),
    expiry: $("medExpiry").value,
    quantity: Number($("medQty").value),
    reorderLevel: Number($("medReorder").value),
    salePrice: Number($("medPrice").value),
    purchasePrice: Number($("medCost").value)
  };

  if (!m.name || !m.expiry) {
    toast("Medicine name and expiry are required");
    return;
  }

  if (Object.values(m).some(v =>
    typeof v === "number" && (!Number.isFinite(v) || v < 0)
  )) {
    toast("Enter valid numbers");
    return;
  }

  const id = $("medicineId").value;

  if (id) {
    Object.assign(medicine(id), m);
    toast("Medicine updated");
  } else {
    db.medicines.push({ id: uid(), ...m });
    toast("Medicine added successfully");
  }

  save();
  $("medicineDialog").close();
  renderAll();
});

/* INVENTORY */

function expiry(exp) {
  if (!exp) return "Unknown";
  const days = Math.ceil(
    (new Date(exp + "T00:00:00") -
     new Date(today() + "T00:00:00")) / 86400000
  );
  if (days < 0) return "Expired";
  if (days <= 90) return "Expiring soon";
  return "Good";
}

function renderInventory() {
  const box = $("inventoryTable");
  const search = $("inventorySearch").value.toLowerCase();
  const filter = $("stockFilter").value;

  const list = db.medicines.filter(m => {
    const match = [m.name,m.category,m.batch].join(" ").toLowerCase().includes(search);
    let status = true;

    if (filter === "low") status = m.quantity <= m.reorderLevel;
    if (filter === "expired") status = expiry(m.expiry) === "Expired";
    if (filter === "expiring") status = expiry(m.expiry) === "Expiring soon";

    return match && status;
  });

  box.innerHTML = `
    <table>
      <thead><tr>
        <th>Medicine</th><th>Category</th><th>Batch</th>
        <th>Expiry</th><th>Stock</th><th>Sale Price</th><th>Actions</th>
      </tr></thead>
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

$("inventorySearch").addEventListener("input", renderInventory);
$("stockFilter").addEventListener("change", renderInventory);

$("inventoryTable").addEventListener("click", e => {
  const edit = e.target.closest("[data-edit]");
  const del = e.target.closest("[data-delete]");

  if (edit) openMedicine(edit.dataset.edit);

  if (del) {
    const m = medicine(del.dataset.delete);
    if (m && confirm("Delete " + m.name + "?")) {
      db.medicines = db.medicines.filter(x => x.id !== m.id);
      cart = cart.filter(x => x.productId !== m.id);
      save();
      renderAll();
      toast("Medicine deleted");
    }
  }
});

/* BILLING */

function addCart(id) {
  const m = medicine(id);
  if (!m || m.quantity <= 0) {
    toast("Medicine is out of stock");
    return;
  }

  if (expiry(m.expiry) === "Expired") {
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
    cart.push({ productId:id, quantity:1 });
  }

  renderCart();
}

function renderBillProducts() {
  const box = $("billProducts");
  const q = $("billSearch").value.toLowerCase();

  const list = db.medicines.filter(m =>
    m.name.toLowerCase().includes(q) &&
    m.quantity > 0 &&
    expiry(m.expiry) !== "Expired"
  );

  box.innerHTML = list.map(m => `
    <button type="button" class="product-card" data-add="${esc(m.id)}">
      <strong>${esc(m.name)}</strong>
      <span>${money(m.salePrice)}</span>
      <small>Stock: ${m.quantity}</small>
    </button>
  `).join("") || "<p>No medicines available</p>";
}

$("billProducts").addEventListener("click", e => {
  const button = e.target.closest("[data-add]");
  if (button) addCart(button.dataset.add);
});

$("billSearch").addEventListener("input", renderBillProducts);

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
        <button type="button" data-minus="${m.id}">−</button>
        <span>${item.quantity}</span>
        <button type="button" data-plus="${m.id}">+</button>
        <strong>${money(line)}</strong>
        <button type="button" data-remove="${m.id}">Remove</button>
      </div>
    `;
  }).join("") || "<p>Cart is empty</p>";

  $("billTotal").textContent = money(total);
}

$("cartItems").addEventListener("click", e => {
  const minus = e.target.closest("[data-minus]");
  const plus = e.target.closest("[data-plus]");
  const remove = e.target.closest("[data-remove]");

  if (remove) {
    cart = cart.filter(x => x.productId !== remove.dataset.remove);
  }

  if (minus || plus) {
    const id = (minus || plus).dataset.minus || (minus || plus).dataset.plus;
    const item = cart.find(x => x.productId === id);
    const m = medicine(id);

    if (item && m) {
      if (minus) item.quantity--;
      else if (item.quantity < m.quantity) item.quantity++;
      else toast("Not enough stock");

      if (item.quantity <= 0) {
        cart = cart.filter(x => x.productId !== id);
      }
    }
  }

  renderCart();
});

$("clearCart").addEventListener("click", () => {
  cart = [];
  renderCart();
});

function completeSale() {
  if (!cart.length) {
    toast("Cart is empty");
    return;
  }

  for (const item of cart) {
    const m = medicine(item.productId);
    if (!m || m.quantity < item.quantity || expiry(m.expiry) === "Expired") {
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

  items.forEach(item => {
    medicine(item.productId).quantity -= item.quantity;
  });

  const sale = {
    id: uid(),
    date: today(),
    customer: $("customerName").value.trim() || "Walk-in Customer",
    items,
    quantity: items.reduce((s,i) => s + i.quantity, 0),
    total: items.reduce((s,i) => s + i.total, 0)
  };

  db.sales.unshift(sale);
  cart = [];
  $("customerName").value = "";
  save();
  renderAll();
  toast("Sale completed successfully");
  printInvoice(sale);
}

$("completeSale").addEventListener("click", completeSale);

/* INVOICE */

function printInvoice(sale) {
  const w = window.open("", "_blank");
  if (!w) {
    toast("Allow pop-ups to print invoice");
    return;
  }

  const rows = sale.items.map(i => `
    <tr>
      <td>${esc(i.name)}</td>
      <td>${i.quantity}</td>
      <td>${money(i.price)}</td>
      <td>${money(i.total)}</td>
    </tr>
  `).join("");

  w.document.write(`
    <!doctype html><html><head><title>Pharmacy Invoice</title>
    <style>
      body{font-family:Arial;padding:25px}
      h2,p{text-align:center}
      table{width:100%;border-collapse:collapse;margin-top:25px}
      td,th{border:1px solid #ccc;padding:10px}
      .total{text-align:right;margin-top:20px;font-size:20px}
    </style></head><body>
    <h2>PharmaDesk Pharmacy</h2>
    <p>Sales Invoice</p>
    <p>Invoice: ${esc(sale.id)}</p>
    <p>Date: ${esc(sale.date)}</p>
    <p>Customer: ${esc(sale.customer)}</p>
    <table><thead><tr><th>Medicine</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <div class="total"><strong>Total: ${money(sale.total)}</strong></div>
    <p>Thank you for your visit!</p>
    <script>window.onload=()=>window.print();<\/script>
    </body></html>
  `);

  w.document.close();
}

/* PURCHASES */

function renderPurchaseOptions() {
  const select = $("purchaseMedicine");
  const old = select.value;

  select.innerHTML = '<option value="">Select medicine</option>' +
    db.medicines.map(m =>
      `<option value="${esc(m.id)}">${esc(m.name)}</option>`
    ).join("");

  if (medicine(old)) select.value = old;
}

$("purchaseForm").addEventListener("submit", e => {
  e.preventDefault();

  const m = medicine($("purchaseMedicine").value);
  const qty = Number($("purchaseQty").value);
  const cost = Number($("purchaseCost").value || 0);
  const supplier = $("purchaseSupplier").value.trim();

  if (!m || qty <= 0 || cost < 0) {
    toast("Enter valid purchase details");
    return;
  }

  m.quantity += qty;
  m.purchasePrice = cost;

  db.purchases.unshift({
    id: uid(),
    date: today(),
    productName: m.name,
    quantity: qty,
    supplier,
    unitCost: cost,
    total: qty * cost
  });

  save();
  $("purchaseForm").reset();
  renderAll();
  toast("Purchase saved and stock updated");
});

function renderPurchases() {
  const box = $("purchaseTable");
  box.innerHTML = `
    <table>
      <thead><tr>
        <th>Date</th><th>Medicine</th><th>Quantity</th>
        <th>Supplier</th><th>Cost</th><th>Total</th>
      </tr></thead>
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
  const low = db.medicines.filter(m => m.quantity <= m.reorderLevel);
  const expired = db.medicines.filter(m => expiry(m.expiry) === "Expired");
  const expiring = db.medicines.filter(m => expiry(m.expiry) === "Expiring soon");
  const salesToday = db.sales.filter(s => s.date === today());

  $("statMedicines").textContent = db.medicines.length;
  $("statSales").textContent = money(salesToday.reduce((s,x) => s + x.total, 0));
  $("statSaleCount").textContent = salesToday.length + " transactions";
  $("statLow").textContent = low.length;
  $("statExpiry").textContent = expired.length + expiring.length;

  const alerts = [
    ...low.map(m => "Low stock: " + m.name),
    ...expired.map(m => "Expired: " + m.name),
    ...expiring.map(m => "Expiring soon: " + m.name)
  ];

  $("dashboardAlerts").innerHTML = alerts.length
    ? alerts.map(x => `<p>${esc(x)}</p>`).join("")
    : "<p>No stock alerts</p>";

  $("recentSales").innerHTML = `
    <table><thead><tr>
      <th>Date</th><th>Customer</th><th>Quantity</th><th>Total</th>
    </tr></thead><tbody>
      ${db.sales.slice(0,5).map(s => `
        <tr><td>${esc(s.date)}</td><td>${esc(s.customer)}</td>
        <td>${s.quantity}</td><td>${money(s.total)}</td></tr>
      `).join("")}
    </tbody></table>
    ${db.sales.length ? "" : "<p>No sales yet.</p>"}
  `;
}

/* REPORTS */

function renderReports() {
  $("reportTotal").textContent = money(
    db.sales.reduce((s,x) => s + x.total, 0)
  );

  $("reportCount").textContent = db.sales.length;

  $("reportUnits").textContent = db.sales.reduce(
    (s,x) => s + x.quantity, 0
  );

  $("salesTable").innerHTML = `
    <table><thead><tr>
      <th>Date</th><th>Customer</th><th>Items</th>
      <th>Quantity</th><th>Total</th>
    </tr></thead><tbody>
      ${db.sales.map(s => `
        <tr>
          <td>${esc(s.date)}</td>
          <td>${esc(s.customer)}</td>
          <td>${s.items.map(i => esc(i.name)).join(", ")}</td>
          <td>${s.quantity}</td>
          <td>${money(s.total)}</td>
        </tr>
      `).join("")}
    </tbody></table>
    ${db.sales.length ? "" : "<p>No sales records.</p>"}
  `;
}

/* EXPORT */

function download(name, content, type) {
  const blob = new Blob([content], {type});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

$("exportTop").addEventListener("click", () => {
  download("pharmacy-backup.json", JSON.stringify(db, null, 2), "application/json");
  toast("Backup downloaded");
});

$("exportSales").addEventListener("click", () => {
  const rows = [["Date","Customer","Medicine","Quantity","Total"]];

  db.sales.forEach(s => {
    s.items.forEach(i => {
      rows.push([s.date,s.customer,i.name,i.quantity,i.total]);
    });
  });

  const csv = rows.map(row =>
    row.map(v => '"' + String(v ?? "").replace(/"/g,'""') + '"').join(",")
  ).join("\n");

  download("pharmacy-sales.csv", csv, "text/csv;charset=utf-8");
  toast("Sales CSV downloaded");
});

/* FOOTER */

function footerCredit() {
  const footer = document.querySelector("footer");
  if (footer) {
    footer.innerHTML =
      'PharmaDesk · Software Creator Bilal Hamdan · Contact: <a href="tel:03239276900">03239276900</a>';
  }
}

/* REFRESH ALL SECTIONS */

function renderAll() {
  renderDashboard();
  renderInventory();
  renderBillProducts();
  renderCart();
  renderPurchaseOptions();
  renderPurchases();
  renderReports();

  $("todayLabel").textContent = new Date().toLocaleDateString();

  if (!$("billDate").value) {
    $("billDate").textContent = today();
  }
}

/* START */

load();
footerCredit();
renderAll();
go("dashboard");
