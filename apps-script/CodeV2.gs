var SHEETS = {
  dishes: ['dish_id', 'dish_name', 'category', 'main_protein', 'cooking_time_min', 'difficulty', 'portions', 'leftovers', 'budget_level', 'best_day_type', 'tags', 'recipe_note', 'active', 'created_at', 'updated_at'],
  dish_ingredients: ['dish_id', 'product_id', 'product_name', 'category', 'quantity', 'unit', 'required_optional', 'replacement', 'comment'],
  calendar_plan: ['date', 'day_label', 'option_a_dish_id', 'option_b_dish_id', 'quick_dish_id', 'selected_dish_id', 'status', 'note', 'created_at', 'updated_at'],
  base_products: ['product_id', 'product_name', 'category', 'default_quantity', 'unit', 'price_per_unit', 'estimated_package_price', 'store_note', 'buy_fresh_or_store', 'include_by_default', 'active', 'updated_at'],
  shopping_sessions: ['session_id', 'created_at', 'date_from', 'date_to', 'selected_dishes_json', 'include_base_products', 'shopping_list_json', 'estimated_total', 'note'],
  selected_dinners: ['id', 'date', 'day_label', 'dish_id', 'dish_name', 'source', 'status', 'note', 'created_at', 'updated_at'],
  settings: ['key', 'value', 'comment', 'updated_at']
};

var LEGACY = {
  menu: 'Menu with dinner options',
  catalog: 'Dinner options catalog',
  shopping: 'Dinner option shopping',
  base: 'Base shopping list',
  selected: 'Selected dinners',
  sessions: 'Shopping sessions'
};

var APP_DATA_CACHE_KEY = 'familyMenu:getAppData:v1';
var APP_DATA_CACHE_TTL_SECONDS = 180;
var APP_DATA_CACHE_INVALIDATING_ACTIONS = {
  saveSelectedDinner: true,
  saveCalendarPlan: true,
  saveShoppingSession: true,
  createDish: true,
  updateDish: true,
  deactivateDish: true,
  createBaseProduct: true,
  updateBaseProduct: true,
  deactivateBaseProduct: true,
  importBackup: true,
  archiveTestData: true,
  deleteTestData: true,
  cleanupSeedRows: true,
  migrateLegacyData: true,
  setupSheets: true
};

function doPost(e) {
  return json_(safeRun_(function () {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    checkToken_(body.token);
    var action = body.action;
    var payload = body.payload || {};
    var handlers = {
      getAppData: getAppData,
      getDishes: getDishes,
      getDishById: function () { return getDishById(payload.dishId); },
      getCalendarPlan: getCalendarPlan,
      getBaseProducts: getBaseProducts,
      getShoppingSession: function () { return getShoppingSession(payload.sessionId); },
      getRecentSelections: function () { return getRecentSelections(payload.limit); },
      getSettings: getSettings,
      saveSelectedDinner: function () { return saveSelectedDinner(payload); },
      saveCalendarPlan: function () { return saveCalendarPlan(payload); },
      saveShoppingSession: function () { return saveShoppingSession(payload); },
      createDish: function () { return createDish(payload); },
      updateDish: function () { return updateDish(payload); },
      deactivateDish: function () { return deactivateDish(payload.dishId); },
      createBaseProduct: function () { return createBaseProduct(payload); },
      updateBaseProduct: function () { return updateBaseProduct(payload); },
      deactivateBaseProduct: function () { return deactivateBaseProduct(payload.productId); },
      updateSettings: function () { return updateSettings(payload); },
      buildShoppingList: function () { return buildShoppingList(payload.selectedDishes || [], payload.includeBaseProducts); },
      randomDish: function () { return randomDish(payload.filters || {}); },
      validateData: validateData,
      cleanupSeedRows: function () { return cleanupSeedRows(payload); },
      setupSheets: setupSheets,
      migrateLegacyData: migrateLegacyData
    };
    if (!handlers[action]) throwUserError_('Unknown API action: ' + action);
    var result = handlers[action]();
    if (APP_DATA_CACHE_INVALIDATING_ACTIONS[action]) clearAppDataCache_();
    return result;
  }));
}

function doGet() {
  return json_({ ok: true, data: { name: 'Family menu API', version: 'v2' } });
}

function setupSheets() {
  Object.keys(SHEETS).forEach(function (name) {
    ensureSheet_(name, SHEETS[name]);
  });
  seedSettings_();
  return { created: Object.keys(SHEETS) };
}

