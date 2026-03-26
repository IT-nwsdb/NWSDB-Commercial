import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDLEA4VJNubkHXqbE7qJmH4thzRZB9UGGA",
  authDomain: "commercial-1921f.firebaseapp.com",
  projectId: "commercial-1921f",
  storageBucket: "commercial-1921f.firebasestorage.app",
  messagingSenderId: "605154183482",
  appId: "1:605154183482:web:2f6a977741ec2624812803"
};

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const collectionName = "overall_commercial_performance";
const localCacheKey = "overall_commercial_performance_firestore_cache_overall_v1";
const fixedDocId = "overall";
const fixedTableName = "Overall";

const schema = [
  {
    section: "Number of Connections",
    rows: [
      { id: "number_domestic", metric: "Domestic" },
      { id: "number_non_domestic", metric: "Non Domestic" },
      { id: "number_total", metric: "Total", calculated: true, formula: "Domestic + Non Domestic" }
    ]
  },
  {
    section: "New Connection",
    rows: [
      { id: "new_connection_given", metric: "Number of connection given in the month" },
      { id: "new_connection_payment_pending", metric: "New connection payment done not yet give conn" },
      { id: "new_connection_first_bill", metric: "1st bill not issued (Todate)" }
    ]
  },
  {
    section: "Monthly billing & collection Performance",
    rows: [
      { id: "monthly_quantity_sold_m3", metric: "Quantity Sold M3" },
      { id: "monthly_actual_billing", metric: "Actual billing Rs Million" },
      { id: "monthly_actual_collection", metric: "Actual collection Rs Million" },
      { id: "monthly_collection_efficiency", metric: "Collection Efficiency (Monthly)%" }
    ]
  },
  {
    section: "Cummulative billing & collection Performance",
    rows: [
      { id: "cumulative_quantity_sold", metric: "Quantity Sold" },
      { id: "cumulative_billing", metric: "Billing Rs Million" },
      { id: "cumulative_collection", metric: "Collection Rs Million" },
      { id: "cumulative_collection_efficiency", metric: "Collection Efficiency (Cummulative)%" }
    ]
  },
  {
    section: "Arrears",
    rows: [
      { id: "arrears_without_dc_sp", metric: "Arrears Without DC/SP" },
      { id: "arrears_total", metric: "Total Arrears" },
      { id: "debt_age_without_current_month", metric: "Debt Age (without current month)" }
    ]
  },
  {
    section: "Other Performence",
    rows: [
      { id: "inactive_accounts", metric: "Inactive accounts" },
      { id: "meter_reader_interval", metric: "Meter reader interval (29,30,31)%" },
      { id: "mobile_update", metric: "Mobile update%" },
      { id: "email_update", metric: "Email update%" },
      { id: "gnd_entered", metric: "GND Entered%" },
      { id: "consumer_payment_pattern", metric: "Consumer payment pattern%" },
      { id: "over_6_months_n_zero", metric: "Over 6 months N Zero%" },
      { id: "over_6_months_e_zero", metric: "Over 6 months E Zero%" },
      { id: "continuous_over_01_years", metric: "Continuous Over 01 Years Estimated Bills Due To Defective Meters (Code 05)" },
      { id: "complaints_outstanding", metric: "Status Of Complaints Received to H/O (outstanding.)%" },
      { id: "average_revenue_per_connection", metric: "Average revenue for connection (Rs / 1 unit)%" },
      { id: "consumer_file_update", metric: "Consumer File Update" }
    ]
  }
];

const rowIds = schema.flatMap((group) => group.rows.map((row) => row.id));
const graphSectionNames = schema.map((group) => group.section);
const chartPalette = [
  "#2563eb", "#16a34a", "#dc2626", "#ca8a04", "#7c3aed", "#0891b2",
  "#ea580c", "#4f46e5", "#be123c", "#0f766e", "#9333ea", "#1d4ed8"
];

