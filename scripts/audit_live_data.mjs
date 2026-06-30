const endpoint = process.env.APPS_SCRIPT_ENDPOINT || process.env.VITE_APPS_SCRIPT_ENDPOINT;
const token = process.env.API_TOKEN || process.env.VITE_API_TOKEN || '';

if (!endpoint) {
  console.error('Missing APPS_SCRIPT_ENDPOINT or VITE_APPS_SCRIPT_ENDPOINT');
  process.exit(2);
}

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
    throw new Error(`${action}: non-JSON response HTTP ${response.status}: ${text.slice(0, 300)}`);
  }
  if (!json.ok) throw new Error(`${action}: ${json.error || 'unknown error'}`);
  return json.data || {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeText(value) {
  return String(value ?? '').trim().toLowerCase();
}

function isActive(value) {
  if (value === false) return false;
  const text = normalizeText(value);
  return !['false', 'no', '0', 'inactive', 'archive', 'archived'].includes(text);
}

function hasValue(value) {
  return String(value ?? '').trim() !== '';
}

function hasPositiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0;
}

function formatDate(value) {
  const text = String(value ?? '').trim();
  const match = text.match(/^\d{4}-\d{2}-\d{2}/);
  if (match) return match[0];
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text;
  parsed.setMinutes(parsed.getMinutes() - parsed.getTimezoneOffset());
  return parsed.toISOString().slice(0, 10);
}

function addDays(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(date.getDate() + days);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function todayIso() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function includesForbidden(dish, forbiddenProducts) {
  const haystack = [
    dish.dishName,
    dish.mainProtein,
    dish.category,
    dish.recipeNote,
    ...asArray(dish.tags),
    ...asArray(dish.ingredients).flatMap((ingredient) => [
      ingredient.productName,
      ingredient.replacement,
      ingredient.comment,
    ]),
  ].map(normalizeText).join(' ');

  return forbiddenProducts.filter((product) => {
    const needle = normalizeText(product);
    return needle && containsTerm(haystack, needle);
  });
}

function containsTerm(haystack, needle) {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, 'u').test(haystack);
}

function dishIssues(dish, forbiddenProducts) {
  const issues = [];
  const ingredients = asArray(dish.ingredients);
  const forbidden = includesForbidden(dish, forbiddenProducts);

  if (!hasValue(dish.dishName)) issues.push('нет названия');
  if (!hasValue(dish.category)) issues.push('нет категории');
  if (!hasValue(dish.mainProtein)) issues.push('нет основного белка');
  if (!hasPositiveNumber(dish.cookingTimeMin)) issues.push('нет времени');
  if (!hasPositiveNumber(dish.portions)) issues.push('нет порций');
  if (!hasValue(dish.budgetLevel)) issues.push('нет бюджета');
  if (!asArray(dish.tags).length) issues.push('нет тегов');
  if (!ingredients.length) issues.push('нет ингредиентов');
  if (forbidden.length) issues.push(`запрещённые продукты: ${forbidden.join(', ')}`);

  const badIngredients = ingredients
    .map((ingredient, index) => ({
      index: index + 1,
      name: ingredient.productName || `ингредиент ${index + 1}`,
      problems: [
        !hasValue(ingredient.productName) ? 'нет названия' : '',
        !hasPositiveNumber(ingredient.quantity) ? 'нет количества' : '',
        !hasValue(ingredient.unit) ? 'нет единицы' : '',
        !hasValue(ingredient.category) ? 'нет категории' : '',
      ].filter(Boolean),
    }))
    .filter((ingredient) => ingredient.problems.length);

  if (badIngredients.length) {
    issues.push(`проблемные ингредиенты: ${badIngredients.map((item) => `${item.name} (${item.problems.join(', ')})`).join('; ')}`);
  }

  return issues;
}

function productIssues(product) {
  return [
    !hasValue(product.productName) ? 'нет названия' : '',
    !hasValue(product.category) ? 'нет категории' : '',
    !hasPositiveNumber(product.defaultQuantity) ? 'нет стандартного количества' : '',
    !hasValue(product.unit) ? 'нет единицы' : '',
    !hasPositiveNumber(product.pricePerUnit) && !hasPositiveNumber(product.estimatedPackagePrice) ? 'нет цены' : '',
  ].filter(Boolean);
}

function countBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    map.set(key, (map.get(key) || 0) + 1);
  }
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ru'));
}

const data = await call('getAppData');
const dishes = asArray(data.dishes);
const baseProducts = asArray(data.baseProducts);
const calendarPlan = asArray(data.calendarPlan);
const selectedDinners = asArray(data.selectedDinners);
const shoppingSessions = asArray(data.shoppingSessions);
const forbiddenProducts = asArray(data.settings?.forbiddenProducts);