function getAppData() {
  var startedAt = new Date().getTime();
  var cache = CacheService.getScriptCache();
  var cached = cache.get(APP_DATA_CACHE_KEY);
  if (cached) {
    console.log('[FamilyMenu] getAppData cache hit');
    return JSON.parse(cached);
  }
  console.log('[FamilyMenu] getAppData cache miss');
  setupSheets();
  var data = readAppData_();
  try {
    cache.put(APP_DATA_CACHE_KEY, JSON.stringify(data), APP_DATA_CACHE_TTL_SECONDS);
  } catch (err) {
    console.warn('[FamilyMenu] getAppData cache put skipped: ' + err);
  }
  console.log('[FamilyMenu] getAppData loaded in ' + (new Date().getTime() - startedAt) + 'ms');
  return data;
}

function getDishes() {
  setupSheets();
  return readDishes_();
}

function readAppData_() {
  return {
    dishes: readDishes_(),
    baseProducts: readBaseProducts_(),
    calendarPlan: readCalendarPlan_(),
    selectedDinners: readRecentSelections_(100),
    shoppingSessions: readShoppingSessions_(20),
    settings: readSettings_(),
    loadedAt: new Date().toISOString()
  };
}

function clearAppDataCache_() {
  CacheService.getScriptCache().remove(APP_DATA_CACHE_KEY);
  console.log('[FamilyMenu] getAppData cache cleared');
}

function readDishes_() {
  var dishRows = readRows_('dishes');
  var ingredientRows = readRows_('dish_ingredients');
  var byDish = {};
  ingredientRows.forEach(function (row) {
    var dishId = cell_(row, 'dish_id');
    if (!byDish[dishId]) byDish[dishId] = [];
    byDish[dishId].push({
      dishId: dishId,
      productId: cell_(row, 'product_id'),
      productName: cell_(row, 'product_name'),
      category: cell_(row, 'category'),
      quantity: parseMaybeNumber_(cell_(row, 'quantity')),
      unit: cell_(row, 'unit'),
      requiredOptional: cell_(row, 'required_optional') || 'required',
      replacement: cell_(row, 'replacement'),
      comment: cell_(row, 'comment')
    });
  });
  return dishRows.filter(notEmptyRow_).map(function (row) {
    var dishId = cell_(row, 'dish_id');
    return {
      dishId: dishId,
      dishName: cell_(row, 'dish_name'),
      category: cell_(row, 'category'),
      mainProtein: cell_(row, 'main_protein'),
      cookingTimeMin: Number(cell_(row, 'cooking_time_min')) || undefined,
      difficulty: cell_(row, 'difficulty') || 'easy',
      portions: Number(cell_(row, 'portions')) || 2,
      leftovers: toBool_(cell_(row, 'leftovers')),
      budgetLevel: cell_(row, 'budget_level') || 'medium',
      bestDayType: cell_(row, 'best_day_type') || 'any',
      tags: split_(cell_(row, 'tags')),
      recipeNote: cell_(row, 'recipe_note'),
      active: toBool_(cell_(row, 'active'), true),
      createdAt: cell_(row, 'created_at'),
      updatedAt: cell_(row, 'updated_at'),
      ingredients: byDish[dishId] || []
    };
  });
}

function getDishById(dishId) {
  var found = getDishes().filter(function (dish) { return dish.dishId === dishId; })[0];
  if (!found) throwUserError_('Блюдо не найдено');
  return found;
}

function getCalendarPlan() {
  setupSheets();
  return readCalendarPlan_();
}

function readCalendarPlan_() {
  return readRows_('calendar_plan').filter(notEmptyRow_).map(function (row) {
    return {
      date: cell_(row, 'date'),
      dayLabel: cell_(row, 'day_label'),
      optionADishId: cell_(row, 'option_a_dish_id'),
      optionBDishId: cell_(row, 'option_b_dish_id'),
      quickDishId: cell_(row, 'quick_dish_id'),
      selectedDishId: cell_(row, 'selected_dish_id'),
      status: cell_(row, 'status') || 'planned',
      note: cell_(row, 'note'),
      createdAt: cell_(row, 'created_at'),
      updatedAt: cell_(row, 'updated_at')
    };
  });
}

function getBaseProducts() {
  setupSheets();
  return readBaseProducts_();
}

