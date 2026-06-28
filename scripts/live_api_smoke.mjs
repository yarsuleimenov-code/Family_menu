const endpoint = process.env.APPS_SCRIPT_ENDPOINT || process.env.VITE_APPS_SCRIPT_ENDPOINT;
const token = process.env.API_TOKEN || process.env.VITE_API_TOKEN || '';

if (!endpoint) {
  console.error('Missing APPS_SCRIPT_ENDPOINT or VITE_APPS_SCRIPT_ENDPOINT');
  process.exit(2);
}

const runId = `QA-${Date.now()}`;
const now = new Date().toISOString();
const qaDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

async function call(action, payload = {}) {
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
    const shortText = text.replace(/\s+/g, ' ').slice(0, 500);
    throw new Error(`${action}: endpoint returned non-JSON response. HTTP ${response.status}. ${shortText}`);
  }
  if (!json.ok) throw new Error(`${action}: ${json.error || 'unknown error'}`);
  return json.data;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function coerceIsoDate(value) {
  const text = String(value ?? '').trim();
  const isoMatch = text.match(/^\d{4}-\d{2}-\d{2}/);
  if (isoMatch) return isoMatch[0];
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    const copy = new Date(parsed);
    copy.setMinutes(copy.getMinutes() - copy.getTimezoneOffset());
    return copy.toISOString().slice(0, 10);
  }
  return text;
}

const dishA = {
  dishId: `${runId}-DISH-A`,
  dishName: `${runId} выбранное блюдо`,
  category: 'ужин',
  mainProtein: 'курица',
  cookingTimeMin: 35,
  difficulty: 'easy',
  portions: 2,
  leftovers: true,
  budgetLevel: 'low',
  bestDayType: 'weekday',
  tags: ['qa', 'быстро'],
  recipeNote: 'QA smoke test',
  active: true,
  createdAt: now,
  updatedAt: now,
  ingredients: [
    {
      dishId: `${runId}-DISH-A`,
      productId: `${runId}-ING-A`,
      productName: `${runId} продукт выбранного блюда`,
      category: 'мясо / птица / рыба',
      quantity: 1,
      unit: 'шт',
      requiredOptional: 'required',
    },
  ],
};

const dishB = {
  ...dishA,
  dishId: `${runId}-DISH-B`,
  dishName: `${runId} невыбранная альтернатива`,
  ingredients: [
    {
      dishId: `${runId}-DISH-B`,
      productId: `${runId}-ING-B`,
      productName: `${runId} продукт альтернативы`,
      category: 'прочее',
      quantity: 1,
      unit: 'шт',
      requiredOptional: 'required',
    },
  ],
};

const baseProduct = {
  productId: `${runId}-BASE`,
  productName: `${runId} базовый продукт`,
  category: 'молочные продукты',
  defaultQuantity: 1,
  unit: 'шт',
  pricePerUnit: 100,
  estimatedPackagePrice: 100,
  storeNote: 'QA smoke test',
  buyFreshOrStore: 'можно хранить',
  includeByDefault: true,
  active: true,
  updatedAt: now,
};

const selectedDinner = {
  id: `${runId}-SELECTED`,
  date: qaDate,
  dayLabel: 'qa',
  dishId: dishA.dishId,
  dishName: dishA.dishName,
  source: 'manual',
  status: 'planned',
  note: 'QA smoke test',
  createdAt: now,
  updatedAt: now,
};

const results = [];

await call('setupSheets');
await call('createDish', dishA);
await call('createDish', dishB);
await call('createBaseProduct', baseProduct);
await call('saveCalendarPlan', {
  date: qaDate,
  dayLabel: 'qa',
  optionADishId: dishA.dishId,
  optionBDishId: dishB.dishId,
  quickDishId: '',
  selectedDishId: '',
  status: 'planned',
  note: 'QA smoke test',
  createdAt: now,
  updatedAt: now,
});

const appData = await call('getAppData');
assert(appData.dishes.some((dish) => dish.dishId === dishA.dishId), 'dishes does not include QA selected dish');
assert(appData.calendarPlan.some((row) => coerceIsoDate(row.date) === qaDate && row.optionADishId === dishA.dishId), 'calendar_plan does not include QA row');
assert(appData.baseProducts.some((product) => product.productId === baseProduct.productId), 'base_products does not include QA product');
results.push('read:dishes/calendar_plan/base_products');

await call('saveSelectedDinner', selectedDinner);
const recentSelections = await call('getRecentSelections', { limit: 20 });
assert(recentSelections.some((item) => item.id === selectedDinner.id && item.dishId === dishA.dishId), 'selected_dinners does not include QA selection');
results.push('write:selected_dinners');

const listWithoutBase = await call('buildShoppingList', {
  selectedDishes: [selectedDinner],
  includeBaseProducts: false,
});
const namesWithoutBase = listWithoutBase.map((item) => item.productName);
assert(namesWithoutBase.includes(`${runId} продукт выбранного блюда`), 'shopping list misses selected dish ingredient');
assert(!namesWithoutBase.includes(`${runId} продукт альтернативы`), 'shopping list includes unselected alternative');
assert(!namesWithoutBase.includes(baseProduct.productName), 'base product included while toggle is off');
results.push('shopping:selected-only/no-alternatives/base-off');

const listWithBase = await call('buildShoppingList', {
  selectedDishes: [selectedDinner],
  includeBaseProducts: true,
});
const namesWithBase = listWithBase.map((item) => item.productName);
assert(namesWithBase.includes(baseProduct.productName), 'base product missing while toggle is on');
results.push('shopping:base-on');

const session = {
  sessionId: `${runId}-SESSION`,
  createdAt: now,
  dateFrom: qaDate,
  dateTo: qaDate,
  selectedDishes: [selectedDinner],
  includeBaseProducts: true,
  shoppingList: listWithBase,
  estimatedTotal: listWithBase.reduce((sum, item) => sum + (Number(item.estimatedPrice) || 0), 0),
  note: 'QA smoke test',
};
await call('saveShoppingSession', session);
const savedSession = await call('getShoppingSession', { sessionId: session.sessionId });
assert(savedSession.sessionId === session.sessionId, 'shopping_sessions does not include QA session');
results.push('write:shopping_sessions');

console.log(JSON.stringify({ ok: true, runId, qaDate, results }, null, 2));
