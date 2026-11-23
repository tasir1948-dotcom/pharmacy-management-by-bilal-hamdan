
/* PharmaDesk - Pharmacy Management Software */

const STORAGE_KEY = "pharmadesk_data_v1";

let data = {
  medicines: [],
  sales: [],
  purchases: []
};

let cart = [];
let currentPage = "dashboard";

const $ = (id) => document.getElementById(id);

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function loadData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved) {
      data.medicines = saved.medicines || [];
      data.sales = saved.sales || [];
      data.purchases = saved.purchases || [];
    }
  } catch (error) {
    console.error("Could not load saved data:", error);
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function money(value) {
  return "Rs. " + Number(value || 0).toLocaleString("en-PK", {
    maximumFractionDigits: 2
  });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function notify(message) {
  const toast = $("toast");
  if (!toast) {
    alert(message);
    return;
  }

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2800);
}

/* PAGE NAVIGATION */

function showPage(page) {
  currentPage = page;

  document.querySelectorAll("[id^='page-']").forEach(section => {
    section.hidden = section.id !== "page-" + page;
  });

  document.querySelectorAll("[data-page]").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.page === page
    );
  });

  const titles = {
    dashboard: "Dashboard",
    inventory: "Medicine Inventory",
    billing: "Billing / Sales",
    purchases: "Purchases",
    reports: "Reports"
  };

  if ($("pageTitle")) {
    $("pageTitle").textContent = titles[page] || "PharmaDesk";
  }

  renderAll();
}

document.querySelectorAll("[data-page]").forEach(button => {
  button.addEventListener("click", () => {
    showPage(button.dataset.page);
    $("sidebar")?.classList.remove("open");
  });
});

document.querySelectorAll("[data-go]").forEach(button => {
  button.addEventListener("click", () => {
    showPage(button.dataset.go);
  });
});

$("menuBtn")?.addEventListener("click", () => {
  $("sidebar")?.classList.toggle("open");
});

/* MEDICINE INVENTORY */

function getMedicine(id) {
  return data.medicines.find(m => String(m.id) === String(id));
}

function medicineFormValues() {
  return {
    name: $("medName").value.trim(),
    category: $("medCategory").value.trim(),
    batch: $("medBatch").value.trim(),
    expiry: $("medExpiry").value,
    quantity: Number($("medQty").value),
    reorderLevel: Number($("medReorder").value),
    salePrice: Number($("medPrice").value),
    purchasePrice: Number($("medCost").value)
  };
}

function openMedicine(id = "") {
  $("medicineForm")?.reset();
  $("medicineId").value = id;

  if (id) {
    const m = getMedicine(id);
    if (!m) return;

    $("medicineModalTitle").textContent = "Edit Medicine";
    $("medName").value = m.name;
    $("medCategory").value = m.category || "";
    $("medBatch").value = m.batch || "";
    $("medExpiry").value = m.expiry || "";
    $("medQty").value = m.quantity;
    $("medReorder").value = m.reorderLevel;
    $("medPrice").value = m.salePrice;
    $("medCost").value = m.purchasePrice;
  } else {
    $("medicineModalTitle").textContent = "Add Medicine";
    $("medQty").value = 0;
    $("medReorder").value = 10;
  }

  $("medicineDialog")?.showModal();
}

$("addMedicineBtn")?.addEventListener("click", () => openMedicine());

$("closeMedicine")?.addEventListener("click", () => {
  $("medicineDialog")?.close();
});

$("cancelMedicine")?.addEventListener("click", () => {
  $("medicineDialog")?.close();
});