function readBaseProducts_() {
  return readRows_('base_products').filter(notEmptyRow_).map(function (row) {
    return {
      productId: cell_(row, 'product_id'),
      productName: cell_(row, 'product_name'),
      category: cell_(row, 'category'),
      defaultQuantity: parseMaybeNumber_(cell_(row, 'default_quantity')),
      unit: cell_(row, 'unit'),
      pricePerUnit: Number(cell_(row, 'price_per_unit')) || undefined,
      estimatedPackagePrice: Number(cell_(row, 'estimated_package_price')) || undefined,
      storeNote: cell_(row, 'store_note'),
      buyFreshOrStore: cell_(row, 'buy_fresh_or_store'),
      includeByDefault: toBool_(cell_(row, 'include_by_default')),
      active: toBool_(cell_(row, 'active'), true),
      updatedAt: cell_(row, 'updated_at')
    };
  });
}

function getShoppingSession(sessionId) {
  setupSheets();
  var session = readShoppingSessions_(100).filter(function (item) { return item.sessionId === sessionId; })[0];
  if (!session) throwUserError_('Shopping session не найдена');
  return session;
}

function getRecentSelections(limit) {
  setupSheets();
  return readRecentSelections_(limit);
}

function readRecentSelections_(limit) {
  return readRows_('selected_dinners').filter(notEmptyRow_).reverse().slice(0, limit || 30).map(function (row) {
    return {
      id: cell_(row, 'id'),
      date: cell_(row, 'date'),
      dayLabel: cell_(row, 'day_label'),
      dishId: cell_(row, 'dish_id'),
      dishName: cell_(row, 'dish_name'),
      source: cell_(row, 'source') || 'manual',
      status: cell_(row, 'status') || 'planned',
      note: cell_(row, 'note'),
      createdAt: cell_(row, 'created_at'),
      updatedAt: cell_(row, 'updated_at')
    };
  });
}

function getSettings() {
  setupSheets();
  return readSettings_();
}

function readSettings_() {
  var map = {};
  readRows_('settings').forEach(function (row) {
    if (cell_(row, 'key')) map[cell_(row, 'key')] = cell_(row, 'value');
  });
  return {
    weeklyBudget: Number(map.weeklyBudget) || 25000,
    peopleCount: Number(map.peopleCount) || 2,
    forbiddenProducts: split_(map.forbiddenProducts || 'брокколи, цветная капуста, фасоль, бобовые, нут'),
    dataSource: 'googleSheets',
    appsScriptEndpoint: map.appsScriptEndpoint || '',
    apiToken: '',
    language: 'ru'
  };
}

function saveSelectedDinner(payload) {
  setupSheets();
  appendByHeaders_('selected_dinners', {
    id: payload.id || Utilities.getUuid(),
    date: payload.date,
    day_label: payload.dayLabel,
    dish_id: payload.dishId,
    dish_name: payload.dishName,
    source: payload.source || 'manual',
    status: payload.status || 'planned',
    note: payload.note || '',
    created_at: payload.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString()
  });
  return payload;
}

function saveCalendarPlan(payload) {
  setupSheets();
  upsertByKey_('calendar_plan', 'date', payload.date, {
    date: payload.date,
    day_label: payload.dayLabel,
    option_a_dish_id: payload.optionADishId || '',
    option_b_dish_id: payload.optionBDishId || '',
    quick_dish_id: payload.quickDishId || '',
    selected_dish_id: payload.selectedDishId || '',
    status: payload.status || 'planned',
    note: payload.note || '',
    created_at: payload.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString()
  });
  return payload;
}

function saveShoppingSession(payload) {
  setupSheets();
  appendByHeaders_('shopping_sessions', {
    session_id: payload.sessionId || Utilities.getUuid(),
    created_at: payload.createdAt || new Date().toISOString(),
    date_from: payload.dateFrom,
    date_to: payload.dateTo,
    selected_dishes_json: JSON.stringify(payload.selectedDishes || []),
    include_base_products: payload.includeBaseProducts ? 'yes' : 'no',
    shopping_list_json: JSON.stringify(payload.shoppingList || []),
    estimated_total: payload.estimatedTotal || 0,
    note: payload.note || ''
  });
  return payload;
}

function createDish(payload) {
  setupSheets();
  upsertDish_(payload);
  return payload;
}

function updateDish(payload) {
  setupSheets();
  upsertDish_(payload);
  return payload;
}

function deactivateDish(dishId) {
  var dish = getDishById(dishId);
  dish.active = false;
  dish.updatedAt = new Date().toISOString();
  upsertDish_(dish);
  return { dishId: dishId };
}

