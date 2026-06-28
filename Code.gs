var SHEET_NAMES = {
  MENU: 'Menu with dinner options',
  CATALOG: 'Dinner options catalog',
  SHOPPING: 'Dinner option shopping',
  BASE: 'Base shopping list',
  SELECTED: 'Selected dinners',
  SESSIONS: 'Shopping sessions'
};

var SELECTED_HEADERS = [
  'Timestamp',
  'Planning date',
  'Day',
  'Dish ID',
  'Dish name',
  'Selected option',
  'User note',
  'Status'
];

var SESSION_HEADERS = [
  'Timestamp',
  'Session ID',
  'Selected days',
  'Selected dishes',
  'Include base shopping list',
  'Shopping list JSON',
  'User note'
];

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Планировщик ужинов')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getAppData() {
  return safeRun_(function () {
    ensureSelectedDinnersSheet_();
    ensureShoppingSessionsSheet_();

    var menuResult = getMenuDaysInternal_();
    return {
      menuDays: menuResult.days,
      recentSelections: getRecentSelectionsInternal_(10),
      warnings: menuResult.warnings
    };
  });
}

function getMenuDays() {
  return safeRun_(function () {
    return getMenuDaysInternal_();
  });
}

function getDinnerOptionsByDay(day) {
  return safeRun_(function () {
    var result = getMenuDaysInternal_();
    var wanted = normalizeValue_(day);
    for (var i = 0; i < result.days.length; i++) {
      if (normalizeValue_(result.days[i].day) === wanted) {
        return result.days[i];
      }
    }
    throwUserError_('День не найден в меню: ' + day);
  });
}

function getDishDetails(dishId) {
  return safeRun_(function () {
    var dish = findDishByIdOrName_(dishId);
    if (!dish) {
      throwUserError_('Блюдо не найдено в справочнике: ' + dishId);
    }
    return dish;
  });
}

function getShoppingListForDish(dishId) {
  return safeRun_(function () {
    var dish = findDishByIdOrName_(dishId);
    if (!dish) {
      throwUserError_('Блюдо не найдено в справочнике: ' + dishId);
    }
    return getShoppingRowsForDish_(dish);
  });
}

function buildShoppingList(selectedDishIds, includeBaseList) {
  return safeRun_(function () {
    var selections = normalizeSelections_(selectedDishIds);
    if (!selections.length) {
      throwUserError_('Сначала выберите хотя бы один ужин.');
    }

    var items = [];
    var warnings = [];

    for (var i = 0; i < selections.length; i++) {
      var selection = selections[i];
      var dish = findDishByIdOrName_(selection.dishId || selection.dishName);
      if (!dish) {
        warnings.push('Проверьте справочник блюда: ' + (selection.dishName || selection.dishId));
        continue;
      }

      var rows = getShoppingRowsForDish_(dish);
      if (!rows.length) {
        warnings.push('Для блюда нет списка покупок: ' + dish.dishName);
        continue;
      }

      for (var r = 0; r < rows.length; r++) {
        rows[r].day = selection.day || '';
        rows[r].selectedOption = selection.selectedOption || '';
        items.push(rows[r]);
      }
    }

    if (includeBaseList) {
      items = items.concat(getBaseShoppingItems_());
    }

    var merged = mergeShoppingItems_(items);
    if (!merged.length) {
      warnings.push('Список покупок пустой. Проверьте Dish ID и строки покупок.');
    }

    return {
      items: merged,
      warnings: warnings,
      rawItemCount: items.length
    };
  });
}

function saveSelectedDinners(payload) {
  return safeRun_(function () {
    payload = payload || {};
    var selections = normalizeSelections_(payload.selections || []);
    if (!selections.length) {
      throwUserError_('Сначала выберите хотя бы один ужин.');
    }

    var sheet = ensureSelectedDinnersSheet_();
    var data = getSheetDataByHeaders_(SHEET_NAMES.SELECTED);
    validateHeaders_(data, SELECTED_HEADERS);

    var rows = [];
    var now = new Date();
    var planningDate = normalizeValue_(payload.planningDate) || Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    var userNote = normalizeValue_(payload.userNote);

    for (var i = 0; i < selections.length; i++) {
      var selection = selections[i];
      var dish = findDishByIdOrName_(selection.dishId || selection.dishName);
      rows.push(buildRowByHeaders_(data.headers, {
        'Timestamp': now,
        'Planning date': planningDate,
        'Day': selection.day || '',
        'Dish ID': dish ? dish.dishId : (selection.dishId || ''),
        'Dish name': dish ? dish.dishName : (selection.dishName || ''),
        'Selected option': selection.selectedOption || '',
        'User note': selection.userNote || userNote,
        'Status': 'planned'
      }));
    }

    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, data.headers.length).setValues(rows);
    return { savedRows: rows.length, recentSelections: getRecentSelectionsInternal_(10) };
  });
}