$("medicineForm")?.addEventListener("submit", event => {
  event.preventDefault();

  const values = medicineFormValues();

  if (!values.name) {
    notify("Enter medicine name");
    return;
  }

  if (
    values.quantity < 0 ||
    values.reorderLevel < 0 ||
    values.salePrice < 0 ||
    values.purchasePrice < 0
  ) {
    notify("Please enter valid numbers");
    return;
  }

  const id = $("medicineId").value;

  if (id) {
    const medicine = getMedicine(id);
    if (medicine) Object.assign(medicine, values);
    notify("Medicine updated successfully");
  } else {
    data.medicines.push({
      id: uid(),
      ...values,
      createdAt: new Date().toISOString()
    });
    notify("Medicine added successfully");
  }

  saveData();
  $("medicineDialog")?.close();
  renderAll();
});

function deleteMedicine(id) {
  const medicine = getMedicine(id);
  if (!medicine) return;

  if (!confirm("Delete " + medicine.name + "?")) return;

  data.medicines = data.medicines.filter(m => m.id !== id);
  cart = cart.filter(item => item.productId !== id);

  saveData();
  renderAll();
  notify("Medicine deleted");
}

function expiryStatus(expiry) {
  if (!expiry) return "No expiry";

  const days = Math.ceil(
    (new Date(expiry + "T00:00:00") - new Date(today() + "T00:00:00")) /
    86400000
  );

  if (days < 0) return "Expired";
  if (days <= 90) return "Expiring soon";
  return "Good";
}

function renderInventory() {
  const table = $("inventoryTable");
  if (!table) return;

  const search = ($("inventorySearch")?.value || "").toLowerCase();
  const filter = $("stockFilter")?.value || "all";

  const medicines = data.medicines.filter(m => {
    const matchesSearch =
      [m.name, m.category, m.batch].join(" ").toLowerCase().includes(search);

    let matchesFilter = true;

    if (filter === "low") {
      matchesFilter = m.quantity <= m.reorderLevel;
    } else if (filter === "out") {
      matchesFilter = m.quantity <= 0;
    } else if (filter === "expired") {
      matchesFilter = expiryStatus(m.expiry) === "Expired";
    } else if (filter === "expiring") {
      matchesFilter = expiryStatus(m.expiry) === "Expiring soon";
    }

    return matchesSearch && matchesFilter;
  });

  table.innerHTML = `
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
      ${medicines.map(m => `
        <tr>
          <td>${escapeHTML(m.name)}</td>
          <td>${escapeHTML(m.category)}</td>
          <td>${escapeHTML(m.batch)}</td>
          <td>${escapeHTML(m.expiry || "-")}</td>
          <td>${m.quantity}</td>
          <td>${money(m.salePrice)}</td>
          <td>
            <button type="button" data-edit="${m.id}">Edit</button>
            <button type="button" data-delete="${m.id}">Delete</button>
          </td>
        </tr>
      `).join("")}
    </tbody>
  `;

  table.querySelectorAll("[data-edit]").forEach(button => {
    button.addEventListener("click", () => openMedicine(button.dataset.edit));
  });

  table.querySelectorAll("[data-delete]").forEach(button => {
    button.addEventListener("click", () => deleteMedicine(button.dataset.delete));
  });
}

$("inventorySearch")?.addEventListener("input", renderInventory);
$("stockFilter")?.addEventListener("change", renderInventory);

/* BILLING */

function addToCart(id) {
  const medicine = getMedicine(id);
  if (!medicine) return;

  if (medicine.quantity <= 0) {
    notify("Medicine is out of stock");
    return;
  }

  if (expiryStatus(medicine.expiry) === "Expired") {
    notify("This medicine is expired and cannot be sold");
    return;
  }

  const existing = cart.find(item => item.productId === id);
  const wanted = (existing?.quantity || 0) + 1;

  if (wanted > medicine.quantity) {
    notify("Not enough stock available");
    return;
  }

  if (existing) {
    existing.quantity++;
  } else {
    cart.push({
      productId: id,
      quantity: 1
    });
  }

  renderCart();
}