function createBaseProduct(payload) {
  setupSheets();
  upsertBaseProduct_(payload);
  return payload;
}

function updateBaseProduct(payload) {
  setupSheets();
  upsertBaseProduct_(payload);
  return payload;
}

function deactivateBaseProduct(productId) {
  var product = getBaseProducts().filter(function (item) { return item.productId === productId; })[0];
  if (!product) throwUserError_('Базовый продукт не найден');
  product.active = false;
  upsertBaseProduct_(product);
  return { productId: productId };
}

function updateSettings(payload) {
  setupSheets();
  var values = {
    weeklyBudget: payload.weeklyBudget,
    peopleCount: payload.peopleCount,
    forbiddenProducts: (payload.forbiddenProducts || []).join(', '),
    appsScriptEndpoint: payload.appsScriptEndpoint || ''
  };
  Object.keys(values).forEach(function (key) {
    upsertByKey_('settings', 'key', key, { key: key, value: values[key], comment: '', updated_at: new Date().toISOString() });
  });
  return getSettings();
}

function buildShoppingList(selectedDishes, includeBaseProducts) {
  setupSheets();
  var dishes = readDishes_();
  var baseProducts = readBaseProducts_();
  var dishById = {};
  var baseByName = {};
  dishes.forEach(function (dish) { dishById[dish.dishId] = dish; });
  baseProducts.filter(function (product) { return product.active; }).forEach(function (product) {
    baseByName[norm_(product.productName)] = product;
  });
  var merged = {};
  selectedDishes.forEach(function (selection) {
    var dish = dishById[selection.dishId];
    if (!dish) return;
    dish.ingredients.forEach(function (ingredient) {
      var priceSource = baseByName[norm_(ingredient.productName)];
      addShoppingItem_(merged, {
        productId: ingredient.productId || '',
        productName: ingredient.productName,
        category: ingredient.category || 'прочее',
        quantityText: [ingredient.quantity, ingredient.unit].join(' '),
        unit: ingredient.unit || '',
        usedForDishes: [dish.dishName],
        replacement: ingredient.replacement || '',
        comment: ingredient.comment || (priceSource ? priceSource.storeNote : ''),
        pricePerUnit: priceSource ? priceSource.pricePerUnit : '',
        estimatedPrice: estimateIngredientPrice_(ingredient.quantity, ingredient.unit, priceSource)
      });
    });
  });
  if (includeBaseProducts) {
    baseProducts.filter(function (product) { return product.active && product.includeByDefault; }).forEach(function (product) {
      addShoppingItem_(merged, {
        productId: product.productId,
        productName: product.productName,
        category: product.category || 'прочее',
        quantityText: [product.defaultQuantity, product.unit].join(' '),
        unit: product.unit || '',
        usedForDishes: ['Базовые покупки'],
        comment: product.storeNote || '',
        pricePerUnit: product.pricePerUnit || '',
        estimatedPrice: product.estimatedPackagePrice || ''
      });
    });
  }
  return Object.keys(merged).map(function (key) {
    merged[key].key = key;
    merged[key].status = 'to_buy';
    return merged[key];
  });
}

function randomDish(filters) {
  setupSheets();
  var settings = readSettings_();
  var candidates = readDishes_().filter(function (dish) {
    if (!dish.active) return false;
    if (hasForbidden_(dish, settings.forbiddenProducts)) return false;
    if (filters.quick && Number(dish.cookingTimeMin || 999) > 45) return false;
    if (filters.budget && dish.budgetLevel !== 'low') return false;
    if (filters.leftovers && !dish.leftovers) return false;
    return true;
  });
  if (!candidates.length) return { dish: null, reasons: ['Нет подходящих блюд'] };
  var dish = candidates[Math.floor(Math.random() * candidates.length)];
  return { dish: dish, reasons: [dish.cookingTimeMin <= 45 ? 'быстрое' : '', dish.budgetLevel === 'low' ? 'бюджетное' : '', dish.leftovers ? 'есть остатки' : ''].filter(String) };
}

