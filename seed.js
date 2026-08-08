const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, 'data', 'db.json');

const DISHES = [
  { name: 'Mercimek Çorbası', category: 'Çorba', cost: [8, 11], popularity: 0.9 },
  { name: 'Ezogelin Çorbası', category: 'Çorba', cost: [8, 11], popularity: 0.85 },
  { name: 'Yayla Çorbası', category: 'Çorba', cost: [7, 10], popularity: 0.6 },
  { name: 'Tavuk Sote', category: 'Ana Yemek', cost: [22, 28], popularity: 0.92 },
  { name: 'Izgara Köfte', category: 'Ana Yemek', cost: [26, 32], popularity: 0.95 },
  { name: 'Kuru Fasulye', category: 'Ana Yemek', cost: [14, 18], popularity: 0.8 },
  { name: 'Nohut Yemeği', category: 'Ana Yemek', cost: [12, 16], popularity: 0.55 },
  { name: 'Karnıyarık', category: 'Ana Yemek', cost: [20, 25], popularity: 0.7 },
  { name: 'Etli Kuru Fasulye', category: 'Ana Yemek', cost: [24, 30], popularity: 0.88 },
  { name: 'Balık Izgara', category: 'Ana Yemek', cost: [30, 38], popularity: 0.5 },
  { name: 'Mantı', category: 'Ana Yemek', cost: [22, 27], popularity: 0.65 },
  { name: 'Sebze Türlü', category: 'Ana Yemek', cost: [10, 14], popularity: 0.35 },
  { name: 'Pirinç Pilavı', category: 'Yardımcı', cost: [6, 8], popularity: 0.9 },
  { name: 'Bulgur Pilavı', category: 'Yardımcı', cost: [5, 7], popularity: 0.75 },
  { name: 'Makarna', category: 'Yardımcı', cost: [6, 9], popularity: 0.82 },
  { name: 'Mevsim Salata', category: 'Salata', cost: [5, 7], popularity: 0.6 },
  { name: 'Cacık', category: 'Salata', cost: [4, 6], popularity: 0.45 },
  { name: 'Ayran', category: 'İçecek', cost: [3, 4], popularity: 0.88 },
  { name: 'Sütlaç', category: 'Tatlı', cost: [9, 12], popularity: 0.7 },
  { name: 'Kemalpaşa Tatlısı', category: 'Tatlı', cost: [10, 13], popularity: 0.4 },
  { name: 'Meyve', category: 'Tatlı', cost: [6, 9], popularity: 0.5 },
  { name: 'Lahmacun', category: 'Ana Yemek', cost: [18, 22], popularity: 0.3 },
];

function rand(min, max) {
  return Math.random() * (max - min) + min;
}
function randInt(min, max) {
  return Math.floor(rand(min, max + 1));
}
function pick(arr, n) {
  const copy = [...arr];
  const out = [];
  for (let i = 0; i < n && copy.length; i++) {
    out.push(copy.splice(randInt(0, copy.length - 1), 1)[0]);
  }
  return out;
}

const days = [];
const today = new Date();
const NUM_DAYS = 30;

for (let i = NUM_DAYS - 1; i >= 0; i--) {
  const date = new Date(today);
  date.setDate(date.getDate() - i);
  const dow = date.getDay();
  if (dow === 0 || dow === 6) continue; // hafta sonu yemekhane kapalı

  const dateStr = date.toISOString().slice(0, 10);
  const studentCount = randInt(700, 1000);

  const soup = pick(DISHES.filter((d) => d.category === 'Çorba'), 1);
  const main = pick(DISHES.filter((d) => d.category === 'Ana Yemek'), 1);
  const side = pick(DISHES.filter((d) => d.category === 'Yardımcı'), 1);
  const salad = pick(DISHES.filter((d) => d.category === 'Salata' || d.category === 'İçecek'), 1);
  const dessert = pick(DISHES.filter((d) => d.category === 'Tatlı'), 1);

  const todaysDishes = [...soup, ...main, ...side, ...salad, ...dessert];

  const meals = todaysDishes.map((dish) => {
    const plannedPortion = Math.round(studentCount * rand(0.85, 1.05));
    const consumedPortion = Math.round(plannedPortion * dish.popularity * rand(0.85, 1.05));
    const consumedClamped = Math.min(consumedPortion, plannedPortion);
    const wastePortion = plannedPortion - consumedClamped;
    const wasteKg = round2(wastePortion * rand(0.18, 0.32));
    const unitCost = round2(rand(dish.cost[0], dish.cost[1]));
    return {
      dishName: dish.name,
      category: dish.category,
      plannedPortion,
      consumedPortion: consumedClamped,
      wasteKg,
      unitCost,
    };
  });

  days.push({
    id: crypto.randomUUID(),
    date: dateStr,
    studentCount,
    meals,
  });
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

fs.writeFileSync(DB_PATH, JSON.stringify({ days }, null, 2), 'utf-8');
console.log(`${days.length} günlük örnek veri oluşturuldu -> ${DB_PATH}`);
