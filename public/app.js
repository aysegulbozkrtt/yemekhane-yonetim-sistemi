const API = '/api';
const CATEGORIES = ['Çorba', 'Ana Yemek', 'Yardımcı', 'Salata', 'İçecek', 'Tatlı', 'Diğer'];
const money = (n) => `₺${(n || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const num = (n) => (n || 0).toLocaleString('tr-TR');
const fmtDate = (d) => new Date(d + 'T00:00:00').toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric', weekday: 'long' });

let state = { days: [], analysis: null, dishes: [] };
let charts = {};

// ---------------- Navigation ----------------

const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');
const hamburgerBtn = document.getElementById('hamburgerBtn');

function openSidebar() {
  sidebar.classList.add('open');
  overlay.classList.add('show');
  hamburgerBtn.classList.add('open');
}
function closeSidebar() {
  sidebar.classList.remove('open');
  overlay.classList.remove('show');
  hamburgerBtn.classList.remove('open');
}
hamburgerBtn.addEventListener('click', () => {
  sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
});
overlay.addEventListener('click', closeSidebar);

document.querySelectorAll('.nav-link').forEach((link) => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const view = link.dataset.view;
    location.hash = view;
    closeSidebar();
  });
});

function showView(name) {
  document.querySelectorAll('.view').forEach((v) => v.classList.add('hidden'));
  const target = document.getElementById('view-' + name);
  if (!target) return;
  target.classList.remove('hidden');
  document.querySelectorAll('.nav-link').forEach((l) => l.classList.toggle('active', l.dataset.view === name));
  renderView(name);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderView(name) {
  if (name === 'dashboard') renderDashboard();
  else if (name === 'menu') renderMenu();
  else if (name === 'students') renderStudents();
  else if (name === 'consumption') renderConsumption();
  else if (name === 'cost') renderCost();
  else if (name === 'analysis') renderAnalysis();
}

window.addEventListener('hashchange', () => {
  const view = location.hash.replace('#', '') || 'dashboard';
  showView(view);
});

document.getElementById('topbarDate').textContent = new Date().toLocaleDateString('tr-TR', {
  day: '2-digit', month: 'long', year: 'numeric',
});

// ---------------- Data loading ----------------

async function loadAll() {
  const [daysRes, analysisRes, dishesRes] = await Promise.all([
    fetch(`${API}/days`), fetch(`${API}/analysis`), fetch(`${API}/dishes`),
  ]);
  state.days = await daysRes.json();
  state.analysis = await analysisRes.json();
  state.dishes = await dishesRes.json();
}

async function refresh() {
  await loadAll();
  const view = location.hash.replace('#', '') || 'dashboard';
  renderView(view);
}

function destroyChart(key) {
  if (charts[key]) { charts[key].destroy(); delete charts[key]; }
}

function statCard(icon, value, label) {
  return `<div class="stat-card"><span class="stat-icon">${icon}</span><div class="stat-value">${value}</div><div class="stat-label">${label}</div></div>`;
}

// ---------------- Dashboard ----------------

function renderDashboard() {
  const a = state.analysis;
  if (!a) return;
  const s = a.summary;
  document.getElementById('dashboardStats').innerHTML = [
    statCard('📅', s.totalDays, 'Kayıtlı Gün'),
    statCard('🎓', num(s.avgStudents), 'Ortalama Öğrenci / Gün'),
    statCard('💰', money(s.totalCost), 'Toplam Maliyet'),
    statCard('🗑️', `${num(s.totalWasteKg)} kg`, 'Toplam İsraf'),
    statCard('📈', `%${s.overallConsumptionRate}`, 'Genel Tüketim Oranı'),
    statCard('💸', money(s.totalWastedCost), 'İsraf Kaynaklı Kayıp'),
  ].join('');

  const trend = a.trend.slice(-14);
  destroyChart('costTrend');
  charts.costTrend = new Chart(document.getElementById('chartCostTrend'), {
    type: 'line',
    data: {
      labels: trend.map((t) => t.date.slice(5)),
      datasets: [
        { label: 'Toplam Maliyet (₺)', data: trend.map((t) => t.totalCost), borderColor: '#ff7a3d', backgroundColor: 'rgba(255,122,61,0.15)', tension: 0.35, fill: true },
        { label: 'İsraf Maliyeti (₺)', data: trend.map((t) => t.wastedCost), borderColor: '#e0554b', backgroundColor: 'rgba(224,85,75,0.1)', tension: 0.35, fill: true },
      ],
    },
    options: chartOpts(),
  });

  destroyChart('consumptionTrend');
  charts.consumptionTrend = new Chart(document.getElementById('chartConsumptionTrend'), {
    type: 'bar',
    data: {
      labels: trend.map((t) => t.date.slice(5)),
      datasets: [
        { label: 'Hazırlanan', data: trend.map((t) => t.planned), backgroundColor: '#e6dfd6' },
        { label: 'Tüketilen', data: trend.map((t) => t.consumed), backgroundColor: '#2f9e64' },
      ],
    },
    options: chartOpts(),
  });

  document.getElementById('dashTopDishes').innerHTML = a.mostConsumed
    .map((d) => `<li><span>${d.dishName}</span><span class="rl-count">${num(d.totalConsumed)} porsiyon</span></li>`).join('') || '<li>Veri yok</li>';
  document.getElementById('dashLowDishes').innerHTML = a.leastConsumed
    .map((d) => `<li><span>${d.dishName}</span><span class="rl-count">${num(d.totalConsumed)} porsiyon</span></li>`).join('') || '<li>Veri yok</li>';
}

function chartOpts(extra = {}) {
  return {
    responsive: true,
    plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } },
    scales: { y: { beginAtZero: true } },
    ...extra,
  };
}

// ---------------- Menu (CRUD) ----------------

function renderMenu() {
  const list = [...state.days].sort((a, b) => b.date.localeCompare(a.date));
  const container = document.getElementById('dayList');
  if (!list.length) {
    container.innerHTML = '<div class="empty-state">Henüz kayıt yok. "Yeni Gün Ekle" ile başlayın.</div>';
    return;
  }
  container.innerHTML = list.map((d) => `
    <div class="day-card">
      <div class="day-card-header">
        <div>
          <div class="day-card-title">${fmtDate(d.date)}</div>
          <div class="day-card-meta">🎓 ${num(d.studentCount)} öğrenci · 💰 ${money(d.dayTotalCost)} · 🗑️ ${num(d.dayWasteKg)} kg israf</div>
        </div>
        <div class="day-card-actions">
          <button class="btn-icon" onclick="editDay('${d.id}')">✏️ Düzenle</button>
          <button class="btn-icon" onclick="deleteDay('${d.id}')">🗑️ Sil</button>
        </div>
      </div>
      <div class="meal-pill-list">
        ${d.meals.map((m) => `<span class="meal-pill">${m.dishName} · ${num(m.consumedPortion)}/${num(m.plannedPortion)} porsiyon</span>`).join('') || '<em>Yemek eklenmemiş</em>'}
      </div>
    </div>
  `).join('');
}

document.getElementById('btnNewDay').addEventListener('click', () => openDayForm());
document.getElementById('btnCancelDay').addEventListener('click', () => closeDayForm());
document.getElementById('btnAddMeal').addEventListener('click', () => addMealRow());

function openDayForm(day = null) {
  document.getElementById('dayFormPanel').classList.remove('hidden');
  document.getElementById('dayFormTitle').textContent = day ? 'Günü Düzenle' : 'Yeni Gün Kaydı';
  document.getElementById('dayId').value = day ? day.id : '';
  document.getElementById('dayDate').value = day ? day.date : new Date().toISOString().slice(0, 10);
  document.getElementById('dayStudentCount').value = day ? day.studentCount : '';
  document.getElementById('mealsContainer').innerHTML = '';
  if (day && day.meals.length) {
    day.meals.forEach((m) => addMealRow(m));
  } else {
    addMealRow();
  }
  document.getElementById('dayFormPanel').scrollIntoView({ behavior: 'smooth' });
}

function closeDayForm() {
  document.getElementById('dayFormPanel').classList.add('hidden');
  document.getElementById('dayForm').reset();
}

function addMealRow(meal = null) {
  const wrap = document.createElement('div');
  wrap.className = 'meal-row';
  const dishOptions = state.dishes.map((d) => d.dishName);
  wrap.innerHTML = `
    <label>Yemek Adı
      <input type="text" class="m-name" list="dishNames" value="${meal ? meal.dishName : ''}" required />
    </label>
    <label>Kategori
      <select class="m-category">
        ${CATEGORIES.map((c) => `<option value="${c}" ${meal && meal.category === c ? 'selected' : ''}>${c}</option>`).join('')}
      </select>
    </label>
    <label>Hazırlanan (porsiyon)
      <input type="number" class="m-planned" min="0" value="${meal ? meal.plannedPortion : ''}" required />
    </label>
    <label>Tüketilen (porsiyon)
      <input type="number" class="m-consumed" min="0" value="${meal ? meal.consumedPortion : ''}" required />
    </label>
    <label>İsraf (kg)
      <input type="number" step="0.01" class="m-waste" min="0" value="${meal ? meal.wasteKg : ''}" required />
    </label>
    <label>Birim Maliyet (₺)
      <input type="number" step="0.01" class="m-cost" min="0" value="${meal ? meal.unitCost : ''}" required />
    </label>
    <button type="button" class="btn-icon" onclick="this.closest('.meal-row').remove()">✖</button>
  `;
  document.getElementById('mealsContainer').appendChild(wrap);
  if (!document.getElementById('dishNames')) {
    const dl = document.createElement('datalist');
    dl.id = 'dishNames';
    dl.innerHTML = dishOptions.map((n) => `<option value="${n}">`).join('');
    document.body.appendChild(dl);
  }
}

document.getElementById('dayForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('dayId').value;
  const date = document.getElementById('dayDate').value;
  const studentCount = Number(document.getElementById('dayStudentCount').value);
  const meals = [...document.querySelectorAll('.meal-row')].map((row) => ({
    dishName: row.querySelector('.m-name').value.trim(),
    category: row.querySelector('.m-category').value,
    plannedPortion: Number(row.querySelector('.m-planned').value) || 0,
    consumedPortion: Number(row.querySelector('.m-consumed').value) || 0,
    wasteKg: Number(row.querySelector('.m-waste').value) || 0,
    unitCost: Number(row.querySelector('.m-cost').value) || 0,
  })).filter((m) => m.dishName);

  const payload = { date, studentCount, meals };
  const url = id ? `${API}/days/${id}` : `${API}/days`;
  const method = id ? 'PUT' : 'POST';
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    alert(err.error || 'Kayıt sırasında bir hata oluştu');
    return;
  }
  closeDayForm();
  await refresh();
  renderMenu();
});

window.editDay = async (id) => {
  const day = state.days.find((d) => d.id === id);
  openDayForm(day);
};

window.deleteDay = async (id) => {
  if (!confirm('Bu günü silmek istediğinize emin misiniz?')) return;
  await fetch(`${API}/days/${id}`, { method: 'DELETE' });
  await refresh();
  renderMenu();
};

// ---------------- Students ----------------

function renderStudents() {
  const days = [...state.days].sort((a, b) => a.date.localeCompare(b.date));
  const counts = days.map((d) => d.studentCount);
  const max = counts.length ? Math.max(...counts) : 0;
  const min = counts.length ? Math.min(...counts) : 0;
  const avg = counts.length ? Math.round(counts.reduce((a, b) => a + b, 0) / counts.length) : 0;

  document.getElementById('studentStats').innerHTML = [
    statCard('📈', num(max), 'En Yüksek Katılım'),
    statCard('📉', num(min), 'En Düşük Katılım'),
    statCard('📊', num(avg), 'Ortalama Katılım'),
    statCard('📅', days.length, 'Toplam Kayıt'),
  ].join('');

  destroyChart('students');
  const recent = days.slice(-20);
  charts.students = new Chart(document.getElementById('chartStudents'), {
    type: 'line',
    data: {
      labels: recent.map((d) => d.date.slice(5)),
      datasets: [{ label: 'Öğrenci Sayısı', data: recent.map((d) => d.studentCount), borderColor: '#2f9e64', backgroundColor: 'rgba(47,158,100,0.15)', tension: 0.3, fill: true }],
    },
    options: chartOpts(),
  });

  const table = document.getElementById('studentTable');
  table.innerHTML = `
    <thead><tr><th>Tarih</th><th>Öğrenci Sayısı</th><th>Hazırlanan Porsiyon</th><th>Tüketilen Porsiyon</th><th>Katılım / Porsiyon Oranı</th></tr></thead>
    <tbody>
      ${[...days].reverse().map((d) => `
        <tr>
          <td>${fmtDate(d.date)}</td>
          <td>${num(d.studentCount)}</td>
          <td>${num(d.dayPlanned)}</td>
          <td>${num(d.dayConsumed)}</td>
          <td>${d.studentCount ? Math.round((d.dayConsumed / d.studentCount) * 100) : 0}%</td>
        </tr>`).join('')}
    </tbody>`;
}

// ---------------- Consumption & Waste ----------------

function renderConsumption() {
  const a = state.analysis;
  const days = [...state.days].sort((a2, b) => a2.date.localeCompare(b.date));
  const totalConsumed = days.reduce((s, d) => s + d.dayConsumed, 0);
  const totalWaste = days.reduce((s, d) => s + d.dayWasteKg, 0);
  const totalPlanned = days.reduce((s, d) => s + d.dayPlanned, 0);
  const rate = totalPlanned ? Math.round((totalConsumed / totalPlanned) * 100) : 0;

  document.getElementById('consumptionStats').innerHTML = [
    statCard('🍽️', num(totalConsumed), 'Toplam Tüketilen Porsiyon'),
    statCard('🥘', num(totalPlanned), 'Toplam Hazırlanan Porsiyon'),
    statCard('🗑️', `${num(Math.round(totalWaste * 10) / 10)} kg`, 'Toplam İsraf'),
    statCard('✅', `%${rate}`, 'Tüketim Oranı'),
  ].join('');

  const recent = days.slice(-14);
  destroyChart('consumption');
  charts.consumption = new Chart(document.getElementById('chartConsumption'), {
    type: 'bar',
    data: {
      labels: recent.map((d) => d.date.slice(5)),
      datasets: [{ label: 'Tüketilen Porsiyon', data: recent.map((d) => d.dayConsumed), backgroundColor: '#2f9e64' }],
    },
    options: chartOpts(),
  });

  destroyChart('waste');
  charts.waste = new Chart(document.getElementById('chartWaste'), {
    type: 'bar',
    data: {
      labels: recent.map((d) => d.date.slice(5)),
      datasets: [{ label: 'İsraf (kg)', data: recent.map((d) => d.dayWasteKg), backgroundColor: '#e0554b' }],
    },
    options: chartOpts(),
  });

  const dishArr = [...(a?.mostConsumed || []), ...(a?.leastConsumed || []), ...(a?.mostWasted || [])];
  const uniq = new Map();
  dishArr.forEach((d) => uniq.set(d.dishName, d));
  // Build full dish table from all days instead (more complete)
  const dishMap = new Map();
  days.forEach((d) => d.meals.forEach((m) => {
    if (!dishMap.has(m.dishName)) dishMap.set(m.dishName, { name: m.dishName, category: m.category, planned: 0, consumed: 0, waste: 0 });
    const e = dishMap.get(m.dishName);
    e.planned += m.plannedPortion; e.consumed += m.consumedPortion; e.waste += m.wasteKg;
  }));
  const rows = [...dishMap.values()].sort((x, y) => y.consumed - x.consumed);

  const table = document.getElementById('dishTable');
  table.innerHTML = `
    <thead><tr><th>Yemek</th><th>Kategori</th><th>Hazırlanan</th><th>Tüketilen</th><th>Tüketim Oranı</th><th>İsraf (kg)</th></tr></thead>
    <tbody>
      ${rows.map((r) => `
        <tr>
          <td>${r.name}</td><td>${r.category}</td><td>${num(r.planned)}</td><td>${num(r.consumed)}</td>
          <td>${r.planned ? Math.round((r.consumed / r.planned) * 100) : 0}%</td>
          <td>${(Math.round(r.waste * 10) / 10).toLocaleString('tr-TR')}</td>
        </tr>`).join('') || '<tr><td colspan="6" class="empty-state">Veri yok</td></tr>'}
    </tbody>`;
}

// ---------------- Cost ----------------

function renderCost() {
  const days = [...state.days].sort((a, b) => a.date.localeCompare(b.date));
  const totalCost = days.reduce((s, d) => s + d.dayTotalCost, 0);
  const totalWastedCost = days.reduce((s, d) => s + d.dayWastedCost, 0);
  const totalStudentDays = days.reduce((s, d) => s + d.studentCount, 0);
  const perStudent = totalStudentDays ? totalCost / totalStudentDays : 0;

  document.getElementById('costStats').innerHTML = [
    statCard('💰', money(totalCost), 'Toplam Maliyet'),
    statCard('💸', money(totalWastedCost), 'İsraf Kaynaklı Kayıp'),
    statCard('🧾', money(perStudent), 'Öğrenci Başı Maliyet'),
    statCard('📉', totalCost ? `%${Math.round((totalWastedCost / totalCost) * 100)}` : '%0', 'İsrafın Maliyet İçindeki Payı'),
  ].join('');

  const recent = days.slice(-14);
  destroyChart('cost');
  charts.cost = new Chart(document.getElementById('chartCost'), {
    type: 'line',
    data: {
      labels: recent.map((d) => d.date.slice(5)),
      datasets: [
        { label: 'Toplam Maliyet (₺)', data: recent.map((d) => d.dayTotalCost), borderColor: '#ff7a3d', backgroundColor: 'rgba(255,122,61,0.15)', tension: 0.3, fill: true },
        { label: 'İsraf Maliyeti (₺)', data: recent.map((d) => d.dayWastedCost), borderColor: '#e0554b', backgroundColor: 'rgba(224,85,75,0.15)', tension: 0.3, fill: true },
      ],
    },
    options: chartOpts(),
  });

  const dishMap = new Map();
  days.forEach((d) => d.meals.forEach((m) => {
    if (!dishMap.has(m.dishName)) dishMap.set(m.dishName, { name: m.dishName, cost: 0, wastedCost: 0, unitCosts: [] });
    const e = dishMap.get(m.dishName);
    e.cost += m.totalCost; e.wastedCost += m.wastedCost; e.unitCosts.push(m.unitCost);
  }));
  const rows = [...dishMap.values()].sort((x, y) => y.cost - x.cost);
  const table = document.getElementById('costTable');
  table.innerHTML = `
    <thead><tr><th>Yemek</th><th>Ort. Birim Maliyet</th><th>Toplam Maliyet</th><th>İsraf Maliyeti</th></tr></thead>
    <tbody>
      ${rows.map((r) => `
        <tr>
          <td>${r.name}</td>
          <td>${money(r.unitCosts.reduce((a, b) => a + b, 0) / r.unitCosts.length)}</td>
          <td>${money(r.cost)}</td>
          <td>${money(r.wastedCost)}</td>
        </tr>`).join('') || '<tr><td colspan="4" class="empty-state">Veri yok</td></tr>'}
    </tbody>`;
}

// ---------------- Analysis ----------------

function renderAnalysis() {
  const a = state.analysis;
  if (!a) return;

  destroyChart('mostConsumed');
  charts.mostConsumed = new Chart(document.getElementById('chartMostConsumed'), {
    type: 'bar',
    data: { labels: a.mostConsumed.map((d) => d.dishName), datasets: [{ label: 'Tüketilen Porsiyon', data: a.mostConsumed.map((d) => d.totalConsumed), backgroundColor: '#2f9e64' }] },
    options: { ...chartOpts(), indexAxis: 'y' },
  });

  destroyChart('leastConsumed');
  charts.leastConsumed = new Chart(document.getElementById('chartLeastConsumed'), {
    type: 'bar',
    data: { labels: a.leastConsumed.map((d) => d.dishName), datasets: [{ label: 'Tüketilen Porsiyon', data: a.leastConsumed.map((d) => d.totalConsumed), backgroundColor: '#e0554b' }] },
    options: { ...chartOpts(), indexAxis: 'y' },
  });

  destroyChart('mostWasted');
  charts.mostWasted = new Chart(document.getElementById('chartMostWasted'), {
    type: 'bar',
    data: { labels: a.mostWasted.map((d) => d.dishName), datasets: [{ label: 'İsraf (kg)', data: a.mostWasted.map((d) => d.totalWasteKg), backgroundColor: '#c77b2e' }] },
    options: chartOpts(),
  });

  const days = state.days;
  const dishMap = new Map();
  days.forEach((d) => d.meals.forEach((m) => {
    if (!dishMap.has(m.dishName)) dishMap.set(m.dishName, { name: m.dishName, category: m.category, planned: 0, consumed: 0, waste: 0, cost: 0 });
    const e = dishMap.get(m.dishName);
    e.planned += m.plannedPortion; e.consumed += m.consumedPortion; e.waste += m.wasteKg; e.cost += m.totalCost;
  }));
  const rows = [...dishMap.values()].sort((x, y) => y.consumed - x.consumed);
  const table = document.getElementById('analysisTable');
  table.innerHTML = `
    <thead><tr><th>Sıra</th><th>Yemek</th><th>Kategori</th><th>Tüketim Oranı</th><th>Toplam Tüketilen</th><th>Toplam İsraf (kg)</th><th>Toplam Maliyet</th></tr></thead>
    <tbody>
      ${rows.map((r, i) => `
        <tr>
          <td>${i + 1}</td><td>${r.name}</td><td>${r.category}</td>
          <td>${r.planned ? Math.round((r.consumed / r.planned) * 100) : 0}%</td>
          <td>${num(r.consumed)}</td>
          <td>${(Math.round(r.waste * 10) / 10).toLocaleString('tr-TR')}</td>
          <td>${money(r.cost)}</td>
        </tr>`).join('') || '<tr><td colspan="7" class="empty-state">Veri yok</td></tr>'}
    </tbody>`;
}

// ---------------- Init ----------------

(async function init() {
  await loadAll();
  const view = location.hash.replace('#', '') || 'dashboard';
  showView(view);
})();