function renderBillProducts() {
  const container = $("billProducts");
  if (!container) return;

  const search = ($("billSearch")?.value || "").toLowerCase();

  const medicines = data.medicines.filter(m =>
    m.name.toLowerCase().includes(search) &&
    m.quantity > 0 &&
    expiryStatus(m.expiry) !== "Expired"
  );

  container.innerHTML = medicines.map(m => `
    <button type="button" class="product-card" data-add="${m.id}">
      <strong>${escapeHTML(m.name)}</strong>
      <span>${money(m.salePrice)}</span>
      <small>Stock: ${m.quantity}</small>
    </button>
  `).join("") || "<p>No medicines found</p>";

  container.querySelectorAll("[data-add]").forEach(button => {
    button.addEventListener("click", () => addToCart(button.dataset.add));
  });
}

function renderCart() {
  const container = $("cartItems");
  if (!container) return;

  let total = 0;

  container.innerHTML = cart.map(item => {
    const medicine = getMedicine(item.productId);
    if (!medicine) return "";

    const lineTotal = medicine.salePrice * item.quantity;
    total += lineTotal;

    return `
      <div class="cart-item">
        <span>${escapeHTML(medicine.name)}</span>
        <span>${money(medicine.salePrice)}</span>
        <button type="button" data-minus="${medicine.id}">-</button>
        <span>${item.quantity}</span>
        <button type="button" data-plus="${medicine.id}">+</button>
        <strong>${money(lineTotal)}</strong>
        <button type="button" data-remove="${medicine.id}">Remove</button>
      </div>
    `;
  }).join("") || "<p>Cart is empty</p>";

  if ($("billTotal")) $("billTotal").textContent = money(total);

  container.querySelectorAll("[data-minus]").forEach(button => {
    button.addEventListener("click", () => changeCartQty(button.dataset.minus, -1));
  });

  container.querySelectorAll("[data-plus]").forEach(button => {
    button.addEventListener("click", () => changeCartQty(button.dataset.plus, 1));
  });

  container.querySelectorAll("[data-remove]").forEach(button => {
    button.addEventListener("click", () => {
      cart = cart.filter(item => item.productId !== button.dataset.remove);
      renderCart();
    });
  });
}

function changeCartQty(id, change) {
  const item = cart.find(x => x.productId === id);
  const medicine = getMedicine(id);

  if (!item || !medicine) return;

  const next = item.quantity + change;

  if (next <= 0) {
    cart = cart.filter(x => x.productId !== id);
  } else if (next > medicine.quantity) {
    notify("Not enough stock available");
    return;
  } else {
    item.quantity = next;
  }

  renderCart();
}

$("billSearch")?.addEventListener("input", renderBillProducts);

$("clearCart")?.addEventListener("click", () => {
  cart = [];
  renderCart();
});

function completeSale() {
  if (cart.length === 0) {
    notify("Add medicines to the cart first");
    return;
  }

  for (const item of cart) {
    const medicine = getMedicine(item.productId);

    if (
      !medicine ||
      medicine.quantity < item.quantity ||
      expiryStatus(medicine.expiry) === "Expired"
    ) {
      notify("Please check stock and expiry before completing sale");
      return;
    }
  }

  const items = cart.map(item => {
    const medicine = getMedicine(item.productId);

    return {
      productId: medicine.id,
      name: medicine.name,
      quantity: item.quantity,
      price: medicine.salePrice,
      total: medicine.salePrice * item.quantity
    };
  });

  const total = items.reduce((sum, item) => sum + item.total, 0);
  const quantity = items.reduce((sum, item) => sum + item.quantity, 0);

  items.forEach(item => {
    const medicine = getMedicine(item.productId);
    medicine.quantity -= item.quantity;
  });

  const sale = {
    id: uid(),
    date: $("billDate")?.value || today(),
    customer: $("customerName")?.value.trim() || "Walk-in Customer",
    items,
    total,
    quantity
  };

  data.sales.unshift(sale);
  cart = [];

  if ($("customerName")) $("customerName").value = "";

  saveData();
  renderAll();
  notify("Sale completed successfully");

  printInvoice(sale);
}

$("completeSale")?.addEventListener("click", completeSale);