function saveShoppingSession(payload) {
  return safeRun_(function () {
    payload = payload || {};
    var shoppingList = payload.shoppingList || [];
    if (!shoppingList.length) {
      throwUserError_('Сначала сформируйте список покупок.');
    }

    var sheet = ensureShoppingSessionsSheet_();
    var data = getSheetDataByHeaders_(SHEET_NAMES.SESSIONS);
    validateHeaders_(data, SESSION_HEADERS);

    var sessionId = normalizeValue_(payload.sessionId) || generateSessionId_();
    var row = buildRowByHeaders_(data.headers, {
      'Timestamp': new Date(),
      'Session ID': sessionId,
      'Selected days': arrayToText_(payload.selectedDays),
      'Selected dishes': arrayToText_(payload.selectedDishes),
      'Include base shopping list': payload.includeBaseList ? 'yes' : 'no',
      'Shopping list JSON': JSON.stringify(shoppingList),
      'User note': normalizeValue_(payload.userNote)
    });

    sheet.getRange(sheet.getLastRow() + 1, 1, 1, data.headers.length).setValues([row]);
    return { sessionId: sessionId };
  });
}

function getRecentSelections(limit) {
  return safeRun_(function () {
    return getRecentSelectionsInternal_(limit || 10);
  });
}

function ensureSelectedDinnersSheet_() {
  return ensureSheetWithHeaders_(SHEET_NAMES.SELECTED, SELECTED_HEADERS);
}

function ensureShoppingSessionsSheet_() {
  return ensureSheetWithHeaders_(SHEET_NAMES.SESSIONS, SESSION_HEADERS);
}

function getMenuDaysInternal_() {
  var menu = getSheetDataByHeaders_(SHEET_NAMES.MENU);
  validateHeaders_(menu, [
    'Day',
    'Dinner Option A',
    'Dinner Option B',
    'Optional Quick Dinner'
  ]);

  var warnings = [];
  var days = [];
  var optionColumns = [
    { label: 'Вариант A', header: 'Dinner Option A' },
    { label: 'Вариант B', header: 'Dinner Option B' },
    { label: 'Быстрый вариант', header: 'Optional Quick Dinner' }
  ];

  for (var i = 0; i < menu.rows.length; i++) {
    var row = menu.rows[i];
    var day = getCell_(row, 'Day');
    if (!day) {
      continue;
    }

    var dayItem = {
      day: day,
      breakfast: getCell_(row, 'Breakfast'),
      lunch: getCell_(row, 'Lunch for 1 person'),
      bestChoiceIfShortOnTime: getCell_(row, 'Best choice if short on time'),
      leftoversPossible: getCell_(row, 'Leftovers possible'),
      notes: getCell_(row, 'Notes'),
      options: []
    };

    for (var o = 0; o < optionColumns.length; o++) {
      var optionValue = getCell_(row, optionColumns[o].header);
      if (!optionValue) {
        continue;
      }

      var dish = findDishByIdOrName_(optionValue);
      if (!dish) {
        dayItem.options.push({
          selectedOption: optionColumns[o].label,
          dishId: extractDishId_(optionValue) || optionValue,
          dishName: normalizeDishNameForCompare_(optionValue) || optionValue,
          sourceValue: optionValue,
          catalogFound: false,
          cookingTime: '',
          difficulty: '',
          portions: '',
          leftovers: '',
          budgetLevel: '',
          bestDayType: '',
          comment: 'Нужно проверить справочник блюда'
        });
      } else {
        dish.selectedOption = optionColumns[o].label;
        dish.sourceValue = optionValue;
        dish.catalogFound = true;
        dayItem.options.push(dish);
      }
    }

    days.push(dayItem);
  }

  return { days: days, warnings: warnings };
}

