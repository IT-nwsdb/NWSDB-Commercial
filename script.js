const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const schema = [
  {
    section: 'Number of Connections',
    rows: [
      { id: 'number_domestic', metric: 'Domestic' },
      { id: 'number_non_domestic', metric: 'Non Domestic' },
      { id: 'number_total', metric: 'Total' }
    ]
  },
  {
    section: 'New Connection',
    rows: [
      { id: 'new_connection_given', metric: 'Number of connection given in the month' },
      { id: 'new_connection_payment_pending', metric: 'New connection payment done not yet give conn' },
      { id: 'new_connection_first_bill', metric: '1st bill not issued (Todate)' }
    ]
  },
  {
    section: 'Monthly billing & collection Performance',
    rows: [
      { id: 'monthly_quantity_sold_m3', metric: 'Quantity Sold M3' },
      { id: 'monthly_actual_billing', metric: 'Actual billing Rs Million' },
      { id: 'monthly_actual_collection', metric: 'Actual collection Rs Million' },
      { id: 'monthly_collection_efficiency', metric: 'Collection Efficiency (Monthly)%' }
    ]
  },
  {
    section: 'Cummulative billing & collection Performance',
    rows: [
      { id: 'cumulative_quantity_sold', metric: 'Quantity Sold' },
      { id: 'cumulative_billing', metric: 'Billing Rs Million' },
      { id: 'cumulative_collection', metric: 'Collection Rs Million' },
      { id: 'cumulative_collection_efficiency', metric: 'Collection Efficiency (Cummulative)%' }
    ]
  },
  {
    section: 'Arrears',
    rows: [
      { id: 'arrears_without_dc_sp', metric: 'Arrears Without DC/SP' },
      { id: 'arrears_total', metric: 'Total Arrears' },
      { id: 'debt_age_without_current_month', metric: 'Debt Age (without current month)' }
    ]
  },
  {
    section: 'Other Performence',
    rows: [
      { id: 'inactive_accounts', metric: 'Inactive accounts' },
      { id: 'meter_reader_interval', metric: 'Meter reader interval (29,30,31)%' },
      { id: 'mobile_update', metric: 'Mobile update%' },
      { id: 'email_update', metric: 'Email update%' },
      { id: 'gnd_entered', metric: 'GND Entered%' },
      { id: 'consumer_payment_pattern', metric: 'Consumer payment pattern%' },
      { id: 'over_6_months_n_zero', metric: 'Over 6 months N Zero%' },
      { id: 'over_6_months_e_zero', metric: 'Over 6 months E Zero%' },
      { id: 'continuous_over_01_years', metric: 'Continuous Over 01 Years Estimated Bills Due To Defective Meters (Code 05)' },
      { id: 'complaints_outstanding', metric: 'Status Of Complaints Received to H/O (outstanding.)%' },
      { id: 'average_revenue_per_connection', metric: 'Average revenue for connection (Rs / 1 unit)%' },
      { id: 'consumer_file_update', metric: 'Consumer File Update' }
    ]
  }
];

const flatRows = schema.flatMap((group) => group.rows.map((row) => row.id));
const storageKey = 'overall_commercial_performance_clear_table_v2';
let allData = readData();
let currentRegion = '';

const loadingScreen = document.getElementById('loadingScreen');
const app = document.getElementById('app');
const selectionView = document.getElementById('selectionView');
const tableView = document.getElementById('tableView');
const regionSelect = document.getElementById('regionSelect');
const yearInput = document.getElementById('yearInput');
const nextBtn = document.getElementById('nextBtn');
const backBtn = document.getElementById('backBtn');
const saveBtn = document.getElementById('saveBtn');
const resetBtn = document.getElementById('resetBtn');
const saveMessage = document.getElementById('saveMessage');
const regionLabel = document.getElementById('regionLabel');
const tableHead = document.getElementById('tableHead');
const tableBody = document.getElementById('tableBody');

window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    loadingScreen.classList.add('d-none');
    app.classList.remove('d-none');
  }, 2000);
});

yearInput.addEventListener('change', () => {
  if (!tableView.classList.contains('d-none')) {
    renderTable();
  }
});

nextBtn.addEventListener('click', () => {
  const region = regionSelect.value;
  if (!region) {
    alert('Please select a region.');
    return;
  }

  currentRegion = region;
  openTable();
});

backBtn.addEventListener('click', () => {
  tableView.classList.add('d-none');
  selectionView.classList.remove('d-none');
  hideMessage();
});