function validateData() {
  setupSheets();
  var warnings = [];
  var settings = readSettings_();
  readDishes_().forEach(function (dish) {
    if (dish.active && hasForbidden_(dish, settings.forbiddenProducts)) warnings.push('Запрещённый продукт в активном блюде: ' + dish.dishName);
    if (!dish.active) return;
    if (!dish.ingredients.length) warnings.push('Активное блюдо неполное, нет ингредиентов: ' + dish.dishName);
    if (!dish.cookingTimeMin) warnings.push('Активное блюдо неполное, нет времени готовки: ' + dish.dishName);
    if (!dish.portions) warnings.push('Активное блюдо неполное, нет порций: ' + dish.dishName);
    if (!dish.budgetLevel) warnings.push('Активное блюдо неполное, нет бюджета: ' + dish.dishName);
    if (!dish.tags.length) warnings.push('Активное блюдо неполное, нет тегов: ' + dish.dishName);
  });
  return { warnings: warnings };
}

function cleanupSeedRows(payload) {
  setupSheets();
  payload = payload || {};
  var dryRun = payload.dryRun !== false;
  var summary = {
    dryRun: dryRun,
    qaRows: {},
    duplicateSelectedDinners: 0,
    deletedRows: 0
  };

  summary.qaRows.dish_ingredients = deleteRowsByPredicate_('dish_ingredients', function (row) {
    return startsQa_(cell_(row, 'dish_id')) || startsQa_(cell_(row, 'product_id')) || hasQaText_(cell_(row, 'comment'));
  }, dryRun);

  summary.qaRows.dishes = deleteRowsByPredicate_('dishes', function (row) {
    return startsQa_(cell_(row, 'dish_id')) || hasQaText_(cell_(row, 'recipe_note'));
  }, dryRun);

  summary.qaRows.base_products = deleteRowsByPredicate_('base_products', function (row) {
    return startsQa_(cell_(row, 'product_id')) || hasQaText_(cell_(row, 'store_note'));
  }, dryRun);

  summary.qaRows.calendar_plan = deleteRowsByPredicate_('calendar_plan', function (row) {
    return cell_(row, 'day_label') === 'qa' ||
      startsQa_(cell_(row, 'option_a_dish_id')) ||
      startsQa_(cell_(row, 'option_b_dish_id')) ||
      startsQa_(cell_(row, 'quick_dish_id')) ||
      startsQa_(cell_(row, 'selected_dish_id')) ||
      hasQaText_(cell_(row, 'note'));
  }, dryRun);

  summary.qaRows.shopping_sessions = deleteRowsByPredicate_('shopping_sessions', function (row) {
    return startsQa_(cell_(row, 'session_id')) || hasQaText_(cell_(row, 'note'));
  }, dryRun);

  summary.qaRows.selected_dinners = deleteRowsByPredicate_('selected_dinners', function (row) {
    return startsQa_(cell_(row, 'id')) ||
      startsQa_(cell_(row, 'dish_id')) ||
      cell_(row, 'day_label') === 'qa' ||
      hasQaText_(cell_(row, 'note')) ||
      isLegacyProductionSeedSelection_(row);
  }, dryRun);

  summary.duplicateSelectedDinners = dedupeRowsByKey_('selected_dinners', 'id', dryRun);
  Object.keys(summary.qaRows).forEach(function (name) {
    summary.deletedRows += summary.qaRows[name];
  });
  summary.deletedRows += summary.duplicateSelectedDinners;
  return summary;
}

