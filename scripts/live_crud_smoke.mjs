const endpoint = process.env.APPS_SCRIPT_ENDPOINT || process.env.VITE_APPS_SCRIPT_ENDPOINT;
const token = process.env.API_TOKEN || process.env.VITE_API_TOKEN || '';

if (!endpoint) {
  console.error('Missing APPS_SCRIPT_ENDPOINT or VITE_APPS_SCRIPT_ENDPOINT');
  process.exit(2);
}

const runId = `QA-CRUD-${Date.now()}`;
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
      await new Promise((resolve) => setTimeout(resolve, attempt * 2500));
    }
  }
  throw lastError;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const dish = {
  dishId: `${runId}-DISH`,
  dishName: `${runId} dish`,
  category: 'dinner',
  mainProtein: 'chicken',
  cookingTimeMin: 35,
  difficulty: 'easy',
  portions: 2,
  leftovers: true,
  budgetLevel: 'low',
  bestDayType: 'weekday',
  tags: ['qa', 'crud'],
  recipeNote: 'QA CRUD smoke test',
  active: true,
  createdAt: now,
  updatedAt: now,
  ingredients: [
    {
      dishId: `${runId}-DISH`,
      productId: `${runId}-ING`,
      productName: `${runId} ingredient`,
      category: 'other',
      quantity: 1,
      unit: 'pc',
      requiredOptional: 'required',
      comment: 'QA smoke test',
    },
  ],
};

const baseProduct = {
  productId: `${runId}-BASE`,
  productName: `${runId} base`,
  category: 'other',
  defaultQuantity: 1,
  unit: 'pc',
  pricePerUnit: 100,
  estimatedPackagePrice: 100,
  storeNote: 'QA smoke test',
  buyFreshOrStore: 'store',
  includeByDefault: true,
  active: true,
  updatedAt: now,
};

const results = [];

try {
  await call('setupSheets');

  await call('createDish', dish);
  let appData = await call('getAppData');
  assert(appData.dishes.some((item) => item.dishId === dish.dishId), 'createDish did not persist');
  results.push('createDish');

  await call('updateDish', { ...dish, dishName: `${runId} dish updated`, cookingTimeMin: 40, updatedAt: new Date().toISOString() });
  appData = await call('getAppData');
  const updatedDish = appData.dishes.find((item) => item.dishId === dish.dishId);
  assert(updatedDish?.dishName === `${runId} dish updated`, 'updateDish did not persist');
  assert(Number(updatedDish?.cookingTimeMin) === 40, 'updateDish cooking time did not persist');
  results.push('updateDish');

  await call('deactivateDish', { dishId: dish.dishId });
  appData = await call('getAppData');
  assert(appData.dishes.find((item) => item.dishId === dish.dishId)?.active === false, 'deactivateDish did not persist');
  results.push('deactivateDish');

  await call('createBaseProduct', baseProduct);
  appData = await call('getAppData');
  assert(appData.baseProducts.some((item) => item.productId === baseProduct.productId), 'createBaseProduct did not persist');
  results.push('createBaseProduct');

  await call('updateBaseProduct', { ...baseProduct, estimatedPackagePrice: 125, pricePerUnit: 125, updatedAt: new Date().toISOString() });
  appData = await call('getAppData');
  const updatedProduct = appData.baseProducts.find((item) => item.productId === baseProduct.productId);
  assert(Number(updatedProduct?.estimatedPackagePrice) === 125, 'updateBaseProduct did not persist');
  results.push('updateBaseProduct');

  await call('deactivateBaseProduct', { productId: baseProduct.productId });
  appData = await call('getAppData');
  assert(appData.baseProducts.find((item) => item.productId === baseProduct.productId)?.active === false, 'deactivateBaseProduct did not persist');
  results.push('deactivateBaseProduct');
} finally {
  await call('cleanupSeedRows', { dryRun: false });
}

const finalData = await call('getAppData');
assert(!finalData.dishes.some((item) => String(item.dishId).startsWith(runId)), 'QA dish cleanup failed');
assert(!finalData.baseProducts.some((item) => String(item.productId).startsWith(runId)), 'QA base product cleanup failed');
results.push('cleanupSeedRows');

console.log(JSON.stringify({ ok: true, runId, results }, null, 2));
