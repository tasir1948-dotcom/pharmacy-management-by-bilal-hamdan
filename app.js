
const KEY = "pharmacy_management_data";

let db;
try {
  db = JSON.parse(localStorage.getItem(KEY)) || {
    products: [], sales: [], purchases: [], customers: []
  };
} catch {
  db = { products: [], sales: [], purchases: [], customers: [] };
}

["products", "sales", "purchases", "customers"].forEach(k => {
  if (!Array.isArray(db[k])) db[k] = [];
});

const $ = id => document.getElementById(id);
const money = n => "Rs. " + Number(n || 0).toLocaleString("en-PK");
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const save = () => localStorage.setItem(KEY, JSON.stringify(db));

function safe(v) {
  return String(v ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  })[c]);
}

function dateNow() {
  return new Date().toISOString().slice(0, 10);
}

function notify(message) {
  alert(message);
}

function addMedicine() {
  const name = $("medName")?.value.trim();
  const category = $("medCategory")?.value.trim() || "General";
  const batch = $("medBatch")?.value.trim() || "";
  const expiry = $("medExpiry")?.value || "";
  const quantity = Number($("medQty")?.value);
  const purchasePrice = Number($("medPurchase")?.value);
  const salePrice = Number($("medSale")?.value);

  if (!name) return notify("Enter medicine name.");
  if (![quantity, purchasePrice, salePrice].every(Number.isFinite) ||
      quantity < 0 || purchasePrice < 0 || salePrice < 0 ||
      !Number.isInteger(quantity)) {
    return notify("Enter valid values.");
  }

  db.products.push({
    id: uid(), name, category, batch, expiry,
    quantity, purchasePrice, salePrice
  });

  save();
  $("medicineForm")?.reset();
  renderApp();
  notify("Medicine added successfully.");
}

function editMedicine(id) {
  const p = db.products.find(x => x.id === id);
  if (!p) return;

  const name = prompt("Medicine name:", p.name);
  if (name === null) return;
  if (!name.trim()) return notify("Name cannot be empty.");

  const qty = prompt("Stock quantity:", p.quantity);
  if (qty === null) return;
  if (!Number.isInteger(Number(qty)) || Number(qty) < 0)
    return notify("Invalid quantity.");

  const price = prompt("Sale price:", p.salePrice);
  if (price === null) return;
  if (!Number.isFinite(Number(price)) || Number(price) < 0)
    return notify("Invalid sale price.");

  p.name = name.trim();
  p.quantity = Number(qty);
  p.salePrice = Number(price);
  save();
  renderApp();
}

function deleteProduct(id) {
  if (!confirm("Delete this medicine?")) return;
  db.products = db.products.filter(p => p.id !== id);
  save();
  renderApp();
}

function addSale(productId, quantity, customer = "Walk-in Customer") {
  const p = db.products.find(x => x.id === productId);
  quantity = Number(quantity);

  if (!p || !Number.isInteger(quantity) || quantity <= 0)
    return notify("Invalid sale details.");

  if (p.quantity < quantity)
    return notify("Insufficient stock.");

  p.quantity -= quantity;

  db.sales.push({
    id: uid(), productId, productName: p.name,
    quantity, price: p.salePrice,
    total: quantity * p.salePrice,
    customer, date: new Date().toISOString()
  });

  save();
  renderApp();
  notify("Sale completed successfully.");
}

function makeSale() {
  const id = $("saleProduct")?.value;
  const qty = Number($("saleQty")?.value);
  const customer = $("saleCustomer")?.value.trim() || "Walk-in Customer";
  if (!id) return notify("Select a medicine.");
  addSale(id, qty, customer);
}

function addPurchase(productId, quantity, unitCost) {
  const p = db.products.find(x => x.id === productId);
  quantity = Number(quantity);
  unitCost = Number(unitCost);

  if (!p || !Number.isInteger(quantity) || quantity <= 0 ||
      !Number.isFinite(unitCost) || unitCost < 0)
    return notify("Invalid purchase details.");

  p.quantity += quantity;
  p.purchasePrice = unitCost;

  db.purchases.push({
    id: uid(), productId, productName: p.name,
    quantity, unitCost, total: quantity * unitCost,
    date: new Date().toISOString()
  });

  save();
  renderApp();
  notify("Purchase recorded successfully.");
}