function migrateLegacyData() {
  setupSheets();
  var ss = SpreadsheetApp.getActive();
  var migrated = { dishes: 0, ingredients: 0, baseProducts: 0 };
  if (ss.getSheetByName(LEGACY.catalog)) {
    getLegacyRows_(LEGACY.catalog).forEach(function (row) {
      var dishId = cell_(row, 'Dish ID') || Utilities.getUuid();
      upsertByKey_('dishes', 'dish_id', dishId, {
        dish_id: dishId,
        dish_name: cell_(row, 'Dish name'),
        category: 'ужин',
        main_protein: '',
        cooking_time_min: parseTime_(cell_(row, 'Cooking time')),
        difficulty: cell_(row, 'Difficulty') || 'easy',
        portions: cell_(row, 'Portions') || 2,
        leftovers: cell_(row, 'Leftovers') || '',
        budget_level: cell_(row, 'Budget level') || 'medium',
        best_day_type: cell_(row, 'Best day type') || 'any',
        tags: cell_(row, 'Main ingredients'),
        recipe_note: cell_(row, 'Comment'),
        active: 'yes',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      migrated.dishes++;
    });
  }
  if (ss.getSheetByName(LEGACY.shopping)) {
    getLegacyRows_(LEGACY.shopping).forEach(function (row, index) {
      appendByHeaders_('dish_ingredients', {
        dish_id: cell_(row, 'Dish ID') || findDishIdByName_(cell_(row, 'Dish name')),
        product_id: 'MIG-' + index,
        product_name: cell_(row, 'Product'),
        category: 'прочее',
        quantity: cell_(row, 'Approx quantity'),
        unit: '',
        required_optional: cell_(row, 'Required / optional') || 'required',
        replacement: cell_(row, 'Can be replaced with'),
        comment: cell_(row, 'Comment')
      });
      migrated.ingredients++;
    });
  }
  if (ss.getSheetByName(LEGACY.base)) {
    getLegacyRows_(LEGACY.base).forEach(function (row, index) {
      upsertByKey_('base_products', 'product_id', 'BASE-MIG-' + index, {
        product_id: 'BASE-MIG-' + index,
        product_name: cell_(row, 'Product'),
        category: 'прочее',
        default_quantity: cell_(row, 'Approx quantity'),
        unit: '',
        price_per_unit: '',
        estimated_package_price: '',
        store_note: cell_(row, 'Comment'),
        buy_fresh_or_store: cell_(row, 'Buy fresh / can store'),
        include_by_default: 'yes',
        active: 'yes',
        updated_at: new Date().toISOString()
      });
      migrated.baseProducts++;
    });
  }
  return migrated;
}

function upsertDish_(dish) {
  upsertByKey_('dishes', 'dish_id', dish.dishId, {
    dish_id: dish.dishId,
    dish_name: dish.dishName,
    category: dish.category,
    main_protein: dish.mainProtein,
    cooking_time_min: dish.cookingTimeMin || '',
    difficulty: dish.difficulty,
    portions: dish.portions,
    leftovers: dish.leftovers ? 'yes' : 'no',
    budget_level: dish.budgetLevel,
    best_day_type: dish.bestDayType,
    tags: (dish.tags || []).join(', '),
    recipe_note: dish.recipeNote || '',
    active: dish.active ? 'yes' : 'no',
    created_at: dish.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString()
  });
  deleteRowsByKey_('dish_ingredients', 'dish_id', dish.dishId);
  (dish.ingredients || []).forEach(function (ingredient) {
    appendByHeaders_('dish_ingredients', {
      dish_id: dish.dishId,
      product_id: ingredient.productId || Utilities.getUuid(),
      product_name: ingredient.productName,
      category: ingredient.category,
      quantity: ingredient.quantity,
      unit: ingredient.unit,
      required_optional: ingredient.requiredOptional || 'required',
      replacement: ingredient.replacement || '',
      comment: ingredient.comment || ''
    });
  });
}

function upsertBaseProduct_(product) {
  upsertByKey_('base_products', 'product_id', product.productId, {
    product_id: product.productId,
    product_name: product.productName,
    category: product.category,
    default_quantity: product.defaultQuantity,
    unit: product.unit,
    price_per_unit: product.pricePerUnit || '',
    estimated_package_price: product.estimatedPackagePrice || '',
    store_note: product.storeNote || '',
    buy_fresh_or_store: product.buyFreshOrStore || '',
    include_by_default: product.includeByDefault ? 'yes' : 'no',
    active: product.active ? 'yes' : 'no',
    updated_at: new Date().toISOString()
  });
}

function getShoppingSessions_(limit) {
  setupSheets();
  return readShoppingSessions_(limit);
}

function readShoppingSessions_(limit) {
  return readRows_('shopping_sessions').filter(notEmptyRow_).reverse().slice(0, limit || 20).map(function (row) {
    return {
      sessionId: cell_(row, 'session_id'),
      createdAt: cell_(row, 'created_at'),
      dateFrom: cell_(row, 'date_from'),
      dateTo: cell_(row, 'date_to'),
      selectedDishes: parseJson_(cell_(row, 'selected_dishes_json'), []),
      includeBaseProducts: toBool_(cell_(row, 'include_base_products')),
      shoppingList: parseJson_(cell_(row, 'shopping_list_json'), []),
      estimatedTotal: Number(cell_(row, 'estimated_total')) || 0,
      note: cell_(row, 'note')
    };
  });
}

function seedSettings_() {
  if (getRows_('settings').length) return;
  var now = new Date().toISOString();
  [
    { key: 'weeklyBudget', value: '25000', comment: 'Недельный бюджет' },
    { key: 'peopleCount', value: '2', comment: 'Количество человек' },
    { key: 'forbiddenProducts', value: 'брокколи, цветная капуста, фасоль, бобовые, нут', comment: 'Запрещённые продукты' }
  ].forEach(function (row) {
    appendByHeaders_('settings', {
      key: row.key,
      value: row.value,
      comment: row.comment,
      updated_at: now
    });
  });
}

function ensureSheet_(name, headers) {
  var ss = SpreadsheetApp.getActive();
  var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sheet.getLastRow() === 0) sheet.appendRow(headers);
  var existing = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), headers.length)).getValues()[0].map(trim_);
  headers.forEach(function (header) {
    if (existing.indexOf(header) < 0) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header);
      existing.push(header);
    }
  });
  return sheet;
}