function parseNumber(value) {
  const cleaned = String(value ?? "").replace(/,/g, "").trim();
  if (cleaned === "") return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function formatCalculatedNumber(value) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

function recalculateNumberOfConnections(values) {
  months.forEach((month) => {
    const domestic = parseNumber(values["number_domestic"]?.[month]) ?? 0;
    const nonDomestic = parseNumber(values["number_non_domestic"]?.[month]) ?? 0;
    const total = domestic + nonDomestic;

    if (!values["number_total"]) values["number_total"] = {};
    values["number_total"][month] = formatCalculatedNumber(total);
  });

  return values;
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const loadingScreen = document.getElementById("loadingScreen");
const appShell = document.getElementById("app");
const tableView = document.getElementById("tableView");
const saveBtn = document.getElementById("saveBtn");
const resetBtn = document.getElementById("resetBtn");
const graphToggleBtn = document.getElementById("graphToggleBtn");
const graphModal = document.getElementById("graphModal");
const graphCloseBtn = document.getElementById("graphCloseBtn");
const graphSectionSelect = document.getElementById("graphSectionSelect");
const graphTitle = document.getElementById("graphTitle");
const graphSubtitle = document.getElementById("graphSubtitle");
const graphCanvas = document.getElementById("sectionGraphCanvas");
const tableLabel = document.getElementById("tableLabel");
const statusBar = document.getElementById("statusBar");
const tableHead = document.getElementById("tableHead");
const tableBody = document.getElementById("tableBody");
const tableScaleTarget = document.getElementById("tableScaleTarget");

let state = readLocalCache();
let chartInstance = null;
let activeGraphSection = graphSectionNames[0];
let graphModalOpen = false;

window.addEventListener("DOMContentLoaded", async () => {
  setTimeout(async () => {
    loadingScreen.classList.add("hidden");
    appShell.classList.remove("hidden");
    tableLabel.textContent = "Overall";
    graphSectionSelect.value = activeGraphSection;
    showStatus("Loading saved data...", "info");
    await loadCurrentDocument();
    fitTableLayout();
  }, 900);
});

window.addEventListener("resize", () => {
  fitTableLayout();
  updateGraph();
});

saveBtn.addEventListener("click", async () => {
  await saveCurrentDocument();
});

resetBtn.addEventListener("click", async () => {
  const confirmed = window.confirm("Delete all data for the Overall table?");
  if (!confirmed) return;

  state[fixedDocId] = createEmptyValues();
  recalculateNumberOfConnections(state[fixedDocId]);
  writeLocalCache();
  renderTable();
  updateGraph();

  try {
    await deleteDoc(doc(db, collectionName, fixedDocId));
    showStatus("Overall data deleted from cloud and browser backup.", "success");
  } catch (error) {
    console.error("Cloud delete failed", error);
    showStatus(`Local data cleared. Cloud delete failed: ${formatError(error)}`, "error");
  }
});

graphToggleBtn.addEventListener("click", () => {
  openGraphModal();
});

graphCloseBtn.addEventListener("click", () => {
  closeGraphModal();
});

graphSectionSelect.addEventListener("change", (event) => {
  activeGraphSection = event.target.value;
  updateGraph();
});

graphModal.addEventListener("click", (event) => {
  if (event.target === graphModal) {
    closeGraphModal();
  }
});

document.addEventListener("keydown", async (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    await saveCurrentDocument();
  }

  if (event.key === "Escape" && graphModalOpen) {
    closeGraphModal();
  }
});

function openGraphModal() {
  graphModalOpen = true;
  graphModal.classList.remove("hidden");
  graphModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  graphSectionSelect.value = activeGraphSection;
  updateGraph();
}

function closeGraphModal() {
  graphModalOpen = false;
  graphModal.classList.add("hidden");
  graphModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "hidden";
}

function createEmptyValues() {
  const values = {};
  rowIds.forEach((rowId) => {
    values[rowId] = {};
    months.forEach((month) => {
      values[rowId][month] = "";
    });
  });
  return values;
}

function mergeWithEmptyValues(values) {
  const base = createEmptyValues();
  Object.keys(values || {}).forEach((rowId) => {
    if (!base[rowId]) base[rowId] = {};
    months.forEach((month) => {
      const cell = values[rowId]?.[month];
      if (cell !== undefined && cell !== null) {
        base[rowId][month] = String(cell);
      }
    });
  });
  return base;
}

function getCurrentValues() {
  if (!state[fixedDocId]) state[fixedDocId] = createEmptyValues();
  recalculateNumberOfConnections(state[fixedDocId]);
  return state[fixedDocId];
}

function getSectionDefinition(sectionName) {
  return schema.find((group) => group.section === sectionName) || schema[0];
}

function getSectionChartData(sectionName) {
  const values = getCurrentValues();
  const section = getSectionDefinition(sectionName);
  return section.rows.map((row) => ({
    label: row.metric,
    data: months.map((month) => parseNumber(values[row.id]?.[month]))
  }));
}

async function loadCurrentDocument() {
  const cached = state[fixedDocId];

  if (!cached) {
    state[fixedDocId] = createEmptyValues();
  }

  renderTable();

  try {
    const snapshot = await getDoc(doc(db, collectionName, fixedDocId));
    if (snapshot.exists()) {
      const data = snapshot.data();
      state[fixedDocId] = mergeWithEmptyValues(data.values || {});
      recalculateNumberOfConnections(state[fixedDocId]);
      writeLocalCache();
      renderTable();
      updateGraph();
      showStatus("Cloud data loaded successfully.", "success");
      return;
    }

    updateGraph();

    if (cached) {
      showStatus("No cloud record found. Showing browser backup.", "info");
    } else {
      showStatus("No saved cloud data found. Start entering data.", "info");
    }
  } catch (error) {
    console.error("Cloud load failed", error, { collectionName, fixedDocId });
    updateGraph();
    if (cached) {
      showStatus(`Cloud load failed. Showing browser backup. ${formatError(error)}`, "error");
    } else {
      showStatus(`Cloud load failed. ${formatError(error)}`, "error");
    }
  }
}

function renderTable() {
  const values = getCurrentValues();

  tableHead.innerHTML = `
    <tr class="title-row">
      <th colspan="14">${escapeHtml(fixedTableName)} Commercial Performance</th>
    </tr>
    <tr>
      <th colspan="2">Overall</th>
      ${months.map((month) => `<th>${month}</th>`).join("")}
    </tr>
  `;

  let html = "";

  schema.forEach((group) => {
    group.rows.forEach((row, rowIndex) => {
      html += "<tr>";

      if (rowIndex === 0) {
        html += `<td class="section-cell" rowspan="${group.rows.length}">${escapeHtml(group.section)}</td>`;
      }

      html += `<td class="metric-cell">${escapeHtml(row.metric)}</td>`;

      months.forEach((month) => {
        const value = values[row.id]?.[month] ?? "";
        html += `
          <td>
            <input
              type="text"
              class="table-input${row.calculated ? " calculated-cell" : ""}"
              data-row="${row.id}"
              data-month="${month}"
              value="${escapeHtml(value)}"
              autocomplete="off"
              spellcheck="false"
              ${row.calculated ? 'readonly tabindex="-1" title="' + escapeHtml(row.formula || "Auto-calculated") + '"' : ""}
            >
          </td>
        `;
      });

      html += "</tr>";
    });
  });

  tableBody.innerHTML = html;
  attachInputHandlers();
  fitTableLayout();
}

function attachInputHandlers() {
  document.querySelectorAll(".table-input").forEach((input) => {
    input.addEventListener("input", handleInputUpdate);
    input.addEventListener("focus", (event) => event.target.select());
    input.addEventListener("keydown", handleGridNavigation);
  });
}

function handleInputUpdate(event) {
  const rowId = event.target.dataset.row;
  const month = event.target.dataset.month;
  const values = getCurrentValues();

  if (rowId === "number_total") return;

  values[rowId][month] = event.target.value;
  recalculateNumberOfConnections(values);

  const totalInput = document.querySelector('.table-input[data-row="number_total"][data-month="' + month + '"]');
  if (totalInput) {
    totalInput.value = values["number_total"]?.[month] ?? "";
  }

  writeLocalCache();
  updateGraph();
  showStatus("Changes saved in browser backup. Click Save to Cloud.", "info");
}

function handleGridNavigation(event) {
  const navKeys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter"];
  if (!navKeys.includes(event.key)) return;

  const rowId = event.target.dataset.row;
  const month = event.target.dataset.month;
  const rowIndex = rowIds.indexOf(rowId);
  const monthIndex = months.indexOf(month);

  let nextRowIndex = rowIndex;
  let nextMonthIndex = monthIndex;

  if (event.key === "ArrowUp") nextRowIndex -= 1;
  if (event.key === "ArrowDown" || event.key === "Enter") nextRowIndex += 1;
  if (event.key === "ArrowLeft") nextMonthIndex -= 1;
  if (event.key === "ArrowRight") nextMonthIndex += 1;

  if (nextRowIndex < 0 || nextRowIndex >= rowIds.length) return;
  if (nextMonthIndex < 0 || nextMonthIndex >= months.length) return;

  const nextInput = document.querySelector(`.table-input[data-row="${rowIds[nextRowIndex]}"][data-month="${months[nextMonthIndex]}"]`);
  if (!nextInput) return;

  event.preventDefault();
  nextInput.focus();
  nextInput.select();
}

async function saveCurrentDocument() {
  const currentValues = getCurrentValues();
  recalculateNumberOfConnections(currentValues);

  const payload = {
    table: fixedTableName,
    values: mergeWithEmptyValues(currentValues),
    updatedAtClient: new Date().toISOString()
  };

  writeLocalCache();

  try {
    showStatus("Saving to Firestore...", "info");
    await setDoc(doc(db, collectionName, fixedDocId), payload);
    showStatus("Data saved to Firestore successfully.", "success");
  } catch (error) {
    console.error("Cloud save failed", error, { collectionName, fixedDocId, payload });
    showStatus(`Save failed. Local copy is still safe. ${formatError(error)}`, "error");
  }
}

function updateGraph() {
  if (!graphModalOpen || !graphCanvas || typeof Chart === "undefined") return;

  const section = getSectionDefinition(activeGraphSection);
  const datasets = getSectionChartData(activeGraphSection).map((series, index) => ({
    label: series.label,
    data: series.data,
    borderWidth: 2,
    tension: 0.25,
    spanGaps: true,
    fill: false,
    pointRadius: 3,
    pointHoverRadius: 5,
    borderColor: chartPalette[index % chartPalette.length],
    backgroundColor: chartPalette[index % chartPalette.length]
  }));

  graphTitle.textContent = `${section.section} Graph`;
  graphSubtitle.textContent = `${section.rows.length} metric${section.rows.length === 1 ? "" : "s"} shown across Jan to Dec.`;

  if (chartInstance) {
    chartInstance.destroy();
  }

  chartInstance = new Chart(graphCanvas, {
    type: "line",
    data: {
      labels: months,
      datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "nearest",
        intersect: false
      },
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            boxWidth: 14,
            usePointStyle: true
          }
        },
        tooltip: {
          callbacks: {
            label(context) {
              const value = context.raw;
              const display = value === null || value === undefined ? "No data" : value;
              return `${context.dataset.label}: ${display}`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback(value) {
              return Number.isInteger(value) ? value : Number(value).toFixed(2);
            }
          }
        }
      }
    }
  });
}

function fitTableLayout() {
  if (tableView.classList.contains("hidden")) return;
  tableScaleTarget.style.width = "100%";
  tableScaleTarget.style.height = "100%";
}

function readLocalCache() {
  try {
    return JSON.parse(localStorage.getItem(localCacheKey)) || {};
  } catch {
    return {};
  }
}

function writeLocalCache() {
  localStorage.setItem(localCacheKey, JSON.stringify(state));
}

function showStatus(message, type = "success") {
  statusBar.textContent = message;
  statusBar.className = `status-bar ${type}`;
  statusBar.classList.remove("hidden");
  fitTableLayout();
}

function formatError(error) {
  const code = error?.code ? `${error.code}: ` : "";
  const message = error?.message || String(error || "Unknown error");
  return `${code}${message}`.replace(/^FirebaseError:\s*/i, "");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