function getRecentSelectionsInternal_(limit) {
  ensureSelectedDinnersSheet_();
  var data = getSheetDataByHeaders_(SHEET_NAMES.SELECTED);
  validateHeaders_(data, SELECTED_HEADERS);

  var rows = data.rows.slice(-Number(limit || 10)).reverse();
  var result = [];
  for (var i = 0; i < rows.length; i++) {
    result.push({
      timestamp: getCell_(rows[i], 'Timestamp'),
      planningDate: getCell_(rows[i], 'Planning date'),
      day: getCell_(rows[i], 'Day'),
      dishId: getCell_(rows[i], 'Dish ID'),
      dishName: getCell_(rows[i], 'Dish name'),
      selectedOption: getCell_(rows[i], 'Selected option'),
      status: getCell_(rows[i], 'Status')
    });
  }
  return result;
}

function getShoppingRowsForDish_(dish) {
  var shopping = getSheetDataByHeaders_(SHEET_NAMES.SHOPPING);
  validateHeaders_(shopping, [
    'Dish ID',
    'Dish name',
    'Product',
    'Approx quantity',
    'Required / optional',
    'Can be replaced with',
    'Comment'
  ]);

  var rows = [];
  var dishIdKey = normalizeKey_(extractDishId_(dish.dishId) || dish.dishId);
  var dishNameKey = normalizeKey_(dish.dishName);

  for (var i = 0; i < shopping.rows.length; i++) {
    var row = shopping.rows[i];
    var rawRowDishId = getCell_(row, 'Dish ID');
    var rowDishId = normalizeKey_(extractDishId_(rawRowDishId) || rawRowDishId);
    var rowDishName = normalizeKey_(getCell_(row, 'Dish name'));
    var product = getCell_(row, 'Product');

    if (!product) {
      continue;
    }

    if ((dishIdKey && rowDishId === dishIdKey) || (!rowDishId && rowDishName === dishNameKey) || (dishNameKey && rowDishName === dishNameKey)) {
      rows.push({
        product: product,
        quantity: getCell_(row, 'Approx quantity'),
        requiredOptional: getCell_(row, 'Required / optional') || 'required',
        canBeReplacedWith: getCell_(row, 'Can be replaced with'),
        comment: getCell_(row, 'Comment'),
        usedForDishes: [dish.dishName],
        dishId: dish.dishId,
        dishName: dish.dishName,
        sourceType: 'dinner'
      });
    }
  }

  return rows;
}

function getBaseShoppingItems_() {
  var base = getSheetDataByHeaders_(SHEET_NAMES.BASE);
  validateHeaders_(base, [
    'Week',
    'Product',
    'Approx quantity',
    'Used broadly for',
    'Buy fresh / can store',
    'Comment'
  ]);

  var items = [];
  for (var i = 0; i < base.rows.length; i++) {
    var row = base.rows[i];
    var product = getCell_(row, 'Product');
    if (!product) {
      continue;
    }
    items.push({
      product: product,
      quantity: getCell_(row, 'Approx quantity'),
      requiredOptional: 'base',
      canBeReplacedWith: '',
      comment: compactText_([getCell_(row, 'Buy fresh / can store'), getCell_(row, 'Comment')], '; '),
      usedForDishes: [getCell_(row, 'Used broadly for') || 'Base shopping list'],
      dishId: '',
      dishName: 'Base shopping list',
      sourceType: 'base'
    });
  }
  return items;
}

function mergeShoppingItems_(items) {
  var map = {};
  var order = [];

  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var key = normalizeKey_(item.product);
    if (!key) {
      continue;
    }

    if (!map[key]) {
      map[key] = {
        key: key,
        product: normalizeValue_(item.product),
        quantities: [],
        usedForDishes: [],
        requirementValues: [],
        replacementValues: [],
        commentValues: [],
        sourceTypes: []
      };
      order.push(key);
    }

    addUnique_(map[key].quantities, item.quantity);
    addUniqueMany_(map[key].usedForDishes, item.usedForDishes || []);
    addUnique_(map[key].requirementValues, item.requiredOptional);
    addUnique_(map[key].replacementValues, item.canBeReplacedWith);
    addUnique_(map[key].commentValues, item.comment);
    addUnique_(map[key].sourceTypes, item.sourceType);
  }

  var result = [];
  for (var k = 0; k < order.length; k++) {
    var merged = map[order[k]];
    result.push({
      key: merged.key,
      product: merged.product,
      totalQuantity: merged.quantities.join(' + '),
      usedForDishes: merged.usedForDishes,
      requiredOptional: merged.requirementValues.join(' + '),
      canBeReplacedWith: merged.replacementValues.join('; '),
      comment: merged.commentValues.join('; '),
      sourceTypes: merged.sourceTypes,
      inCart: false
    });
  }

  return result;
}