function getRows_(sheetName) {
  var sheet = ensureSheet_(sheetName, SHEETS[sheetName]);
  return rowsFromSheet_(sheet);
}

function readRows_(sheetName) {
  var sheet = SpreadsheetApp.getActive().getSheetByName(sheetName);
  return sheet ? rowsFromSheet_(sheet) : [];
}

function getLegacyRows_(sheetName) {
  var sheet = SpreadsheetApp.getActive().getSheetByName(sheetName);
  if (!sheet) return [];
  return rowsFromSheet_(sheet);
}

function rowsFromSheet_(sheet) {
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0].map(trim_);
  return values.slice(1).map(function (row) {
    var object = {};
    headers.forEach(function (header, index) { object[header] = trim_(row[index]); });
    return object;
  });
}

function appendByHeaders_(sheetName, values) {
  var sheet = ensureSheet_(sheetName, SHEETS[sheetName]);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(trim_);
  sheet.appendRow(headers.map(function (header) { return values[header] === undefined ? '' : values[header]; }));
}

function upsertByKey_(sheetName, keyHeader, keyValue, values) {
  var sheet = ensureSheet_(sheetName, SHEETS[sheetName]);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(trim_);
  var keyIndex = headers.indexOf(keyHeader);
  if (keyIndex < 0) throwUserError_('Missing key column: ' + keyHeader);
  var rows = sheet.getDataRange().getValues();
  var rowIndex = -1;
  for (var i = 1; i < rows.length; i++) {
    if (trim_(rows[i][keyIndex]) === trim_(keyValue)) rowIndex = i + 1;
  }
  var row = headers.map(function (header) { return values[header] === undefined ? '' : values[header]; });
  if (rowIndex > 0) sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
  else sheet.appendRow(row);
}

function deleteRowsByKey_(sheetName, keyHeader, keyValue) {
  var sheet = ensureSheet_(sheetName, SHEETS[sheetName]);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(trim_);
  var keyIndex = headers.indexOf(keyHeader);
  var values = sheet.getDataRange().getValues();
  for (var i = values.length - 1; i >= 1; i--) {
    if (trim_(values[i][keyIndex]) === trim_(keyValue)) sheet.deleteRow(i + 1);
  }
}

function deleteRowsByPredicate_(sheetName, predicate, dryRun) {
  var sheet = ensureSheet_(sheetName, SHEETS[sheetName]);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(trim_);
  var values = sheet.getDataRange().getValues();
  var rowsToDelete = [];
  for (var i = 1; i < values.length; i++) {
    var row = {};
    headers.forEach(function (header, index) { row[header] = trim_(values[i][index]); });
    if (predicate(row)) rowsToDelete.push(i + 1);
  }
  if (!dryRun) {
    for (var j = rowsToDelete.length - 1; j >= 0; j--) {
      sheet.deleteRow(rowsToDelete[j]);
    }
  }
  return rowsToDelete.length;
}

function dedupeRowsByKey_(sheetName, keyHeader, dryRun) {
  var sheet = ensureSheet_(sheetName, SHEETS[sheetName]);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(trim_);
  var keyIndex = headers.indexOf(keyHeader);
  if (keyIndex < 0) throwUserError_('Missing key column: ' + keyHeader);
  var values = sheet.getDataRange().getValues();
  var seen = {};
  var rowsToDelete = [];
  for (var i = values.length - 1; i >= 1; i--) {
    var key = trim_(values[i][keyIndex]);
    if (!key) continue;
    if (seen[key]) rowsToDelete.push(i + 1);
    else seen[key] = true;
  }
  if (!dryRun) {
    for (var j = 0; j < rowsToDelete.length; j++) {
      sheet.deleteRow(rowsToDelete[j]);
    }
  }
  return rowsToDelete.length;
}