const activeDishes = dishes.filter((dish) => isActive(dish.active));
const activeBaseProducts = baseProducts.filter((product) => isActive(product.active));
const dishProblems = activeDishes
  .map((dish) => ({ dish, issues: dishIssues(dish, forbiddenProducts) }))
  .filter((item) => item.issues.length);
const productProblems = activeBaseProducts
  .map((product) => ({ product, issues: productIssues(product) }))
  .filter((item) => item.issues.length);

const baseProductByName = new Map(activeBaseProducts.map((product) => [normalizeText(product.productName), product]));
const ingredientUsage = countBy(
  activeDishes.flatMap((dish) => asArray(dish.ingredients)),
  (ingredient) => normalizeText(ingredient.productName),
);
const frequentIngredientsWithoutPrice = ingredientUsage
  .filter(([name]) => {
    const product = baseProductByName.get(name);
    return !product || (!hasPositiveNumber(product.pricePerUnit) && !hasPositiveNumber(product.estimatedPackagePrice));
  })
  .slice(0, 20);

const dishNameDuplicates = countBy(activeDishes, (dish) => normalizeText(dish.dishName))
  .filter(([, count]) => count > 1);
const productNameDuplicates = countBy(activeBaseProducts, (product) => normalizeText(product.productName))
  .filter(([, count]) => count > 1);

const dishById = new Map(dishes.map((dish) => [dish.dishId, dish]));
const today = todayIso();
const next7Dates = Array.from({ length: 7 }, (_, index) => addDays(today, index));
const planByDate = new Map(calendarPlan.map((row) => [formatDate(row.date), row]));
const selectedByDate = new Map(selectedDinners.map((row) => [formatDate(row.date), row]));
const next7PlanIssues = next7Dates.flatMap((date) => {
  const issues = [];
  const plan = planByDate.get(date);
  const selected = selectedByDate.get(date);
  if (!plan) issues.push('нет строки calendar_plan');
  if (!selected) issues.push('ужин не выбран');
  if (selected && !dishById.has(selected.dishId)) issues.push(`selected_dish не найден: ${selected.dishId}`);
  return issues.length ? [{ date, issues }] : [];
});

const invalidCalendarRefs = calendarPlan.flatMap((row) => {
  const refs = [
    ['option_a', row.optionADishId],
    ['option_b', row.optionBDishId],
    ['quick', row.quickDishId],
    ['selected', row.selectedDishId],
  ].filter(([, id]) => hasValue(id) && !dishById.has(id));
  return refs.length ? [{ date: formatDate(row.date), refs }] : [];
});

const pricedBaseProducts = activeBaseProducts.filter((product) => hasPositiveNumber(product.pricePerUnit) || hasPositiveNumber(product.estimatedPackagePrice));
const summary = {
  checkedAt: new Date().toISOString(),
  loadedAt: data.loadedAt || '',
  counts: {
    dishes: dishes.length,
    activeDishes: activeDishes.length,
    baseProducts: baseProducts.length,
    activeBaseProducts: activeBaseProducts.length,
    calendarPlan: calendarPlan.length,
    selectedDinners: selectedDinners.length,
    shoppingSessions: shoppingSessions.length,
  },
  quality: {
    activeDishProblems: dishProblems.length,
    activeBaseProductProblems: productProblems.length,
    baseProductPriceCoverage: `${pricedBaseProducts.length}/${activeBaseProducts.length}`,
    frequentIngredientsWithoutPrice: frequentIngredientsWithoutPrice.length,
    next7PlanIssues: next7PlanIssues.length,
    invalidCalendarRefs: invalidCalendarRefs.length,
    duplicateDishNames: dishNameDuplicates.length,
    duplicateProductNames: productNameDuplicates.length,
  },
};

const output = {
  summary,
  dishProblems: dishProblems.map(({ dish, issues }) => ({
    dishId: dish.dishId,
    dishName: dish.dishName,
    issues,
  })),
  productProblems: productProblems.map(({ product, issues }) => ({
    productId: product.productId,
    productName: product.productName,
    issues,
  })),
  frequentIngredientsWithoutPrice: frequentIngredientsWithoutPrice.map(([productName, usageCount]) => ({ productName, usageCount })),
  next7PlanIssues,
  invalidCalendarRefs,
  duplicateDishNames: dishNameDuplicates.map(([dishName, count]) => ({ dishName, count })),
  duplicateProductNames: productNameDuplicates.map(([productName, count]) => ({ productName, count })),
};

console.log(JSON.stringify(output, null, 2));