function makePurchase() {
  const id = $("purchaseProduct")?.value;
  const qty = Number($("purchaseQty")?.value);
  const cost = Number($("purchaseCost")?.value);
  if (!id) return notify("Select a medicine.");
  addPurchase(id, qty, cost);
}

function addCustomer() {
  const name = $("customerName")?.value.trim();
  const phone = $("customerPhone")?.value.trim();

  if (!name) return notify("Enter customer name.");

  db.customers.push({ id: uid(), name, phone });
  save();
  $("customerForm")?.reset();
  renderApp();
  notify("Customer added.");
}

function deleteCustomer(id) {
  if (!confirm("Delete this customer?")) return;
  db.customers = db.customers.filter(c => c.id !== id);
  save();
  renderApp();
}

function getStats() {
  return {
    products: db.products.length,
    stock: db.products.reduce((s, p) => s + p.quantity, 0),
    sales: db.sales.reduce((s, p) => s + p.total, 0),
    purchases: db.purchases.reduce((s, p) => s + p.total, 0),
    low: db.products.filter(p => p.quantity <= 10).length,
    expired: db.products.filter(p =>
      p.expiry && p.expiry < dateNow()
    ).length
  };
}

function renderApp() {
  const s = getStats();

  if ($("dashboard")) {
    $("dashboard").innerHTML = `
      <div class="stat-card"><h3>Total Medicines</h3><p>${s.products}</p></div>
      <div class="stat-card"><h3>Total Stock</h3><p>${s.stock}</p></div>
      <div class="stat-card"><h3>Total Sales</h3><p>${money(s.sales)}</p></div>
      <div class="stat-card"><h3>Total Purchases</h3><p>${money(s.purchases)}</p></div>
      <div class="stat-card"><h3>Low Stock Alerts</h3><p>${s.low}</p></div>
      <div class="stat-card"><h3>Expired Medicines</h3><p>${s.expired}</p></div>
    `;
  }

  if ($("inventory")) {
    $("inventory").innerHTML = `
      <table>
        <thead><tr>
          <th>Medicine</th><th>Category</th><th>Batch</th>
          <th>Expiry</th><th>Stock</th><th>Purchase</th>
          <th>Sale</th><th>Actions</th>
        </tr></thead>
        <tbody>
          ${db.products.map(p => `
            <tr>
              <td>${safe(p.name)}</td>
              <td>${safe(p.category)}</td>
              <td>${safe(p.batch)}</td>
              <td>${safe(p.expiry)}</td>
              <td>${p.quantity}</td>
              <td>${money(p.purchasePrice)}</td>
              <td>${money(p.salePrice)}</td>
              <td>
                <button onclick="editMedicine('${p.id}')">Edit</button>
                <button onclick="deleteProduct('${p.id}')">Delete</button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  }

  const options = db.products.map(p =>
    `<option value="${p.id}">${safe(p.name)} (Stock: ${p.quantity})</option>`
  ).join("");

  ["saleProduct", "purchaseProduct"].forEach(id => {
    if ($(id)) {
      const previous = $(id).value;
      $(id).innerHTML = `<option value="">Select Medicine</option>${options}`;
      if (db.products.some(p => p.id === previous))
        $(id).value = previous;
    }
  });

  if ($("sales")) {
    $("sales").innerHTML = `
      <table><thead><tr>
        <th>Date</th><th>Medicine</th><th>Customer</th>
        <th>Quantity</th><th>Total</th><th>Invoice</th>
      </tr></thead><tbody>
      ${db.sales.map(x => `
        <tr>
          <td>${safe(x.date.slice(0,10))}</td>
          <td>${safe(x.productName)}</td>
          <td>${safe(x.customer)}</td>
          <td>${x.quantity}</td>
          <td>${money(x.total)}</td>
          <td><button onclick="printInvoice('${x.id}')">Print</button></td>
        </tr>
      `).join("")}
      </tbody></table>
    `;
  }

  if ($("purchases")) {
    $("purchases").innerHTML = db.purchases.map(p =>
      `<p>${safe(p.productName)} — ${p.quantity} — ${money(p.total)}</p>`
    ).join("") || "<p>No purchases yet.</p>";
  }

  if ($("customers")) {
    $("customers").innerHTML = db.customers.map(c => `
      <p>${safe(c.name)} — ${safe(c.phone)}
      <button onclick="deleteCustomer('${c.id}')">Delete</button></p>
    `).join("") || "<p>No customers yet.</p>";
  }

  if ($("alerts")) {
    const low = db.products.filter(p => p.quantity <= 10);
    const expired = db.products.filter(p => p.expiry && p.expiry < dateNow());
    const soon = db.products.filter(p => {
      if (!p.expiry || p.expiry < dateNow()) return false;
      const days = (new Date(p.expiry) - new Date(dateNow())) / 86400000;
      return days <= 30;
    });

    $("alerts").innerHTML = `
      <h3>Low Stock</h3>
      ${low.map(p => `<p>${safe(p.name)} — ${p.quantity} remaining</p>`).join("") || "<p>None</p>"}
      <h3>Expired Medicines</h3>
      ${expired.map(p => `<p>${safe(p.name)} — ${safe(p.expiry)}</p>`).join("") || "<p>None</p>"}
      <h3>Expiring Within 30 Days</h3>
      ${soon.map(p => `<p>${safe(p.name)} — ${safe(p.expiry)}</p>`).join("") || "<p>None</p>"}
    `;
  }

  if ($("reports")) {
    const today = dateNow();
    const daily = db.sales.filter(x => x.date.slice(0,10) === today)
      .reduce((sum,x) => sum + x.total, 0);

    $("reports").innerHTML = `
      <p>Today's Sales: <strong>${money(daily)}</strong></p>
      <p>All-time Sales: <strong>${money(s.sales)}</strong></p>
      <p>All-time Purchases: <strong>${money(s.purchases)}</strong></p>
      <p>Total Medicines: ${s.products}</p>
      <p>Total Stock: ${s.stock}</p>
    `;
  }
}