function addShoppingItem_(merged, item) {
  var key = norm_(item.productName + ':' + (item.unit || ''));
  if (!merged[key]) {
    merged[key] = item;
    return;
  }
  merged[key].quantityText = merged[key].quantityText === item.quantityText ? item.quantityText : merged[key].quantityText + ' + ' + item.quantityText;
  merged[key].usedForDishes = unique_(merged[key].usedForDishes.concat(item.usedForDishes));
  merged[key].comment = merged[key].comment || item.comment;
  merged[key].pricePerUnit = merged[key].pricePerUnit || item.pricePerUnit;
  merged[key].estimatedPrice = (Number(merged[key].estimatedPrice) || 0) + (Number(item.estimatedPrice) || 0) || '';
}

function estimateIngredientPrice_(quantity, unit, product) {
  if (!product || !product.pricePerUnit) return '';
  var numeric = Number(quantity);
  if (!Number.isFinite(numeric)) return '';
  var itemUnit = norm_(unit);
  var priceUnit = norm_(product.unit);
  if (itemUnit === priceUnit) return numeric * Number(product.pricePerUnit);
  if (itemUnit === 'г' && priceUnit === 'кг') return numeric / 1000 * Number(product.pricePerUnit);
  if (itemUnit === 'мл' && priceUnit === 'л') return numeric / 1000 * Number(product.pricePerUnit);
  if (product.estimatedPackagePrice && numeric === 1) return product.estimatedPackagePrice;
  return '';
}

function hasForbidden_(dish, forbiddenProducts) {
  var text = productSearchText_(dish.dishName + ' ' + dish.tags.join(' ') + ' ' + dish.ingredients.map(function (i) { return i.productName; }).join(' '));
  return forbiddenProducts.some(function (product) {
    var token = productSearchToken_(product);
    return token && text.indexOf(' ' + token + ' ') >= 0;
  });
}

function productSearchText_(value) {
  return ' ' + norm_(value).replace(/[^a-zа-я0-9]+/g, ' ') + ' ';
}

function productSearchToken_(value) {
  return norm_(value).replace(/[^a-zа-я0-9]+/g, ' ').trim();
}

function findDishIdByName_(name) {
  var normalized = norm_(name);
  var dish = getDishes().filter(function (item) { return norm_(item.dishName) === normalized; })[0];
  return dish ? dish.dishId : '';
}

function parseTime_(value) {
  var match = String(value || '').match(/\d+/);
  return match ? Number(match[0]) : '';
}

function parseMaybeNumber_(value) {
  var number = Number(value);
  return Number.isFinite(number) && value !== '' ? number : value;
}

function parseJson_(value, fallback) {
  try { return JSON.parse(value || ''); } catch (err) { return fallback; }
}

function split_(value) {
  return String(value || '').split(',').map(trim_).filter(String);
}

function cell_(row, header) {
  return trim_(row[header]);
}

function trim_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(value === undefined || value === null ? '' : value).trim();
}

function norm_(value) {
  return trim_(value).toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');
}

function startsQa_(value) {
  return /^QA-/i.test(trim_(value));
}

function hasQaText_(value) {
  return /QA smoke test/i.test(trim_(value));
}

function isLegacyProductionSeedSelection_(row) {
  return cell_(row, 'source') === 'seed' &&
    cell_(row, 'note') === 'production seed' &&
    /^\d{4}-\d{2}-\d{2}-D-/.test(cell_(row, 'id'));
}

function toBool_(value, defaultValue) {
  if (value === '' || value === undefined || value === null) return !!defaultValue;
  return ['yes', 'true', '1', 'да', 'active'].indexOf(norm_(value)) >= 0;
}

function notEmptyRow_(row) {
  return Object.keys(row).some(function (key) { return trim_(row[key]); });
}

function unique_(list) {
  var seen = {};
  return list.filter(function (item) {
    if (seen[item]) return false;
    seen[item] = true;
    return true;
  });
}

function checkToken_(token) {
  var required = PropertiesService.getScriptProperties().getProperty('API_TOKEN');
  if (required && token !== required) throwUserError_('Нет доступа к API');
}

function safeRun_(fn) {
  try {
    return { ok: true, data: fn() };
  } catch (err) {
    return { ok: false, error: err && err.userMessage ? err.userMessage : 'Ошибка обработки запроса' };
  }
}

function throwUserError_(message) {
  var err = new Error(message);
  err.userMessage = message;
  throw err;
}

function json_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}
