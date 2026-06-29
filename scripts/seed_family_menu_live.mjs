const endpoint = process.env.APPS_SCRIPT_ENDPOINT || process.env.VITE_APPS_SCRIPT_ENDPOINT;
const token = process.env.API_TOKEN || process.env.VITE_API_TOKEN || '';

if (!endpoint) {
  console.error('Missing APPS_SCRIPT_ENDPOINT or VITE_APPS_SCRIPT_ENDPOINT');
  process.exit(2);
}

const now = new Date().toISOString();

async function call(action, payload = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, token, payload }),
      });
      const text = await response.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error(`${action}: non-JSON response HTTP ${response.status}: ${text.slice(0, 300)}`);
      }
      if (!json.ok) throw new Error(`${action}: ${json.error || 'unknown error'}`);
      return json.data;
    } catch (error) {
      lastError = error;
      if (attempt === 4) break;
      const delayMs = attempt * 2500;
      console.warn(`${action}: retry ${attempt}/3 after ${delayMs}ms (${error.message})`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

function ingredient(productName, category, quantity, unit, extra = {}) {
  return {
    productName,
    category,
    quantity,
    unit,
    requiredOptional: 'required',
    replacement: '',
    comment: '',
    ...extra,
  };
}

function dish(dishId, dishName, mainProtein, cookingTimeMin, difficulty, portions, leftovers, budgetLevel, bestDayType, tags, recipeNote, ingredients) {
  return {
    dishId,
    dishName,
    category: 'ужин',
    mainProtein,
    cookingTimeMin,
    difficulty,
    portions,
    leftovers,
    budgetLevel,
    bestDayType,
    tags,
    recipeNote,
    active: true,
    createdAt: now,
    updatedAt: now,
    ingredients: ingredients.map((item, index) => ({
      dishId,
      productId: `${dishId}-P${String(index + 1).padStart(2, '0')}`,
      ...item,
    })),
  };
}

const categories = {
  meat: 'мясо / птица / рыба',
  dairy: 'молочные продукты',
  eggs: 'яйца',
  grains: 'крупы / макароны / хлеб',
  vegetables: 'овощи',
  fruits: 'фрукты',
  grocery: 'специи / бакалея',
  frozen: 'заморозка',
  other: 'прочее',
};

const dishes = [
  dish('D-001', 'Курица с рисом и овощами', 'курица', 55, 'easy', 4, true, 'low', 'weekday', ['будни', 'бюджетно', 'без духовки'], 'Обжарить курицу, добавить овощи и потушить с рисом.', [
    ingredient('Куриное филе', categories.meat, 700, 'г'),
    ingredient('Рис', categories.grains, 300, 'г'),
    ingredient('Морковь', categories.vegetables, 2, 'шт'),
    ingredient('Лук', categories.vegetables, 1, 'шт'),
    ingredient('Томатная паста', categories.grocery, 2, 'ст. л.'),
  ]),
  dish('D-002', 'Паста с фаршем и томатами', 'фарш', 45, 'easy', 4, true, 'medium', 'weekday', ['быстро', 'будни'], 'Соус из фарша и томатов, пасту смешать перед подачей.', [
    ingredient('Говяжий фарш', categories.meat, 600, 'г'),
    ingredient('Макароны', categories.grains, 400, 'г'),
    ingredient('Томаты в собственном соку', categories.grocery, 1, 'банка'),
    ingredient('Лук', categories.vegetables, 1, 'шт'),
    ingredient('Сыр', categories.dairy, 120, 'г', { requiredOptional: 'optional' }),
  ]),
  dish('D-003', 'Минтай с картофелем в духовке', 'рыба', 70, 'medium', 3, false, 'medium', 'weekend', ['рыба', 'духовка', 'выходной вариант'], 'Запечь рыбу с картофелем, луком и лимоном.', [
    ingredient('Филе минтая', categories.meat, 800, 'г'),
    ingredient('Картофель', categories.vegetables, 1.2, 'кг'),
    ingredient('Лук', categories.vegetables, 1, 'шт'),
    ingredient('Лимон', categories.fruits, 1, 'шт'),
    ingredient('Сметана', categories.dairy, 150, 'г'),
  ]),
  dish('D-004', 'Омлет с сыром и салатом', 'яйца', 25, 'easy', 2, false, 'low', 'weekday', ['до 30 минут', 'быстро', 'без духовки', 'бюджетно'], 'Омлет на сковороде, салат из огурцов и томатов.', [
    ingredient('Яйца', categories.eggs, 5, 'шт'),
    ingredient('Молоко', categories.dairy, 120, 'мл'),
    ingredient('Сыр', categories.dairy, 100, 'г'),
    ingredient('Огурцы', categories.vegetables, 2, 'шт'),
    ingredient('Томаты', categories.vegetables, 2, 'шт'),
  ]),
  dish('D-005', 'Котлеты с гречкой', 'фарш', 75, 'medium', 4, true, 'medium', 'any', ['остатки', 'семейный ужин'], 'Котлеты на сковороде, гречку сварить отдельно.', [
    ingredient('Говяжий фарш', categories.meat, 700, 'г'),
    ingredient('Гречка', categories.grains, 350, 'г'),
    ingredient('Яйца', categories.eggs, 1, 'шт'),
    ingredient('Лук', categories.vegetables, 1, 'шт'),
    ingredient('Хлеб', categories.grains, 2, 'ломтика'),
  ]),
  dish('D-006', 'Плов с курицей', 'курица', 80, 'medium', 4, true, 'low', 'weekend', ['казан', 'остатки', 'бюджетно'], 'Плов с курицей, морковью и рисом.', [
    ingredient('Куриное бедро', categories.meat, 900, 'г'),
    ingredient('Рис', categories.grains, 400, 'г'),
    ingredient('Морковь', categories.vegetables, 3, 'шт'),
    ingredient('Лук', categories.vegetables, 2, 'шт'),
    ingredient('Чеснок', categories.vegetables, 1, 'головка'),
  ]),
  dish('D-007', 'Тефтели в томатном соусе с пюре', 'фарш', 70, 'medium', 4, true, 'medium', 'weekday', ['остатки', 'будни'], 'Тефтели потушить в томатном соусе, подать с пюре.', [
    ingredient('Говяжий фарш', categories.meat, 650, 'г'),
    ingredient('Рис', categories.grains, 120, 'г'),
    ingredient('Картофель', categories.vegetables, 1.2, 'кг'),
    ingredient('Молоко', categories.dairy, 200, 'мл'),
    ingredient('Томаты в собственном соку', categories.grocery, 1, 'банка'),
  ]),
  dish('D-008', 'Индейка с булгуром', 'индейка', 55, 'easy', 3, true, 'medium', 'weekday', ['будни', 'без духовки'], 'Обжарить индейку, добавить овощи, подать с булгуром.', [
    ingredient('Филе индейки', categories.meat, 650, 'г'),
    ingredient('Булгур', categories.grains, 300, 'г'),
    ingredient('Морковь', categories.vegetables, 2, 'шт'),
    ingredient('Лук', categories.vegetables, 1, 'шт'),
    ingredient('Йогурт', categories.dairy, 150, 'г'),
  ]),
  dish('D-009', 'Куриный суп с лапшой', 'курица', 65, 'easy', 4, true, 'low', 'weekday', ['суп', 'бюджетно'], 'Лёгкий суп на курице с лапшой и овощами.', [
    ingredient('Куриное бедро', categories.meat, 700, 'г'),
    ingredient('Лапша', categories.grains, 200, 'г'),
    ingredient('Картофель', categories.vegetables, 600, 'г'),
    ingredient('Морковь', categories.vegetables, 1, 'шт'),
    ingredient('Лук', categories.vegetables, 1, 'шт'),
  ]),
  dish('D-010', 'Жаркое из говядины с картофелем', 'говядина', 90, 'medium', 4, true, 'medium', 'weekend', ['выходной вариант', 'остатки'], 'Потушить говядину с картофелем и морковью.', [
    ingredient('Говядина', categories.meat, 800, 'г'),
    ingredient('Картофель', categories.vegetables, 1.3, 'кг'),
    ingredient('Морковь', categories.vegetables, 2, 'шт'),
    ingredient('Лук', categories.vegetables, 2, 'шт'),
    ingredient('Сметана', categories.dairy, 120, 'г', { requiredOptional: 'optional' }),
  ]),
  dish('D-011', 'Рыбные котлеты с рисом', 'рыба', 60, 'medium', 4, true, 'medium', 'weekday', ['рыба', 'остатки'], 'Котлеты из рыбного фарша, рис на гарнир.', [
    ingredient('Филе минтая', categories.meat, 700, 'г'),
    ingredient('Рис', categories.grains, 300, 'г'),
    ingredient('Яйца', categories.eggs, 1, 'шт'),
    ingredient('Лук', categories.vegetables, 1, 'шт'),
    ingredient('Хлеб', categories.grains, 2, 'ломтика'),
  ]),
  dish('D-012', 'Гречневая лапша с курицей', 'курица', 35, 'easy', 3, false, 'medium', 'weekday', ['до 60 минут', 'быстро', 'без духовки'], 'Курица и овощи на сковороде, смешать с гречневой лапшой.', [
    ingredient('Куриное филе', categories.meat, 550, 'г'),
    ingredient('Гречневая лапша', categories.grains, 300, 'г'),
    ingredient('Морковь', categories.vegetables, 1, 'шт'),
    ingredient('Огурцы', categories.vegetables, 1, 'шт', { requiredOptional: 'optional' }),
    ingredient('Соевый соус', categories.grocery, 3, 'ст. л.'),
  ]),
  dish('D-013', 'Картофельная запеканка с фаршем', 'фарш', 80, 'medium', 4, true, 'medium', 'weekend', ['духовка', 'остатки'], 'Слои картофеля и фарша, запечь с сыром.', [
    ingredient('Говяжий фарш', categories.meat, 650, 'г'),
    ingredient('Картофель', categories.vegetables, 1.2, 'кг'),
    ingredient('Сыр', categories.dairy, 180, 'г'),
    ingredient('Сметана', categories.dairy, 150, 'г'),
    ingredient('Лук', categories.vegetables, 1, 'шт'),
  ]),
  dish('D-014', 'Куриные бедра в духовке с овощами', 'курица', 75, 'easy', 4, true, 'low', 'weekend', ['духовка', 'бюджетно', 'остатки'], 'Запечь куриные бедра с картофелем, морковью и луком.', [
    ingredient('Куриное бедро', categories.meat, 1.1, 'кг'),
    ingredient('Картофель', categories.vegetables, 1.2, 'кг'),
    ingredient('Морковь', categories.vegetables, 2, 'шт'),
    ingredient('Лук', categories.vegetables, 2, 'шт'),
    ingredient('Сметана', categories.dairy, 120, 'г'),
  ]),
  dish('D-015', 'Сырники с йогуртом и фруктами', 'творог', 35, 'easy', 2, false, 'low', 'weekday', ['до 60 минут', 'быстро', 'лёгкий ужин'], 'Сырники на сковороде, подать с йогуртом и яблоком.', [
    ingredient('Творог', categories.dairy, 500, 'г'),
    ingredient('Яйца', categories.eggs, 1, 'шт'),
    ingredient('Мука', categories.grocery, 80, 'г'),
    ingredient('Йогурт', categories.dairy, 150, 'г'),
    ingredient('Яблоки', categories.fruits, 2, 'шт'),
  ]),
  dish('D-016', 'Рис с тунцом и яйцом', 'рыба', 25, 'easy', 2, false, 'medium', 'weekday', ['до 30 минут', 'быстро', 'без духовки'], 'Быстрая миска из риса, тунца, яйца и огурца.', [
    ingredient('Рис', categories.grains, 180, 'г'),
    ingredient('Тунец консервированный', categories.grocery, 1, 'банка'),
    ingredient('Яйца', categories.eggs, 2, 'шт'),
    ingredient('Огурцы', categories.vegetables, 2, 'шт'),
    ingredient('Йогурт', categories.dairy, 100, 'г'),
  ]),
  dish('D-017', 'Паста с курицей и грибами', 'курица', 45, 'easy', 4, true, 'medium', 'weekday', ['быстро', 'будни'], 'Курица, шампиньоны и сливочный соус к пасте.', [
    ingredient('Куриное филе', categories.meat, 650, 'г'),
    ingredient('Макароны', categories.grains, 400, 'г'),
    ingredient('Шампиньоны', categories.vegetables, 350, 'г'),
    ingredient('Сметана', categories.dairy, 200, 'г'),
    ingredient('Сыр', categories.dairy, 120, 'г'),
  ]),
  dish('D-018', 'Манты домашние', 'говядина', 120, 'hard', 4, true, 'medium', 'weekend', ['выходной вариант', 'остатки'], 'Домашние манты на выходной день.', [
    ingredient('Говяжий фарш', categories.meat, 800, 'г'),
    ingredient('Мука', categories.grocery, 700, 'г'),
    ingredient('Яйца', categories.eggs, 1, 'шт'),
    ingredient('Лук', categories.vegetables, 3, 'шт'),
    ingredient('Сметана', categories.dairy, 200, 'г'),
  ]),
  dish('D-019', 'Лагман домашний', 'говядина', 100, 'medium', 4, true, 'medium', 'weekend', ['выходной вариант', 'остатки'], 'Говядина с овощами и лапшой в густом соусе.', [
    ingredient('Говядина', categories.meat, 700, 'г'),
    ingredient('Лапша', categories.grains, 400, 'г'),
    ingredient('Картофель', categories.vegetables, 500, 'г'),
    ingredient('Морковь', categories.vegetables, 2, 'шт'),
    ingredient('Томаты', categories.vegetables, 3, 'шт'),
  ]),
  dish('D-020', 'Макароны по-флотски', 'фарш', 35, 'easy', 4, true, 'low', 'weekday', ['быстро', 'бюджетно', 'без духовки'], 'Классический быстрый ужин из фарша и макарон.', [
    ingredient('Говяжий фарш', categories.meat, 550, 'г'),
    ingredient('Макароны', categories.grains, 450, 'г'),
    ingredient('Лук', categories.vegetables, 1, 'шт'),
    ingredient('Томатная паста', categories.grocery, 2, 'ст. л.'),
  ]),
];

const baseProducts = [
  ['BP-001', 'Молоко', categories.dairy, 2, 'л', 520, 1040, '2.5%, любой магазин', 'свежее', true],
  ['BP-002', 'Хлеб', categories.grains, 2, 'шт', 210, 420, 'проверить свежесть', 'свежее', true],
  ['BP-003', 'Яйца', categories.eggs, 10, 'шт', 75, 750, 'С1', 'можно хранить', true],
  ['BP-004', 'Масло подсолнечное', categories.grocery, 1, 'л', 850, 850, 'для жарки', 'можно хранить', true],
  ['BP-005', 'Сметана', categories.dairy, 1, 'уп', 620, 620, '15-20%', 'свежее', false],
  ['BP-006', 'Творог', categories.dairy, 1, 'уп', 780, 780, '400-500 г', 'свежее', false],
  ['BP-007', 'Сыр', categories.dairy, 1, 'уп', 1800, 1800, 'твёрдый, 300 г', 'можно хранить', false],
  ['BP-008', 'Рис', categories.grains, 1, 'кг', 760, 760, 'длиннозёрный', 'можно хранить', false],
  ['BP-009', 'Гречка', categories.grains, 1, 'кг', 900, 900, 'ядрица', 'можно хранить', false],
  ['BP-010', 'Макароны', categories.grains, 1, 'уп', 520, 520, '400-450 г', 'можно хранить', false],
  ['BP-011', 'Картофель', categories.vegetables, 3, 'кг', 220, 660, 'мешок или развес', 'можно хранить', true],
  ['BP-012', 'Лук', categories.vegetables, 1, 'кг', 180, 180, 'развес', 'можно хранить', true],
  ['BP-013', 'Морковь', categories.vegetables, 1, 'кг', 220, 220, 'развес', 'можно хранить', true],
  ['BP-014', 'Огурцы', categories.vegetables, 1, 'кг', 700, 700, 'по сезону', 'свежее', true],
  ['BP-015', 'Томаты', categories.vegetables, 1, 'кг', 850, 850, 'по сезону', 'свежее', true],
  ['BP-016', 'Яблоки', categories.fruits, 1, 'кг', 650, 650, 'для перекуса', 'можно хранить', true],
  ['BP-017', 'Куриное бедро', categories.meat, 1, 'кг', 1450, 1450, 'охлаждённое', 'свежее', false],
  ['BP-018', 'Куриное филе', categories.meat, 1, 'кг', 2200, 2200, 'охлаждённое', 'свежее', false],
  ['BP-019', 'Говяжий фарш', categories.meat, 1, 'кг', 2600, 2600, 'проверенный магазин', 'свежее', false],
  ['BP-020', 'Говядина', categories.meat, 1, 'кг', 3300, 3300, 'для тушения', 'свежее', false],
  ['BP-021', 'Филе минтая', categories.meat, 1, 'кг', 1900, 1900, 'заморозка', 'можно хранить', false],
  ['BP-022', 'Томаты в собственном соку', categories.grocery, 1, 'банка', 650, 650, '400 г', 'можно хранить', false],
  ['BP-023', 'Мука', categories.grocery, 2, 'кг', 420, 840, 'для выпечки', 'можно хранить', false],
  ['BP-024', 'Йогурт', categories.dairy, 1, 'уп', 520, 520, 'натуральный', 'свежее', false],
].map(([productId, productName, category, defaultQuantity, unit, pricePerUnit, estimatedPackagePrice, storeNote, buyFreshOrStore, includeByDefault]) => ({
  productId,
  productName,
  category,
  defaultQuantity,
  unit,
  pricePerUnit,
  estimatedPackagePrice,
  storeNote,
  buyFreshOrStore,
  includeByDefault,
  active: true,
  updatedAt: now,
}));

const calendarPlan = [
  ['2026-06-28', 'вс', 'D-001', 'D-003', 'D-004', 'D-001'],
  ['2026-06-29', 'пн', 'D-002', 'D-012', 'D-016', 'D-002'],
  ['2026-06-30', 'вт', 'D-011', 'D-004', 'D-020', 'D-011'],
  ['2026-07-01', 'ср', 'D-007', 'D-017', 'D-004', 'D-007'],
  ['2026-07-02', 'чт', 'D-008', 'D-015', 'D-016', 'D-008'],
  ['2026-07-03', 'пт', 'D-017', 'D-020', 'D-004', 'D-017'],
  ['2026-07-04', 'сб', 'D-014', 'D-006', 'D-016', 'D-014'],
  ['2026-07-05', 'вс', 'D-018', 'D-019', 'D-004', ''],
  ['2026-07-06', 'пн', 'D-012', 'D-009', 'D-016', ''],
  ['2026-07-07', 'вт', 'D-005', 'D-012', 'D-004', ''],
  ['2026-07-08', 'ср', 'D-010', 'D-011', 'D-020', ''],
  ['2026-07-09', 'чт', 'D-013', 'D-006', 'D-016', ''],
  ['2026-07-10', 'пт', 'D-009', 'D-015', 'D-004', ''],
  ['2026-07-11', 'сб', 'D-019', 'D-003', 'D-016', ''],
].map(([date, dayLabel, optionADishId, optionBDishId, quickDishId, selectedDishId]) => ({
  date,
  dayLabel,
  optionADishId,
  optionBDishId,
  quickDishId,
  selectedDishId,
  status: 'planned',
  note: 'production seed',
  createdAt: now,
  updatedAt: now,
}));

const selectedDinners = calendarPlan
  .filter((row) => row.selectedDishId)
  .map((row) => {
    const selected = dishes.find((item) => item.dishId === row.selectedDishId);
    return {
      id: `PROD-${row.date}-${row.selectedDishId}`,
      date: row.date,
      dayLabel: row.dayLabel,
      dishId: row.selectedDishId,
      dishName: selected?.dishName || row.selectedDishId,
      source: 'seed',
      status: 'planned',
      note: 'production seed',
      createdAt: now,
      updatedAt: now,
    };
  });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

await call('setupSheets');

for (const item of dishes) {
  await call('createDish', item);
  console.log(`dish ${item.dishId}`);
}

for (const item of baseProducts) {
  await call('createBaseProduct', item);
  console.log(`base ${item.productId}`);
}

for (const row of calendarPlan) {
  await call('saveCalendarPlan', row);
  console.log(`plan ${row.date}`);
}

for (const row of selectedDinners) {
  await call('saveSelectedDinner', row);
  console.log(`selected ${row.date}`);
}

const appData = await call('getAppData');
const seededDishes = appData.dishes.filter((item) => item.dishId?.startsWith('D-'));
const seededBaseProducts = appData.baseProducts.filter((item) => item.productId?.startsWith('BP-'));
const seededPlan = appData.calendarPlan.filter((item) => item.note === 'production seed');
const forbidden = ['брокколи', 'цветная капуста', 'фасоль', 'бобовые', 'нут'];
const activeIngredientNames = seededDishes.flatMap((item) => item.ingredients || []).map((item) => String(item.productName || '').toLowerCase());
const forbiddenHits = forbidden.filter((item) => activeIngredientNames.some((name) => name.includes(item)));

assert(seededDishes.length >= 20, `Expected at least 20 dishes, got ${seededDishes.length}`);
assert(seededDishes.every((item) => (item.ingredients || []).length > 0), 'Some dishes have no ingredients');
assert(seededBaseProducts.length >= 24, `Expected at least 24 base products, got ${seededBaseProducts.length}`);
assert(seededPlan.length >= 14, `Expected at least 14 calendar rows, got ${seededPlan.length}`);
assert(forbiddenHits.length === 0, `Forbidden products found: ${forbiddenHits.join(', ')}`);

const selectedForShopping = selectedDinners.slice(0, 1);
const shoppingWithoutBase = await call('buildShoppingList', {
  selectedDishes: selectedForShopping,
  includeBaseProducts: false,
});
const shoppingWithBase = await call('buildShoppingList', {
  selectedDishes: selectedForShopping,
  includeBaseProducts: true,
});

assert(shoppingWithoutBase.length > 0, 'Shopping list without base products is empty');
assert(shoppingWithBase.length > shoppingWithoutBase.length, 'Base products were not added when toggle is enabled');

console.log(JSON.stringify({
  ok: true,
  dishes: seededDishes.length,
  baseProducts: seededBaseProducts.length,
  calendarPlan: seededPlan.length,
  selectedDinners: selectedDinners.length,
  firstShoppingListItems: shoppingWithoutBase.length,
  firstShoppingListWithBaseItems: shoppingWithBase.length,
}, null, 2));
