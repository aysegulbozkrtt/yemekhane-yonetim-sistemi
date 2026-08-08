const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'data', 'db.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function readDb() {
  const raw = fs.readFileSync(DB_PATH, 'utf-8');
  return JSON.parse(raw);
}

function writeDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
}

function computeMealDerived(meal) {
  const wastePortion = Math.max(0, (meal.plannedPortion || 0) - (meal.consumedPortion || 0));
  const totalCost = round2((meal.plannedPortion || 0) * (meal.unitCost || 0));
  const wastedCost = round2(wastePortion * (meal.unitCost || 0));
  return { ...meal, wastePortion, totalCost, wastedCost };
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function enrichDay(day) {
  const meals = (day.meals || []).map(computeMealDerived);
  const dayTotalCost = round2(meals.reduce((s, m) => s + m.totalCost, 0));
  const dayWastedCost = round2(meals.reduce((s, m) => s + m.wastedCost, 0));
  const dayWasteKg = round2(meals.reduce((s, m) => s + (m.wasteKg || 0), 0));
  const dayConsumed = meals.reduce((s, m) => s + (m.consumedPortion || 0), 0);
  const dayPlanned = meals.reduce((s, m) => s + (m.plannedPortion || 0), 0);
  return { ...day, meals, dayTotalCost, dayWastedCost, dayWasteKg, dayConsumed, dayPlanned };
}

// ---- Days CRUD ----

app.get('/api/days', (req, res) => {
  const db = readDb();
  const days = db.days.map(enrichDay).sort((a, b) => a.date.localeCompare(b.date));
  res.json(days);
});

app.get('/api/days/:id', (req, res) => {
  const db = readDb();
  const day = db.days.find((d) => d.id === req.params.id);
  if (!day) return res.status(404).json({ error: 'Kayıt bulunamadı' });
  res.json(enrichDay(day));
});

app.post('/api/days', (req, res) => {
  const db = readDb();
  const { date, studentCount, meals } = req.body;
  if (!date) return res.status(400).json({ error: 'Tarih zorunludur' });
  if (db.days.some((d) => d.date === date)) {
    return res.status(409).json({ error: 'Bu tarih için zaten bir kayıt var' });
  }
  const newDay = {
    id: crypto.randomUUID(),
    date,
    studentCount: Number(studentCount) || 0,
    meals: Array.isArray(meals) ? meals : [],
  };
  db.days.push(newDay);
  writeDb(db);
  res.status(201).json(enrichDay(newDay));
});

app.put('/api/days/:id', (req, res) => {
  const db = readDb();
  const idx = db.days.findIndex((d) => d.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Kayıt bulunamadı' });
  const { date, studentCount, meals } = req.body;
  db.days[idx] = {
    ...db.days[idx],
    date: date ?? db.days[idx].date,
    studentCount: studentCount !== undefined ? Number(studentCount) : db.days[idx].studentCount,
    meals: Array.isArray(meals) ? meals : db.days[idx].meals,
  };
  writeDb(db);
  res.json(enrichDay(db.days[idx]));
});

app.delete('/api/days/:id', (req, res) => {
  const db = readDb();
  const idx = db.days.findIndex((d) => d.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Kayıt bulunamadı' });
  db.days.splice(idx, 1);
  writeDb(db);
  res.status(204).end();
});

// ---- Dish catalog (for autocomplete) ----

app.get('/api/dishes', (req, res) => {
  const db = readDb();
  const map = new Map();
  db.days.forEach((d) => {
    (d.meals || []).forEach((m) => {
      if (!map.has(m.dishName)) map.set(m.dishName, m.category || 'Diğer');
    });
  });
  const dishes = Array.from(map.entries()).map(([dishName, category]) => ({ dishName, category }));
  dishes.sort((a, b) => a.dishName.localeCompare(b.dishName, 'tr'));
  res.json(dishes);
});

// ---- Analysis ----

app.get('/api/analysis', (req, res) => {
  const db = readDb();
  const days = db.days.map(enrichDay).sort((a, b) => a.date.localeCompare(b.date));

  const dishStats = new Map();
  days.forEach((day) => {
    day.meals.forEach((m) => {
      if (!dishStats.has(m.dishName)) {
        dishStats.set(m.dishName, {
          dishName: m.dishName,
          category: m.category || 'Diğer',
          totalPlanned: 0,
          totalConsumed: 0,
          totalWastePortion: 0,
          totalWasteKg: 0,
          totalCost: 0,
          totalWastedCost: 0,
          appearances: 0,
        });
      }
      const s = dishStats.get(m.dishName);
      s.totalPlanned += m.plannedPortion || 0;
      s.totalConsumed += m.consumedPortion || 0;
      s.totalWastePortion += m.wastePortion || 0;
      s.totalWasteKg += m.wasteKg || 0;
      s.totalCost += m.totalCost || 0;
      s.totalWastedCost += m.wastedCost || 0;
      s.appearances += 1;
    });
  });

  const dishArr = Array.from(dishStats.values()).map((d) => ({
    ...d,
    totalCost: round2(d.totalCost),
    totalWastedCost: round2(d.totalWastedCost),
    totalWasteKg: round2(d.totalWasteKg),
    consumptionRate: d.totalPlanned > 0 ? round2((d.totalConsumed / d.totalPlanned) * 100) : 0,
  }));

  const mostConsumed = [...dishArr].sort((a, b) => b.totalConsumed - a.totalConsumed).slice(0, 5);
  const leastConsumed = [...dishArr].sort((a, b) => a.totalConsumed - b.totalConsumed).slice(0, 5);
  const mostWasted = [...dishArr].sort((a, b) => b.totalWasteKg - a.totalWasteKg).slice(0, 5);

  const totalCost = round2(days.reduce((s, d) => s + d.dayTotalCost, 0));
  const totalWastedCost = round2(days.reduce((s, d) => s + d.dayWastedCost, 0));
  const totalWasteKg = round2(days.reduce((s, d) => s + d.dayWasteKg, 0));
  const totalStudents = days.reduce((s, d) => s + (d.studentCount || 0), 0);
  const avgStudents = days.length ? Math.round(totalStudents / days.length) : 0;
  const totalConsumed = days.reduce((s, d) => s + d.dayConsumed, 0);
  const totalPlanned = days.reduce((s, d) => s + d.dayPlanned, 0);
  const overallConsumptionRate = totalPlanned > 0 ? round2((totalConsumed / totalPlanned) * 100) : 0;

  const trend = days.map((d) => ({
    date: d.date,
    studentCount: d.studentCount,
    totalCost: d.dayTotalCost,
    wastedCost: d.dayWastedCost,
    wasteKg: d.dayWasteKg,
    consumed: d.dayConsumed,
    planned: d.dayPlanned,
  }));

  res.json({
    summary: {
      totalDays: days.length,
      avgStudents,
      totalCost,
      totalWastedCost,
      totalWasteKg,
      overallConsumptionRate,
    },
    mostConsumed,
    leastConsumed,
    mostWasted,
    trend,
  });
});

app.listen(PORT, () => {
  console.log(`Yemekhane Yönetim Sistemi http://localhost:${PORT} adresinde çalışıyor`);
});