function printInvoice(sale) {
  const invoiceWindow = window.open("", "_blank");

  if (!invoiceWindow) {
    notify("Allow pop-ups to print the invoice");
    return;
  }

  const rows = sale.items.map(item => `
    <tr>
      <td>${escapeHTML(item.name)}</td>
      <td>${item.quantity}</td>
      <td>${money(item.price)}</td>
      <td>${money(item.total)}</td>
    </tr>
  `).join("");

  invoiceWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Pharmacy Invoice</title>
      <style>
        body { font-family: Arial; padding: 25px; color: #222; }
        h2, p { text-align: center; }
        table { width: 100%; border-collapse: collapse; margin-top: 25px; }
        th, td { border: 1px solid #ccc; padding: 10px; text-align: left; }
        .total { text-align: right; margin-top: 20px; font-size: 20px; }
      </style>
    </head>
    <body>
      <h2>PharmaDesk Pharmacy</h2>
      <p>Sales Invoice</p>
      <p>Invoice: ${escapeHTML(sale.id)}</p>
      <p>Date: ${escapeHTML(sale.date)}</p>
      <p>Customer: ${escapeHTML(sale.customer)}</p>
      <table>
        <thead><tr><th>Medicine</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="total"><strong>Total: ${money(sale.total)}</strong></div>
      <p>Thank you for your visit!</p>
      <script>window.onload = () => window.print();<\/script>
    </body>
    </html>
  `);

  invoiceWindow.document.close();
}

/* PURCHASES */

$("purchaseForm")?.addEventListener("submit", event => {
  event.preventDefault();

  const id = $("purchaseMedicine").value;
  const medicine = getMedicine(id);
  const quantity = Number($("purchaseQty").value);
  const supplier = $("purchaseSupplier").value.trim();
  const cost = Number($("purchaseCost").value);

  if (!medicine) {
    notify("Select a medicine");
    return;
  }

  if (quantity <= 0 || cost < 0) {
    notify("Enter valid purchase quantity and cost");
    return;
  }

  medicine.quantity += quantity;
  medicine.purchasePrice = cost;

  data.purchases.unshift({
    id: uid(),
    date: today(),
    productId: id,
    productName: medicine.name,
    quantity,
    supplier,
    unitCost: cost,
    total: quantity * cost
  });

  saveData();
  $("purchaseForm").reset();
  renderAll();
  notify("Purchase saved and stock updated");
});

function renderPurchaseOptions() {
  const select = $("purchaseMedicine");
  if (!select) return;

  const previous = select.value;

  select.innerHTML = `
    <option value="">Select medicine</option>
    ${data.medicines.map(m => `
      <option value="${m.id}">${escapeHTML(m.name)}</option>
    `).join("")}
  `;

  if (getMedicine(previous)) select.value = previous;
}

function renderPurchases() {
  const table = $("purchaseTable");
  if (!table) return;

  table.innerHTML = `
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
      ${data.purchases.map(p => `
        <tr>
          <td>${escapeHTML(p.date)}</td>
          <td>${escapeHTML(p.productName)}</td>
          <td>${p.quantity}</td>
          <td>${escapeHTML(p.supplier)}</td>
          <td>${money(p.unitCost)}</td>
          <td>${money(p.total)}</td>
        </tr>
      `).join("")}
    </tbody>
  `;
}

/* DASHBOARD */

function renderDashboard() {
  const medicines = data.medicines;
  const lowStock = medicines.filter(m => m.quantity <= m.reorderLevel);
  const expired = medicines.filter(m => expiryStatus(m.expiry) === "Expired");
  const expiring = medicines.filter(m => expiryStatus(m.expiry) === "Expiring soon");

  const salesToday = data.sales.filter(s => s.date === today());
  const totalToday = salesToday.reduce((sum, s) => sum + s.total, 0);

  if ($("statMedicines")) {
    $("statMedicines").textContent = medicines.length;
  }

  if ($("statSales")) {
    $("statSales").textContent = money(totalToday);
  }

  if ($("statSaleCount")) {
    $("statSaleCount").textContent = salesToday.length;
  }

  if ($("statLow")) {
    $("statLow").textContent = lowStock.length;
  }

  if ($("statExpiry")) {
    $("statExpiry").textContent = expired.length + expiring.length;
  }

  const alerts = $("dashboardAlerts");

  if (alerts) {
    const messages = [];

    lowStock.forEach(m => {
      messages.push("Low stock: " + m.name);
    });

    expired.forEach(m => {
      messages.push("Expired medicine: " + m.name);
    });

    expiring.forEach(m => {
      messages.push("Expiring soon: " + m.name);
    });

    alerts.innerHTML = messages.length
      ? messages.map(message => `<p>${escapeHTML(message)}</p>`).join("")
      : "<p>No stock or expiry alerts</p>";
  }

  const recent = $("recentSales");

  if (recent) {
    recent.innerHTML = data.sales.slice(0, 5).map(s => `
      <tr>
        <td>${escapeHTML(s.date)}</td>
        <td>${escapeHTML(s.customer)}</td>
        <td>${s.quantity || 0}</td>
        <td>${money(s.total)}</td>
      </tr>
    `).join("") || "<tr><td colspan='4'>No sales yet</td></tr>";
  }
}

/* REPORTS */

function renderReports() {
  const total = data.sales.reduce((sum, sale) => sum + sale.total, 0);
  const count = data.sales.length;
  const units = data.sales.reduce((sum, sale) => sum + (sale.quantity || 0), 0);

  if ($("reportTotal")) $("reportTotal").textContent = money(total);
  if ($("reportCount")) $("reportCount").textContent = count;
  if ($("reportUnits")) $("reportUnits").textContent = units;

  const table = $("salesTable");
  if (!table) return;

  table.innerHTML = `
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
      ${data.sales.map(s => `
        <tr>
          <td>${escapeHTML(s.date)}</td>
          <td>${escapeHTML(s.customer)}</td>
          <td>${(s.items || []).map(i => escapeHTML(i.name)).join(", ")}</td>
          <td>${s.quantity || 0}</td>
          <td>${money(s.total)}</td>
        </tr>
      `).join("") || "<tr><td colspan='5'>No sales records</td></tr>"}
    </tbody>
  `;
}

/* EXPORT DATA */

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

function exportBackup() {
  downloadFile(
    "pharmadesk-backup.json",
    JSON.stringify(data, null, 2),
    "application/json"
  );

  notify("Backup downloaded");
}

function exportSalesCSV() {
  const rows = [
    ["Date", "Customer", "Medicine", "Quantity", "Total"]
  ];

  data.sales.forEach(sale => {
    (sale.items || []).forEach(item => {
      rows.push([
        sale.date,
        sale.customer,
        item.name,
        item.quantity,
        item.total
      ]);
    });
  });

  const csv = rows.map(row =>
    row.map(value =>
      '"' + String(value ?? "").replace(/"/g, '""') + '"'
    ).join(",")
  ).join("\n");

  downloadFile("pharmacy-sales.csv", csv, "text/csv;charset=utf-8");
  notify("Sales report downloaded");
}

$("exportTop")?.addEventListener("click", exportBackup);
$("exportSales")?.addEventListener("click", exportSalesCSV);

/* FOOTER CREDIT */

function updateFooter() {
  const footer = document.querySelector("footer");

  if (footer) {
    footer.innerHTML = `
      PharmaDesk · Software Created by Bilal Hamdan ·
      Contact: <a href="tel:03239276900">03239276900</a>
    `;
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

  if ($("todayLabel")) {
    $("todayLabel").textContent = new Date().toLocaleDateString();
  }

  if ($("billDate") && !$("billDate").value) {
    $("billDate").value = today();
  }
}

/* START APPLICATION */

loadData();
updateFooter();
renderAll();
showPage("dashboard");