function findDishByIdOrName_(value) {
  var query = normalizeValue_(value);
  if (!query) {
    return null;
  }

  var catalog = getSheetDataByHeaders_(SHEET_NAMES.CATALOG);
  validateHeaders_(catalog, [
    'Dish ID',
    'Dish name',
    'Best day type',
    'Cooking time',
    'Difficulty',
    'Portions',
    'Leftovers',
    'Budget level',
    'Comment'
  ]);

  var extractedDishId = extractDishId_(query);
  var queryKey = normalizeKey_(extractedDishId || query);
  var queryNameKey = normalizeDishNameForCompare_(query);
  var fallbackByName = null;

  for (var i = 0; i < catalog.rows.length; i++) {
    var row = catalog.rows[i];
    var dishId = getCell_(row, 'Dish ID');
    var dishName = getCell_(row, 'Dish name');

    if (!dishId && !dishName) {
      continue;
    }

    if (normalizeKey_(extractDishId_(dishId) || dishId) === queryKey) {
      return dishFromCatalogRow_(row);
    }
    if (normalizeDishNameForCompare_(dishName) === queryNameKey) {
      fallbackByName = dishFromCatalogRow_(row);
    }
  }

  return fallbackByName;
}

function dishFromCatalogRow_(row) {
  return {
    dishId: getCell_(row, 'Dish ID'),
    dishName: getCell_(row, 'Dish name'),
    sourceMenu: getCell_(row, 'Source menu'),
    bestDayType: getCell_(row, 'Best day type'),
    mainIngredients: getCell_(row, 'Main ingredients'),
    cookingTime: getCell_(row, 'Cooking time'),
    difficulty: getCell_(row, 'Difficulty'),
    portions: getCell_(row, 'Portions'),
    leftovers: getCell_(row, 'Leftovers'),
    budgetLevel: getCell_(row, 'Budget level'),
    comment: getCell_(row, 'Comment')
  };
}

function getSheetDataByHeaders_(sheetName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throwUserError_('Не найдена обязательная вкладка: ' + sheetName);
  }

  var values = sheet.getDataRange().getValues();
  if (!values.length || !values[0].length) {
    throwUserError_('Во вкладке нет строки заголовков: ' + sheetName);
  }

  var headers = [];
  var headerMap = {};
  for (var h = 0; h < values[0].length; h++) {
    var header = normalizeValue_(values[0][h]);
    headers.push(header);
    if (header) {
      headerMap[normalizeHeader_(header)] = h;
    }
  }

  var rows = [];
  for (var r = 1; r < values.length; r++) {
    if (isEmptyRow_(values[r])) {
      continue;
    }
    rows.push({ values: values[r], headers: headers, headerMap: headerMap });
  }

  return { sheet: sheet, headers: headers, headerMap: headerMap, rows: rows };
}

function normalizeHeader_(value) {
  return normalizeValue_(value).toLowerCase().replace(/\s+/g, ' ');
}

function normalizeValue_(value) {
  if (value === null || value === undefined) {
    return '';
  }
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(value).replace(/\s+/g, ' ').trim();
}

function normalizeKey_(value) {
  return normalizeValue_(value).toLowerCase();
}

function extractDishId_(value) {
  var text = normalizeValue_(value);
  var match = text.match(/\bD\d+\b/i);
  return match ? match[0].toUpperCase() : '';
}

