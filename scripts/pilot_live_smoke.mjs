const endpoint = process.env.APPS_SCRIPT_ENDPOINT || process.env.VITE_APPS_SCRIPT_ENDPOINT;
const token = process.env.API_TOKEN || process.env.VITE_API_TOKEN || '';

if (!endpoint) {
  console.error('Missing APPS_SCRIPT_ENDPOINT or VITE_APPS_SCRIPT_ENDPOINT');
  process.exit(2);
}

const runId = `PILOT_TEST-${Date.now()}`;
const now = new Date().toISOString();
const sourceDates = ['2099-11-02', '2099-11-03'];
const targetDates = ['2099-11-09', '2099-11-10'];

async function call(action, payload = {}, requestId = '') {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, token, payload, requestId }),
  });
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`${action}: non-JSON response HTTP ${response.status}: ${text.slice(0, 300)}`);
  }
  if (!response.ok || !json.ok) {
    const error = json?.error;
    throw new Error(`${action}: ${typeof error === 'object' ? `${error.code}: ${error.message}` : error || response.status}`);
  }
  return json.data;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function selectedDinner(id, date, suffix) {
  return {
    id,
    date,
    dayLabel: 'pilot_test',
    dishId: dish.dishId,
    dishName: dish.dishName,
    source: 'manual',
    status: 'planned',
    note: `PILOT_TEST ${suffix}`,
    createdAt: now,
    updatedAt: now,
  };
}

const dish = {
  dishId: `${runId}-DISH`,
  dishName: `${runId} блюдо`,
  category: 'ужин',
  mainProtein: 'курица',
  cookingTimeMin: 30,
  difficulty: 'easy',
  portions: 2,
  leftovers: false,
  budgetLevel: 'low',
  bestDayType: 'weekday',
  tags: ['PILOT_TEST'],
  recipeNote: 'PILOT_TEST live smoke',
  active: true,
  createdAt: now,
  updatedAt: now,
  ingredients: [{
    dishId: `${runId}-DISH`,
    productId: `${runId}-INGREDIENT`,
    productName: `${runId} продукт`,
    category: 'прочее',
    quantity: 1,
    unit: 'шт',
    requiredOptional: 'required',
    comment: 'PILOT_TEST live smoke',
  }],
};

const sourceSelections = sourceDates.map((date, index) => selectedDinner(`${runId}-SOURCE-${index}`, date, 'source week'));
const targetSelections = targetDates.map((date, index) => selectedDinner(`${runId}-TARGET-${index}`, date, 'repeated week'));
const sessionItem = {
  itemId: `${runId}-ITEM`,
  key: `${runId}-KEY`,
  productId: `${runId}-INGREDIENT`,
  productName: `${runId} продукт`,
  category: 'прочее',
  quantityText: '1 шт',
  usedForDishes: [dish.dishName],
  estimatedPrice: 100,
  status: 'to_buy',
  source: 'generated',
};

const results = [];

try {
  await call('setupSheets');

  await call('createDish', dish, `${runId}-REQ-CREATE-DISH`);
  await call('updateDish', { ...dish, dishName: `${runId} блюдо обновлено`, cookingTimeMin: 35, updatedAt: new Date().toISOString() }, `${runId}-REQ-UPDATE-DISH`);
  const afterDish = await call('getAppData');
  const savedDish = afterDish.dishes.find((item) => item.dishId === dish.dishId);
  assert(savedDish?.dishName === `${runId} блюдо обновлено`, 'dish CRUD failed');
  results.push('dish:create/update/read');

  for (let index = 0; index < sourceSelections.length; index += 1) {
    await call('saveSelectedDinner', sourceSelections[index], `${runId}-REQ-SOURCE-${index}`);
  }
  for (let index = 0; index < targetSelections.length; index += 1) {
    const requestId = `${runId}-REQ-TARGET-${index}`;
    await call('saveSelectedDinner', targetSelections[index], requestId);
    await call('saveSelectedDinner', targetSelections[index], requestId);
  }
  const selections = await call('getRecentSelections', { limit: 100 });
  assert(sourceSelections.every((item) => selections.some((saved) => saved.id === item.id)), 'source week missing');
  assert(targetSelections.every((item) => selections.filter((saved) => saved.id === item.id).length === 1), 'repeated week duplicated');
  results.push('week:create/repeat/idempotent');

  const activeSession = {
    sessionId: `${runId}-SESSION`,
    createdAt: now,
    updatedAt: now,
    dateFrom: targetDates[0],
    dateTo: targetDates[1],
    selectedDishes: targetSelections,
    includeBaseProducts: false,
    shoppingList: [sessionItem],
    estimatedTotal: 100,
    status: 'active',
    note: 'PILOT_TEST live smoke',
  };
  await call('saveShoppingSession', activeSession, `${runId}-REQ-SESSION-CREATE`);
  const restored = await call('getShoppingSession', { sessionId: activeSession.sessionId });
  assert(restored.status === 'active' && restored.shoppingList[0].status === 'to_buy', 'active session restore failed');

  const purchasedSession = {
    ...activeSession,
    updatedAt: new Date().toISOString(),
    shoppingList: [{ ...sessionItem, status: 'purchased' }],
  };
  await call('saveShoppingSession', purchasedSession, `${runId}-REQ-SESSION-PURCHASED`);
  const afterReload = await call('getShoppingSession', { sessionId: activeSession.sessionId });
  assert(afterReload.shoppingList[0].status === 'purchased', 'shopping status did not survive reload');

  const latestSession = {
    ...purchasedSession,
    updatedAt: new Date(Date.now() + 1000).toISOString(),
    shoppingList: [{ ...sessionItem, status: 'skipped' }],
  };
  await call('saveShoppingSession', latestSession, `${runId}-REQ-SESSION-LATEST`);
  const latestSaved = await call('getShoppingSession', { sessionId: activeSession.sessionId });
  assert(latestSaved.shoppingList[0].status === 'skipped', 'latest shopping snapshot was not retained');

  const completedSession = { ...latestSession, status: 'completed', completedAt: new Date().toISOString() };
  await call('saveShoppingSession', completedSession, `${runId}-REQ-SESSION-COMPLETE`);
  const completedSaved = await call('getShoppingSession', { sessionId: activeSession.sessionId });
  assert(completedSaved.status === 'completed' && completedSaved.completedAt, 'session completion failed');

  const repeatedSession = {
    ...activeSession,
    sessionId: `${runId}-SESSION-REPEAT`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    shoppingList: [{ ...sessionItem, itemId: `${runId}-ITEM-REPEAT`, status: 'to_buy' }],
  };
  await call('saveShoppingSession', repeatedSession, `${runId}-REQ-SESSION-REPEAT`);
  const repeatedSaved = await call('getShoppingSession', { sessionId: repeatedSession.sessionId });
  assert(repeatedSaved.status === 'active' && repeatedSaved.shoppingList[0].status === 'to_buy', 'session repeat inherited status');
  results.push('shopping:create/restore/reload/latest/complete/repeat');
} finally {
  await call('cleanupSeedRows', { dryRun: false });
}

const finalData = await call('getAppData');
assert(!finalData.dishes.some((item) => String(item.dishId).startsWith(runId)), 'dish cleanup failed');
assert(!finalData.selectedDinners.some((item) => String(item.id).startsWith(runId)), 'selected dinner cleanup failed');
assert(!finalData.shoppingSessions.some((item) => String(item.sessionId).startsWith(runId)), 'shopping session cleanup failed');
results.push('cleanup:PILOT_TEST');

console.log(JSON.stringify({ ok: true, runId, results }, null, 2));