function printInvoice(id) {
  const x = db.sales.find(s => s.id === id);
  if (!x) return;

  const win = window.open("", "_blank");
  if (!win) return notify("Please allow pop-ups to print invoice.");

  win.document.write(`
    <html><head><title>Pharmacy Invoice</title>
    <style>
      body{font-family:Arial;padding:30px}
      table{width:100%;border-collapse:collapse}
      td,th{padding:12px;border:1px solid #ddd;text-align:left}
    </style></head><body>
    <h1>PHARMACY INVOICE</h1>
    <p>Invoice: ${safe(x.id)}</p>
    <p>Date: ${safe(x.date)}</p>
    <p>Customer: ${safe(x.customer)}</p>
    <table><tr><th>Medicine</th><th>Qty</th><th>Price</th><th>Total</th></tr>
    <tr><td>${safe(x.productName)}</td><td>${x.quantity}</td>
    <td>${money(x.price)}</td><td>${money(x.total)}</td></tr></table>
    <h2>Total: ${money(x.total)}</h2>
    <p>Thank you for your purchase.</p>
    <script>window.onload=()=>window.print();<\/script>
    </body></html>
  `);
  win.document.close();
}

function exportData() {
  const blob = new Blob([JSON.stringify(db, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "pharmacy-backup.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function importData(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      for (const k of ["products","sales","purchases","customers"]) {
        if (!Array.isArray(imported[k])) throw Error("Invalid backup");
      }
      if (!confirm("Replace current data with backup?")) return;
      db = imported;
      save();
      renderApp();
      notify("Backup restored.");
    } catch {
      notify("Invalid backup file.");
    }
  };
  reader.readAsText(file);
}

document.addEventListener("DOMContentLoaded", () => {
  renderApp();
});

window.addMedicine = addMedicine;
window.editMedicine = editMedicine;
window.deleteProduct = deleteProduct;
window.addSale = addSale;
window.makeSale = makeSale;
window.addPurchase = addPurchase;
window.makePurchase = makePurchase;
window.addCustomer = addCustomer;
window.deleteCustomer = deleteCustomer;
window.printInvoice = printInvoice;
window.exportData = exportData;
window.importData = importData;