function normalizeDishNameForCompare_(value) {
  return normalizeValue_(value)
    .replace(/^\s*D\d+\b\s*[-–—:]?\s*/i, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function getCell_(row, header) {
  var index = row.headerMap[normalizeHeader_(header)];
  if (index === undefined) {
    return '';
  }
  return normalizeValue_(row.values[index]);
}

function ensureSheetWithHeaders_(sheetName, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    return sheet;
  }

  if (sheet.getLastRow() === 0 || sheet.getLastColumn() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    return sheet;
  }

  var existing = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
  var currentHeaders = [];
  var existingMap = {};
  for (var i = 0; i < existing.length; i++) {
    var header = normalizeValue_(existing[i]);
    currentHeaders.push(header);
    if (header) {
      existingMap[normalizeHeader_(header)] = true;
    }
  }

  var missing = [];
  for (var h = 0; h < headers.length; h++) {
    if (!existingMap[normalizeHeader_(headers[h])]) {
      missing.push(headers[h]);
    }
  }

  if (missing.length) {
    sheet.getRange(1, currentHeaders.length + 1, 1, missing.length).setValues([missing]);
  }
  sheet.setFrozenRows(1);
  return sheet;
}

function validateHeaders_(data, requiredHeaders) {
  var missing = [];
  for (var i = 0; i < requiredHeaders.length; i++) {
    if (data.headerMap[normalizeHeader_(requiredHeaders[i])] === undefined) {
      missing.push(requiredHeaders[i]);
    }
  }
  if (missing.length) {
    throwUserError_('Во вкладке "' + data.sheet.getName() + '" нет колонок: ' + missing.join(', '));
  }
}

function buildRowByHeaders_(headers, valuesByHeader) {
  var row = [];
  var normalizedValues = {};
  for (var key in valuesByHeader) {
    if (Object.prototype.hasOwnProperty.call(valuesByHeader, key)) {
      normalizedValues[normalizeHeader_(key)] = valuesByHeader[key];
    }
  }

  for (var i = 0; i < headers.length; i++) {
    var header = headers[i];
    var normalizedHeader = normalizeHeader_(header);
    row.push(normalizedValues[normalizedHeader] !== undefined ? normalizedValues[normalizedHeader] : '');
  }
  return row;
}

function normalizeSelections_(selectedDishIds) {
  var source = selectedDishIds || [];
  var result = [];

  for (var i = 0; i < source.length; i++) {
    var item = source[i];
    if (typeof item === 'string') {
      if (normalizeValue_(item)) {
        result.push({ dishId: normalizeValue_(item), dishName: '', day: '', selectedOption: '', userNote: '' });
      }
    } else if (item) {
      var dishId = normalizeValue_(item.dishId);
      var dishName = normalizeValue_(item.dishName);
      if (dishId || dishName) {
        result.push({
          dishId: dishId,
          dishName: dishName,
          day: normalizeValue_(item.day),
          selectedOption: normalizeValue_(item.selectedOption),
          userNote: normalizeValue_(item.userNote)
        });
      }
    }
  }

  return result;
}

function isEmptyRow_(row) {
  for (var i = 0; i < row.length; i++) {
    if (normalizeValue_(row[i])) {
      return false;
    }
  }
  return true;
}

function addUnique_(list, value) {
  value = normalizeValue_(value);
  if (!value) {
    return;
  }
  for (var i = 0; i < list.length; i++) {
    if (normalizeKey_(list[i]) === normalizeKey_(value)) {
      return;
    }
  }
  list.push(value);
}

function addUniqueMany_(list, values) {
  for (var i = 0; i < values.length; i++) {
    addUnique_(list, values[i]);
  }
}

function compactText_(values, separator) {
  var result = [];
  for (var i = 0; i < values.length; i++) {
    addUnique_(result, values[i]);
  }
  return result.join(separator || '; ');
}

function arrayToText_(value) {
  if (!value) {
    return '';
  }
  if (Object.prototype.toString.call(value) === '[object Array]') {
    return value.join(', ');
  }
  return normalizeValue_(value);
}

function generateSessionId_() {
  return 'SHOP-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss') + '-' + Math.floor(Math.random() * 10000);
}

function safeRun_(fn) {
  try {
    return { ok: true, data: fn() };
  } catch (error) {
    return {
      ok: false,
      message: error && error.userMessage ? error.userMessage : 'Что-то пошло не так. Проверьте структуру таблицы и попробуйте ещё раз.'
    };
  }
}

function throwUserError_(message) {
  var error = new Error(message);
  error.userMessage = message;
  throw error;
}