saveBtn.addEventListener('click', () => {
  persistData();
  showMessage('Data saved successfully.');
});

resetBtn.addEventListener('click', () => {
  if (!currentRegion) return;

  const confirmed = window.confirm(`Delete all saved data for ${currentRegion}?`);
  if (!confirmed) return;

  delete allData[currentRegion];
  persistData();
  renderTable();
  showMessage(`${currentRegion} data reset successfully.`);
});

function openTable() {
  selectionView.classList.add('d-none');
  tableView.classList.remove('d-none');
  renderTable();
}

function renderTable() {
  const year = yearInput.value || '2025';
  const regionData = getRegionData(currentRegion);

  regionLabel.textContent = `${currentRegion} - ${year}`;

  tableHead.innerHTML = `
    <tr class="title-row">
      <th colspan="14">RSC- ${escapeHtml(currentRegion)} Overall Commercial Performance</th>
    </tr>
    <tr>
      <th colspan="2">${escapeHtml(String(year))}</th>
      ${months.map((month) => `<th>${month}</th>`).join('')}
    </tr>
  `;

  let html = '';

  schema.forEach((group) => {
    group.rows.forEach((row, index) => {
      html += '<tr>';

      if (index === 0) {
        html += `<td class="section-cell" rowspan="${group.rows.length}">${escapeHtml(group.section)}</td>`;
      }

      html += `<td class="metric-cell">${escapeHtml(row.metric)}</td>`;

      months.forEach((month) => {
        const value = regionData[row.id]?.[month] ?? '';
        html += `
          <td class="month-cell">
            <input
              type="text"
              class="form-control table-input"
              data-row="${row.id}"
              data-month="${month}"
              value="${escapeHtml(value)}"
              autocomplete="off"
            >
          </td>
        `;
      });

      html += '</tr>';
    });
  });

  tableBody.innerHTML = html;
  attachInputEvents();
}

function attachInputEvents() {
  const inputs = document.querySelectorAll('.table-input');

  inputs.forEach((input) => {
    input.addEventListener('input', (event) => {
      const rowId = event.target.dataset.row;
      const month = event.target.dataset.month;
      const value = event.target.value;

      if (!allData[currentRegion]) {
        allData[currentRegion] = {};
      }

      if (!allData[currentRegion][rowId]) {
        allData[currentRegion][rowId] = {};
      }

      allData[currentRegion][rowId][month] = value;
      persistData();
      hideMessage();
    });

    input.addEventListener('focus', (event) => {
      event.target.select();
    });

    input.addEventListener('keydown', handleArrowNavigation);
  });
}

function handleArrowNavigation(event) {
  const allowedKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
  if (!allowedKeys.includes(event.key)) {
    return;
  }

  const rowId = event.target.dataset.row;
  const month = event.target.dataset.month;
  const rowIndex = flatRows.indexOf(rowId);
  const monthIndex = months.indexOf(month);

  if (rowIndex === -1 || monthIndex === -1) {
    return;
  }

  let nextRowIndex = rowIndex;
  let nextMonthIndex = monthIndex;

  if (event.key === 'ArrowUp') nextRowIndex -= 1;
  if (event.key === 'ArrowDown') nextRowIndex += 1;
  if (event.key === 'ArrowLeft') nextMonthIndex -= 1;
  if (event.key === 'ArrowRight') nextMonthIndex += 1;

  if (nextRowIndex < 0 || nextRowIndex >= flatRows.length) {
    return;
  }

  if (nextMonthIndex < 0 || nextMonthIndex >= months.length) {
    return;
  }

  const nextInput = document.querySelector(
    `.table-input[data-row="${flatRows[nextRowIndex]}"][data-month="${months[nextMonthIndex]}"]`
  );

  if (!nextInput) {
    return;
  }

  event.preventDefault();
  nextInput.focus();
  nextInput.select();
}

function getRegionData(region) {
  if (!allData[region]) {
    allData[region] = {};
  }
  return allData[region];
}

function persistData() {
  localStorage.setItem(storageKey, JSON.stringify(allData));
}

function readData() {
  try {
    return JSON.parse(localStorage.getItem(storageKey)) || {};
  } catch (error) {
    return {};
  }
}

function showMessage(message) {
  saveMessage.textContent = message;
  saveMessage.classList.remove('d-none');
}

function hideMessage() {
  saveMessage.classList.add('d-none');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
