
const STORAGE_KEY = "pharmacy_management_data";

const defaultData = {
  products: [],
  sales: [],
  purchases: []
};

let data;

try {
  data = JSON.parse(localStorage.getItem(STORAGE_KEY)) || defaultData;
} catch {
  data = defaultData;
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function money(value) {
  return "Rs. " + Number(value || 0).toLocaleString("en-PK");
}

function createId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function addProduct(product) {
  const item = {
    id: createId(),
    name: String(product.name || "").trim(),
    category: String(product.category || "General").trim(),
    batch: String(product.batch || "").trim(),
    expiry: product.expiry || "",
    quantity: Number(product.quantity) || 0,
    purchasePrice: Number(product.purchasePrice) || 0,
    salePrice: Number(product.salePrice) || 0
  };

  if (!item.name) {
    alert("Please enter product name.");
    return;
  }

  if (item.quantity < 0 || item.purchasePrice < 0 || item.salePrice < 0) {
    alert("Values cannot be negative.");
    return;
  }

  data.products.push(item);
  saveData();
  renderApp();
}

function deleteProduct(id) {
  if (!confirm("Delete this product?")) return;

  data.products = data.products.filter(p => p.id !== id);
  saveData();
  renderApp();
}

function addSale(productId, quantity) {
  const product = data.products.find(p => p.id === productId);
  quantity = Number(quantity);

  if (!product || !Number.isInteger(quantity) || quantity <= 0) {
    alert("Invalid product or quantity.");
    return;
  }

  if (product.quantity < quantity) {
    alert("Not enough stock available.");
    return;
  }

  product.quantity -= quantity;

  data.sales.push({
    id: createId(),
    productId,
    productName: product.name,
    quantity,
    price: product.salePrice,
    total: product.salePrice * quantity,
    date: new Date().toISOString()
  });

  saveData();
  renderApp();
}

function addPurchase(productId, quantity, unitCost) {
  const product = data.products.find(p => p.id === productId);
  quantity = Number(quantity);
  unitCost = Number(unitCost);

  if (!product || !Number.isInteger(quantity) || quantity <= 0 ||
      !Number.isFinite(unitCost) || unitCost < 0) {
    alert("Please check purchase details.");
    return;
  }

  product.quantity += quantity;
  product.purchasePrice = unitCost;

  data.purchases.push({
    id: createId(),
    productId,
    productName: product.name,
    quantity,
    unitCost,
    total: quantity * unitCost,
    date: new Date().toISOString()
  });

  saveData();
  renderApp();
}

function getStats() {
  return {
    products: data.products.length,
    stock: data.products.reduce((sum, p) => sum + p.quantity, 0),
    sales: data.sales.reduce((sum, s) => sum + s.total, 0),
    purchases: data.purchases.reduce((sum, p) => sum + p.total, 0)
  };
}

function renderApp() {
  const stats = getStats();

  const dashboard = document.getElementById("dashboard");
  if (dashboard) {
    dashboard.innerHTML = `
      <div class="stat-card"><h3>Total Products</h3><p>${stats.products}</p></div>
      <div class="stat-card"><h3>Total Stock</h3><p>${stats.stock}</p></div>
      <div class="stat-card"><h3>Total Sales</h3><p>${money(stats.sales)}</p></div>
      <div class="stat-card"><h3>Total Purchases</h3><p>${money(stats.purchases)}</p></div>
    `;
  }

  const inventory = document.getElementById("inventory");
  if (inventory) {
    inventory.innerHTML = `
      <table>
        <thead><tr>
          <th>Medicine</th><th>Category</th><th>Batch</th>
          <th>Expiry</th><th>Stock</th><th>Purchase</th>
          <th>Sale</th><th>Action</th>
        </tr></thead>
        <tbody>
          ${data.products.map(p => `
            <tr>
              <td>${escapeHTML(p.name)}</td>
              <td>${escapeHTML(p.category)}</td>
              <td>${escapeHTML(p.batch)}</td>
              <td>${escapeHTML(p.expiry)}</td>
              <td>${p.quantity}</td>
              <td>${money(p.purchasePrice)}</td>
              <td>${money(p.salePrice)}</td>
              <td><button onclick="deleteProduct('${p.id}')">Delete</button></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  }

  const sales = document.getElementById("sales");
  if (sales) {
    sales.innerHTML = data.sales.map(s => `
      <p>${escapeHTML(s.productName)} — ${s.quantity} — ${money(s.total)}</p>
    `).join("") || "<p>No sales yet.</p>";
  }

  const purchases = document.getElementById("purchases");
  if (purchases) {
    purchases.innerHTML = data.purchases.map(p => `
      <p>${escapeHTML(p.productName)} — ${p.quantity} — ${money(p.total)}</p>
    `).join("") || "<p>No purchases yet.</p>";
  }
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function exportData() {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "pharmacy-data-backup.json";
  link.click();
  URL.revokeObjectURL(url);
}

document.addEventListener("DOMContentLoaded", () => {
  renderApp();
});
