import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

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
      await new Promise((resolveRetry) => setTimeout(resolveRetry, attempt * 2500));
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

const extraBaseProducts = [
  ['BP-025', 'Куриная голень', categories.meat, 1, 'кг', 1350, 1350, 'охлаждённая, для духовки и супов', 'свежее', false],
  ['BP-026', 'Филе судака', categories.meat, 1, 'кг', 3200, 3200, 'можно заменить минтаем', 'свежее', false],
  ['BP-027', 'Печень говяжья', categories.meat, 1, 'кг', 1600, 1600, 'охлаждённая', 'свежее', false],
  ['BP-028', 'Фарш индейки', categories.meat, 1, 'кг', 2500, 2500, 'для тефтелей и котлет', 'свежее', false],
  ['BP-029', 'Лаваш', categories.grains, 1, 'уп', 450, 450, 'тонкий', 'можно хранить', false],
  ['BP-030', 'Капуста белокочанная', categories.vegetables, 1, 'кг', 260, 260, 'не цветная капуста', 'можно хранить', false],
  ['BP-031', 'Перец сладкий', categories.vegetables, 1, 'кг', 900, 900, 'для фаршировки и салатов', 'свежее', false],
  ['BP-032', 'Кабачок', categories.vegetables, 1, 'кг', 650, 650, 'по сезону', 'свежее', false],
  ['BP-033', 'Баклажан', categories.vegetables, 1, 'кг', 850, 850, 'по сезону', 'свежее', false],
  ['BP-034', 'Шампиньоны', categories.vegetables, 1, 'кг', 1200, 1200, 'свежие', 'свежее', false],
  ['BP-035', 'Сливки', categories.dairy, 1, 'уп', 780, 780, '10-20%', 'свежее', false],
  ['BP-036', 'Кефир', categories.dairy, 1, 'л', 520, 520, 'для маринада и оладий', 'свежее', false],
  ['BP-037', 'Сливочное масло', categories.dairy, 1, 'уп', 1100, 1100, '180-200 г', 'можно хранить', false],
  ['BP-038', 'Овсяные хлопья', categories.grains, 1, 'кг', 850, 850, 'долгой варки', 'можно хранить', false],
  ['BP-039', 'Кускус', categories.grains, 1, 'уп', 900, 900, '400-500 г', 'можно хранить', false],
  ['BP-040', 'Булгур', categories.grains, 1, 'кг', 900, 900, 'крупа', 'можно хранить', false],
  ['BP-041', 'Гречневая лапша', categories.grains, 1, 'уп', 950, 950, 'соба или аналог', 'можно хранить', false],
  ['BP-042', 'Лапша', categories.grains, 1, 'уп', 520, 520, 'для супа и лагмана', 'можно хранить', false],
  ['BP-043', 'Соевый соус', categories.grocery, 1, 'бут', 850, 850, '250 мл', 'можно хранить', false],
  ['BP-044', 'Тунец консервированный', categories.grocery, 1, 'банка', 850, 850, 'в собственном соку', 'можно хранить', false],
  ['BP-045', 'Томатная паста', categories.grocery, 1, 'банка', 550, 550, 'маленькая банка', 'можно хранить', false],
  ['BP-046', 'Чеснок', categories.vegetables, 1, 'головка', 150, 150, 'для маринадов', 'можно хранить', false],
  ['BP-047', 'Лимон', categories.fruits, 1, 'шт', 280, 280, 'для рыбы', 'свежее', false],
  ['BP-048', 'Филе индейки', categories.meat, 1, 'кг', 2600, 2600, 'охлаждённое', 'свежее', false],
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

const extraDishes = [
  dish('D-021', 'Куриные голени с булгуром', 'курица', 70, 'easy', 4, true, 'low', 'weekday', ['духовка', 'бюджетно', 'остатки'], 'Запечь голени, булгур сварить отдельно, подать с овощами.', [
    ingredient('Куриная голень', categories.meat, 1, 'кг'),
    ingredient('Булгур', categories.grains, 350, 'г'),
    ingredient('Морковь', categories.vegetables, 2, 'шт'),
    ingredient('Лук', categories.vegetables, 1, 'шт'),
    ingredient('Чеснок', categories.vegetables, 1, 'головка'),
  ]),
  dish('D-022', 'Индейка в сливочном соусе с гречкой', 'индейка', 55, 'easy', 3, true, 'medium', 'weekday', ['будни', 'до 60 минут'], 'Индейку потушить со сливками, гречку сварить отдельно.', [
    ingredient('Филе индейки', categories.meat, 650, 'г'),
    ingredient('Сливки', categories.dairy, 1, 'уп'),
    ingredient('Гречка', categories.grains, 300, 'г'),
    ingredient('Лук', categories.vegetables, 1, 'шт'),
    ingredient('Шампиньоны', categories.vegetables, 250, 'г'),
  ]),
  dish('D-023', 'Судак в сметанном соусе с рисом', 'рыба', 60, 'medium', 3, false, 'high', 'weekday', ['рыба', 'до 60 минут'], 'Рыбу потушить в сметанном соусе, рис сварить на гарнир.', [
    ingredient('Филе судака', categories.meat, 700, 'г'),
    ingredient('Сметана', categories.dairy, 180, 'г'),
    ingredient('Рис', categories.grains, 280, 'г'),
    ingredient('Лук', categories.vegetables, 1, 'шт'),
    ingredient('Лимон', categories.fruits, 1, 'шт'),
  ]),
  dish('D-024', 'Лаваш-роллы с курицей и овощами', 'курица', 35, 'easy', 2, false, 'medium', 'weekday', ['быстро', 'до 45 минут', 'без духовки'], 'Курицу обжарить, завернуть в лаваш с овощами и йогуртовым соусом.', [
    ingredient('Лаваш', categories.grains, 1, 'уп'),
    ingredient('Куриное филе', categories.meat, 450, 'г'),
    ingredient('Огурцы', categories.vegetables, 2, 'шт'),
    ingredient('Томаты', categories.vegetables, 2, 'шт'),
    ingredient('Йогурт', categories.dairy, 150, 'г'),
  ]),
  dish('D-025', 'Ленивые голубцы с рисом', 'фарш', 75, 'medium', 4, true, 'low', 'weekday', ['остатки', 'бюджетно'], 'Фарш, рис и капусту потушить в томатном соусе.', [
    ingredient('Говяжий фарш', categories.meat, 650, 'г'),
    ingredient('Капуста белокочанная', categories.vegetables, 600, 'г'),
    ingredient('Рис', categories.grains, 180, 'г'),
    ingredient('Томатная паста', categories.grocery, 2, 'ст. л.'),
    ingredient('Сметана', categories.dairy, 150, 'г'),
  ]),
  dish('D-026', 'Перцы фаршированные', 'фарш', 85, 'medium', 4, true, 'medium', 'weekend', ['выходной вариант', 'остатки'], 'Перцы наполнить фаршем и рисом, потушить в томатном соусе.', [
    ingredient('Перец сладкий', categories.vegetables, 1, 'кг'),
    ingredient('Говяжий фарш', categories.meat, 650, 'г'),
    ingredient('Рис', categories.grains, 160, 'г'),
    ingredient('Лук', categories.vegetables, 1, 'шт'),
    ingredient('Томатная паста', categories.grocery, 2, 'ст. л.'),
  ]),
  dish('D-027', 'Курица терияки с гречневой лапшой', 'курица', 40, 'easy', 3, false, 'medium', 'weekday', ['быстро', 'без духовки', 'до 60 минут'], 'Курицу быстро обжарить с соевым соусом, смешать с лапшой.', [
    ingredient('Куриное филе', categories.meat, 550, 'г'),
    ingredient('Гречневая лапша', categories.grains, 300, 'г'),
    ingredient('Соевый соус', categories.grocery, 3, 'ст. л.'),
    ingredient('Морковь', categories.vegetables, 1, 'шт'),
    ingredient('Чеснок', categories.vegetables, 2, 'зубчика'),
  ]),
  dish('D-028', 'Печень с картофельным пюре', 'говядина', 55, 'easy', 3, true, 'low', 'weekday', ['бюджетно', 'до 60 минут'], 'Печень быстро обжарить с луком, подать с пюре.', [
    ingredient('Печень говяжья', categories.meat, 700, 'г'),
    ingredient('Картофель', categories.vegetables, 1, 'кг'),
    ingredient('Молоко', categories.dairy, 200, 'мл'),
    ingredient('Сливочное масло', categories.dairy, 50, 'г'),
    ingredient('Лук', categories.vegetables, 2, 'шт'),
  ]),
  dish('D-029', 'Кускус с курицей и овощами', 'курица', 35, 'easy', 3, true, 'medium', 'weekday', ['быстро', 'без духовки'], 'Курица и овощи на сковороде, кускус запарить отдельно.', [
    ingredient('Куриное филе', categories.meat, 550, 'г'),
    ingredient('Кускус', categories.grains, 300, 'г'),
    ingredient('Перец сладкий', categories.vegetables, 300, 'г'),
    ingredient('Морковь', categories.vegetables, 1, 'шт'),
    ingredient('Томаты', categories.vegetables, 2, 'шт'),
  ]),
  dish('D-030', 'Тефтели из индейки с булгуром', 'индейка', 65, 'medium', 4, true, 'medium', 'weekday', ['остатки', 'будни'], 'Тефтели потушить в лёгком соусе, булгур на гарнир.', [
    ingredient('Фарш индейки', categories.meat, 700, 'г'),
    ingredient('Булгур', categories.grains, 320, 'г'),
    ingredient('Яйца', categories.eggs, 1, 'шт'),
    ingredient('Лук', categories.vegetables, 1, 'шт'),
    ingredient('Сметана', categories.dairy, 150, 'г'),
  ]),
  dish('D-031', 'Говядина по-строгановски с макаронами', 'говядина', 75, 'medium', 4, true, 'medium', 'weekday', ['остатки', 'будни'], 'Говядину потушить со сметаной, подать с макаронами.', [
    ingredient('Говядина', categories.meat, 750, 'г'),
    ingredient('Макароны', categories.grains, 400, 'г'),
    ingredient('Сметана', categories.dairy, 200, 'г'),
    ingredient('Лук', categories.vegetables, 2, 'шт'),
    ingredient('Шампиньоны', categories.vegetables, 250, 'г', { requiredOptional: 'optional' }),
  ]),
  dish('D-032', 'Рыбная запеканка с картофелем', 'рыба', 80, 'medium', 4, true, 'medium', 'weekend', ['духовка', 'рыба', 'остатки'], 'Слои картофеля и рыбы запечь со сметаной.', [
    ingredient('Филе минтая', categories.meat, 800, 'г'),
    ingredient('Картофель', categories.vegetables, 1.2, 'кг'),
    ingredient('Сметана', categories.dairy, 200, 'г'),
    ingredient('Лук', categories.vegetables, 1, 'шт'),
    ingredient('Сыр', categories.dairy, 120, 'г'),
  ]),
  dish('D-033', 'Домашняя шаурма с курицей', 'курица', 45, 'easy', 3, false, 'medium', 'weekday', ['быстро', 'без духовки'], 'Курицу обжарить, собрать шаурму с овощами и соусом.', [
    ingredient('Лаваш', categories.grains, 1, 'уп'),
    ingredient('Куриное филе', categories.meat, 600, 'г'),
    ingredient('Капуста белокочанная', categories.vegetables, 300, 'г'),
    ingredient('Огурцы', categories.vegetables, 2, 'шт'),
    ingredient('Йогурт', categories.dairy, 150, 'г'),
  ]),
  dish('D-034', 'Курица с кабачком и рисом', 'курица', 50, 'easy', 3, true, 'low', 'weekday', ['бюджетно', 'без духовки'], 'Курицу и кабачок потушить на сковороде, рис сварить отдельно.', [
    ingredient('Куриное бедро', categories.meat, 750, 'г'),
    ingredient('Кабачок', categories.vegetables, 600, 'г'),
    ingredient('Рис', categories.grains, 280, 'г'),
    ingredient('Лук', categories.vegetables, 1, 'шт'),
    ingredient('Томатная паста', categories.grocery, 1, 'ст. л.'),
  ]),
  dish('D-035', 'Баклажаны с фаршем и томатами', 'фарш', 70, 'medium', 4, true, 'medium', 'weekend', ['овощи', 'остатки'], 'Баклажаны и фарш потушить в томатном соусе.', [
    ingredient('Баклажан', categories.vegetables, 800, 'г'),
    ingredient('Говяжий фарш', categories.meat, 650, 'г'),
    ingredient('Томаты', categories.vegetables, 3, 'шт'),
    ingredient('Лук', categories.vegetables, 1, 'шт'),
    ingredient('Сыр', categories.dairy, 100, 'г', { requiredOptional: 'optional' }),
  ]),
  dish('D-036', 'Гречка с грибами и курицей', 'курица', 45, 'easy', 4, true, 'low', 'weekday', ['бюджетно', 'быстро'], 'Курицу и грибы обжарить, смешать с гречкой.', [
    ingredient('Куриное филе', categories.meat, 550, 'г'),
    ingredient('Гречка', categories.grains, 350, 'г'),
    ingredient('Шампиньоны', categories.vegetables, 350, 'г'),
    ingredient('Лук', categories.vegetables, 1, 'шт'),
    ingredient('Сметана', categories.dairy, 120, 'г'),
  ]),
  dish('D-037', 'Суп с фрикадельками и лапшой', 'фарш', 60, 'easy', 4, true, 'low', 'weekday', ['суп', 'бюджетно'], 'Фрикадельки, картофель и лапша в лёгком супе.', [
    ingredient('Говяжий фарш', categories.meat, 450, 'г'),
    ingredient('Лапша', categories.grains, 180, 'г'),
    ingredient('Картофель', categories.vegetables, 600, 'г'),
    ingredient('Морковь', categories.vegetables, 1, 'шт'),
    ingredient('Лук', categories.vegetables, 1, 'шт'),
  ]),
  dish('D-038', 'Минтай в кляре с картофелем', 'рыба', 55, 'medium', 3, false, 'medium', 'weekday', ['рыба', 'до 60 минут'], 'Минтай обжарить в кляре, картофель отварить или запечь.', [
    ingredient('Филе минтая', categories.meat, 700, 'г'),
    ingredient('Яйца', categories.eggs, 2, 'шт'),
    ingredient('Мука', categories.grocery, 120, 'г'),
    ingredient('Картофель', categories.vegetables, 900, 'г'),
    ingredient('Лимон', categories.fruits, 1, 'шт'),
  ]),
  dish('D-039', 'Рисовая сковорода с яйцом и курицей', 'курица', 30, 'easy', 3, false, 'low', 'weekday', ['до 30 минут', 'быстро', 'без духовки'], 'Готовый рис быстро обжарить с курицей, яйцом и овощами.', [
    ingredient('Рис', categories.grains, 250, 'г'),
    ingredient('Куриное филе', categories.meat, 450, 'г'),
    ingredient('Яйца', categories.eggs, 2, 'шт'),
    ingredient('Морковь', categories.vegetables, 1, 'шт'),
    ingredient('Соевый соус', categories.grocery, 2, 'ст. л.'),
  ]),
  dish('D-040', 'Картофельное пюре с рыбными котлетами', 'рыба', 70, 'medium', 4, true, 'medium', 'weekday', ['рыба', 'остатки'], 'Котлеты из минтая, пюре на молоке и масле.', [
    ingredient('Филе минтая', categories.meat, 750, 'г'),
    ingredient('Картофель', categories.vegetables, 1.2, 'кг'),
    ingredient('Молоко', categories.dairy, 200, 'мл'),
    ingredient('Сливочное масло', categories.dairy, 50, 'г'),
    ingredient('Яйца', categories.eggs, 1, 'шт'),
  ]),
  dish('D-041', 'Паста с тунцом и томатами', 'рыба', 25, 'easy', 2, false, 'medium', 'weekday', ['до 30 минут', 'быстро'], 'Быстрый соус из тунца и томатов к пасте.', [
    ingredient('Макароны', categories.grains, 250, 'г'),
    ingredient('Тунец консервированный', categories.grocery, 1, 'банка'),
    ingredient('Томаты в собственном соку', categories.grocery, 1, 'банка'),
    ingredient('Лук', categories.vegetables, 1, 'шт'),
    ingredient('Сыр', categories.dairy, 80, 'г', { requiredOptional: 'optional' }),
  ]),
  dish('D-042', 'Курица в кефирном маринаде с картофелем', 'курица', 80, 'easy', 4, true, 'low', 'weekend', ['духовка', 'бюджетно'], 'Курицу замариновать в кефире и запечь с картофелем.', [
    ingredient('Куриная голень', categories.meat, 1.1, 'кг'),
    ingredient('Кефир', categories.dairy, 300, 'мл'),
    ingredient('Картофель', categories.vegetables, 1.2, 'кг'),
    ingredient('Чеснок', categories.vegetables, 1, 'головка'),
    ingredient('Лук', categories.vegetables, 1, 'шт'),
  ]),
  dish('D-043', 'Рулетики из лаваша с фаршем', 'фарш', 65, 'medium', 4, true, 'medium', 'weekend', ['духовка', 'остатки'], 'Фарш завернуть в лаваш, запечь под томатно-сметанным соусом.', [
    ingredient('Лаваш', categories.grains, 1, 'уп'),
    ingredient('Говяжий фарш', categories.meat, 650, 'г'),
    ingredient('Сметана', categories.dairy, 180, 'г'),
    ingredient('Томатная паста', categories.grocery, 2, 'ст. л.'),
    ingredient('Сыр', categories.dairy, 120, 'г'),
  ]),
  dish('D-044', 'Овсяные оладьи с творогом и яблоком', 'творог', 35, 'easy', 2, false, 'low', 'weekday', ['лёгкий ужин', 'быстро'], 'Оладьи из творога и овсяных хлопьев, подать с яблоком.', [
    ingredient('Творог', categories.dairy, 400, 'г'),
    ingredient('Овсяные хлопья', categories.grains, 120, 'г'),
    ingredient('Яйца', categories.eggs, 2, 'шт'),
    ingredient('Кефир', categories.dairy, 100, 'мл'),
    ingredient('Яблоки', categories.fruits, 2, 'шт'),
  ]),
  dish('D-045', 'Говядина с овощами и кускусом', 'говядина', 85, 'medium', 4, true, 'medium', 'weekend', ['выходной вариант', 'остатки'], 'Говядину потушить с овощами, кускус запарить перед подачей.', [
    ingredient('Говядина', categories.meat, 750, 'г'),
    ingredient('Кускус', categories.grains, 350, 'г'),
    ingredient('Перец сладкий', categories.vegetables, 300, 'г'),
    ingredient('Морковь', categories.vegetables, 2, 'шт'),
    ingredient('Томатная паста', categories.grocery, 2, 'ст. л.'),
  ]),
];

const extendedPlan = [
  ['2026-07-12', 'вс', 'D-025', 'D-032', 'D-024'],
  ['2026-07-13', 'пн', 'D-027', 'D-029', 'D-041'],
  ['2026-07-14', 'вт', 'D-036', 'D-023', 'D-039'],
  ['2026-07-15', 'ср', 'D-030', 'D-034', 'D-024'],
  ['2026-07-16', 'чт', 'D-031', 'D-038', 'D-041'],
  ['2026-07-17', 'пт', 'D-033', 'D-022', 'D-039'],
  ['2026-07-18', 'сб', 'D-042', 'D-045', 'D-044'],
].map(([date, dayLabel, optionADishId, optionBDishId, quickDishId]) => ({
  date,
  dayLabel,
  optionADishId,
  optionBDishId,
  quickDishId,
  selectedDishId: '',
  status: 'planned',
  note: 'priority2 menu expansion',
  createdAt: now,
  updatedAt: now,
}));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const before = await call('getAppData');
mkdirSync(resolve('outputs'), { recursive: true });
const backupPath = resolve('outputs', `family-menu-before-priority2-${Date.now()}.json`);
writeFileSync(backupPath, JSON.stringify(before, null, 2), 'utf8');
const existingBaseProductIds = new Set(before.baseProducts.map((item) => item.productId));
const existingDishIds = new Set(before.dishes.map((item) => item.dishId));
const existingPlanDates = new Set(before.calendarPlan.map((item) => item.date));

for (const item of extraBaseProducts.filter((product) => !existingBaseProductIds.has(product.productId))) {
  await call('createBaseProduct', item);
  console.log(`base ${item.productId}`);
}

for (const item of extraDishes.filter((dishItem) => !existingDishIds.has(dishItem.dishId))) {
  await call('createDish', item);
  console.log(`dish ${item.dishId}`);
}

for (const row of extendedPlan.filter((planRow) => !existingPlanDates.has(planRow.date))) {
  await call('saveCalendarPlan', row);
  console.log(`plan ${row.date}`);
}

const after = await call('getAppData');
const activeDishes = after.dishes.filter((item) => item.active);
const activeIncomplete = activeDishes.filter((item) => !(item.ingredients || []).length || !Number(item.cookingTimeMin) || !Number(item.portions) || !item.budgetLevel || !(item.tags || []).length);
const activeBaseProducts = after.baseProducts.filter((item) => item.active);
const pricedActiveBaseProducts = activeBaseProducts.filter((item) => Number(item.pricePerUnit) > 0 || Number(item.estimatedPackagePrice) > 0);
const validation = await call('validateData');

assert(activeDishes.length >= 40, `Expected at least 40 active dishes, got ${activeDishes.length}`);
assert(activeIncomplete.length === 0, `Incomplete active dishes: ${activeIncomplete.map((item) => item.dishId).join(', ')}`);
assert(pricedActiveBaseProducts.length / activeBaseProducts.length >= 0.8, 'Less than 80% active base products have prices');
assert(!(validation.warnings || []).length, `validateData warnings: ${(validation.warnings || []).join('; ')}`);

console.log(JSON.stringify({
  ok: true,
  backupPath,
  before: {
    activeDishes: before.dishes.filter((item) => item.active).length,
    activeBaseProducts: before.baseProducts.filter((item) => item.active).length,
  },
  after: {
    activeDishes: activeDishes.length,
    dishes: after.dishes.length,
    activeBaseProducts: activeBaseProducts.length,
    pricedActiveBaseProducts: pricedActiveBaseProducts.length,
    calendarPlan: after.calendarPlan.length,
  },
  validation,
}, null, 2));
