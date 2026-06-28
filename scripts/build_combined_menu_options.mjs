import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = "outputs/combined_family_menu_options";
await fs.mkdir(outputDir, { recursive: true });

const dishes = [
  {
    id: "D01",
    name: "Плов с курицей или говядиной",
    source: "Combined",
    dayType: "any",
    ingredients: "курица/говядина, рис, морковь, лук, специи",
    time: 80,
    difficulty: "medium",
    portions: "4",
    leftovers: "yes",
    budget: "medium",
    comment: "Объединяет плов из двух меню; курица дешевле и быстрее.",
  },
  {
    id: "D02",
    name: "Тефтели в томатно-сметанном соусе",
    source: "Combined",
    dayType: "weekday",
    ingredients: "фарш, рис/хлеб, лук, томат, сметана, картофель или макароны",
    time: 65,
    difficulty: "simple",
    portions: "4",
    leftovers: "yes",
    budget: "medium",
    comment: "Объединены версии с пюре и макаронами.",
  },
  {
    id: "D03",
    name: "Хек/минтай с картофелем в духовке",
    source: "Combined",
    dayType: "weekday",
    ingredients: "хек/минтай, картофель, морковь, лук, сметана/йогурт",
    time: 60,
    difficulty: "simple",
    portions: "2-3",
    leftovers: "partial",
    budget: "low",
    comment: "Бюджетная рыба, один противень.",
  },
  {
    id: "D04",
    name: "Куриный суп с лапшой + горячие бутерброды",
    source: "ChatGPT",
    dayType: "weekday",
    ingredients: "курица, лапша, картофель, морковь, лук, хлеб, сыр",
    time: 60,
    difficulty: "simple",
    portions: "4",
    leftovers: "yes",
    budget: "low",
    comment: "Хорошо закрывает ужин и обед без отдельной готовки.",
  },
  {
    id: "D05",
    name: "Паста с курицей и грибами",
    source: "ChatGPT",
    dayType: "weekday",
    ingredients: "курица, макароны, шампиньоны, сметана/йогурт, сыр",
    time: 40,
    difficulty: "simple",
    portions: "3",
    leftovers: "partial",
    budget: "medium",
    comment: "Быстрый будний вариант; грибы опциональны.",
  },
  {
    id: "D06",
    name: "Фаршированные перцы",
    source: "ChatGPT",
    dayType: "weekend",
    ingredients: "перец, фарш, рис, морковь, лук, томатный соус",
    time: 90,
    difficulty: "medium",
    portions: "4",
    leftovers: "yes",
    budget: "medium",
    comment: "Лучше ставить на выходной или свободный вечер.",
  },
  {
    id: "D07",
    name: "Куриные бедра/голени в духовке + крупа",
    source: "Combined",
    dayType: "any",
    ingredients: "куриные бедра/голени, рис или гречка, морковь, лук, салат",
    time: 80,
    difficulty: "simple",
    portions: "4",
    leftovers: "yes",
    budget: "low",
    comment: "Можно готовить с рисом в форме или с гречкой отдельно.",
  },
  {
    id: "D08",
    name: "Ленивые голубцы",
    source: "Combined",
    dayType: "weekend",
    ingredients: "фарш, капуста белокочанная, рис, морковь, лук, томат, сметана",
    time: 90,
    difficulty: "medium",
    portions: "4",
    leftovers: "yes",
    budget: "medium",
    comment: "Повтор из двух меню объединен в один вариант.",
  },
  {
    id: "D09",
    name: "Картофельная запеканка с курицей или фаршем",
    source: "Combined",
    dayType: "weekend",
    ingredients: "картофель, курица/фарш, лук, сыр, сметана",
    time: 80,
    difficulty: "medium",
    portions: "4",
    leftovers: "yes",
    budget: "medium",
    comment: "Объединены куриная и фаршевая версии.",
  },
  {
    id: "D10",
    name: "Жареный рис с яйцом и курицей",
    source: "ChatGPT",
    dayType: "weekday",
    ingredients: "готовый рис, яйца, курица, морковь, лук, зелень/огурец",
    time: 35,
    difficulty: "simple",
    portions: "2-3",
    leftovers: "partial",
    budget: "low",
    comment: "Лучший способ использовать вчерашний рис.",
  },
  {
    id: "D11",
    name: "Курица по-строгановски + гречка",
    source: "ChatGPT",
    dayType: "weekday",
    ingredients: "курица, лук, сметана, гречка, салат",
    time: 55,
    difficulty: "simple",
    portions: "3",
    leftovers: "yes",
    budget: "low",
    comment: "Бюджетная альтернатива бефстроганову.",
  },
  {
    id: "D12",
    name: "Рыбные котлеты из минтая/хека + рис",
    source: "ChatGPT",
    dayType: "weekday",
    ingredients: "минтай/хек, яйцо, лук, хлеб/панировка, рис, салат",
    time: 60,
    difficulty: "medium",
    portions: "4",
    leftovers: "yes",
    budget: "low",
    comment: "Погружной блендер помогает быстро сделать фарш.",
  },
  {
    id: "D13",
    name: "Домашняя шаурма с курицей",
    source: "Combined",
    dayType: "weekday",
    ingredients: "лаваш, курица, огурцы, помидоры, капуста, йогурт/сметана",
    time: 40,
    difficulty: "simple",
    portions: "2",
    leftovers: "no",
    budget: "medium",
    comment: "Быстрый ужин, овощи лучше докупить свежими.",
  },
  {
    id: "D14",
    name: "Курица с овощным рагу",
    source: "ChatGPT",
    dayType: "any",
    ingredients: "курица, картофель, морковь, лук, перец, кабачок/баклажан",
    time: 80,
    difficulty: "simple",
    portions: "4",
    leftovers: "yes",
    budget: "medium",
    comment: "Хорошо использует овощи, которые нужно пустить в дело.",
  },
  {
    id: "D15",
    name: "Курица с гречкой, шампиньонами и морковью",
    source: "Agent",
    dayType: "weekday",
    ingredients: "курица, гречка, шампиньоны, морковь, лук",
    time: 55,
    difficulty: "simple",
    portions: "3",
    leftovers: "yes",
    budget: "medium",
    comment: "Сковорода + отдельная крупа; грибы можно убрать.",
  },
  {
    id: "D16",
    name: "Паста с фаршем в томатном соусе",
    source: "Agent",
    dayType: "weekday",
    ingredients: "фарш курицы/индейки/смешанный, макароны, томат, лук, салат",
    time: 45,
    difficulty: "simple",
    portions: "3",
    leftovers: "yes",
    budget: "medium",
    comment: "Быстрее, чем запеканки и тушение.",
  },
  {
    id: "D17",
    name: "Бефстроганов по-домашнему с рисом",
    source: "Agent",
    dayType: "weekday",
    ingredients: "говядина, рис, сметана, лук, огурцы",
    time: 70,
    difficulty: "medium",
    portions: "3",
    leftovers: "yes",
    budget: "high",
    comment: "Дороже куриной версии; ставить не чаще 1 раза в неделю.",
  },
  {
    id: "D18",
    name: "Картофельная фриттата с овощами и сыром",
    source: "Agent",
    dayType: "weekday",
    ingredients: "яйца, картофель, сыр, помидор/перец, зелень",
    time: 40,
    difficulty: "simple",
    portions: "2",
    leftovers: "no",
    budget: "low",
    comment: "Легкий ужин и способ использовать остатки овощей.",
  },
  {
    id: "D19",
    name: "Котлеты с пюре и салатом",
    source: "Agent",
    dayType: "weekday",
    ingredients: "фарш курицы/индейки, картофель, молоко, огурцы/морковь",
    time: 70,
    difficulty: "simple",
    portions: "4",
    leftovers: "yes",
    budget: "medium",
    comment: "Котлеты можно запечь и оставить на обед.",
  },
  {
    id: "D20",
    name: "Скумбрия или хек с гречкой",
    source: "Agent",
    dayType: "weekday",
    ingredients: "скумбрия/хек, гречка, огурцы/помидоры",
    time: 55,
    difficulty: "simple",
    portions: "2-3",
    leftovers: "partial",
    budget: "low",
    comment: "Хек дешевле, скумбрия сытнее.",
  },
  {
    id: "D21",
    name: "Азу по-домашнему",
    source: "Agent",
    dayType: "weekend",
    ingredients: "говядина/курица, картофель, соленые огурцы, лук, томат",
    time: 80,
    difficulty: "medium",
    portions: "3-4",
    leftovers: "yes",
    budget: "high",
    comment: "Эконом-вариант: готовить с курицей.",
  },
];

const byId = Object.fromEntries(dishes.map((dish) => [dish.id, dish]));
const quick = (id) => `${id} ${byId[id].name}`;
const menu = [
  [1, "Бутерброды с сыром/яйцом, чай", "Резерв: пельмени/вареники + огурец", quick("D15"), quick("D05"), quick("D10"), quick("D10"), "A yes / B partial", "Старт недели: курица + крупа или быстрая паста."],
  [2, "Заварная каша, чай", "Остатки Day 1", quick("D03"), quick("D16"), quick("D18"), quick("D18"), "A partial / B yes", "Рыба или фарш; гарниры разные."],
  [3, "Тосты с творожным сыром, чай", "Остатки Day 2", quick("D02"), quick("D04"), quick("D13"), quick("D13"), "A yes / B yes", "Оба варианта дают обед, но суп легче."],
  [4, "Яйца вкрутую, хлеб, чай", "Остатки Day 3", quick("D11"), quick("D12"), quick("D10"), quick("D10"), "A yes / B yes", "Курица или рыба, без тяжелой говядины."],
  [5, "Заварная каша, яблоко/банан", "Остатки Day 4", quick("D13"), quick("D18"), "Омлет + салат", quick("D18"), "A no / B no", "Легкий вечер перед выходными."],
  [6, "Бутерброды, чай", "Быстрый суп/лапша или остатки", quick("D06"), quick("D20"), quick("D07"), quick("D20"), "A yes / B partial", "Выходной: можно сделать перцы; рыба быстрее."],
  [7, "Омлет/бутерброды, чай", "Остатки Day 6", quick("D08"), quick("D07"), quick("D05"), quick("D05"), "A yes / B yes", "Оба варианта дают основу на следующий обед."],
  [8, "Заварная каша, чай", "Остатки Day 7", quick("D19"), quick("D14"), quick("D13"), quick("D13"), "A yes / B yes", "Котлеты или рагу; не ставить вместе с запеканкой."],
  [9, "Бутерброды с сыром, чай", "Остатки Day 8", quick("D20"), quick("D16"), quick("D10"), quick("D10"), "A partial / B yes", "Рыба с гречкой или паста с фаршем."],
  [10, "Яйцо, хлеб, чай", "Остатки Day 9", quick("D01"), quick("D04"), quick("D18"), quick("D18"), "A yes / B yes", "Плов с запасом или бюджетный суп."],
  [11, "Заварная каша, яблоко", "Остатки Day 10", quick("D17"), quick("D05"), quick("D13"), quick("D05"), "A yes / B partial", "Дорогой вариант только если говядина уже куплена."],
  [12, "Тосты с творогом/сыром, чай", "Остатки Day 11", quick("D14"), quick("D18"), quick("D10"), quick("D10"), "A yes / B no", "Использовать овощи к концу недели."],
  [13, "Омлет, чай", "Полуфабрикат или остатки", quick("D09"), quick("D12"), quick("D21"), quick("D12"), "A yes / B yes", "Выходной: запеканка на 2 дня или рыбные котлеты."],
  [14, "Бутерброды, чай", "Остатки Day 13", quick("D21"), quick("D13"), quick("D04"), quick("D13"), "A yes / B no", "Азу как сытный вариант; шаурма если не хочется долгой готовки."],
];

const baseShopping = [
  ["Week 1", "Хлеб/лаваш базово", "2-3 хлеба; лаваш докупить при выборе шаурмы", "завтраки, быстрые обеды, D04/D13", "buy fresh", "Лаваш не покупать заранее, если шаурма не выбрана."],
  ["Week 1", "Чай, сахар", "проверить запас", "завтраки", "can store", "Покупать только при отсутствии дома."],
  ["Week 1", "Заварные каши", "8-10 пакетов", "завтраки", "can store", "Минимальные завтраки без готовки."],
  ["Week 1", "Яйца", "20 шт", "завтраки, фриттата, жареный рис, котлеты", "can store", "База для быстрых ужинов."],
  ["Week 1", "Молоко", "2 л", "каши, пюре", "buy fresh", "Докупать по факту."],
  ["Week 1", "Сметана/натуральный йогурт", "600-800 г", "соусы, запекание", "buy fresh", "Йогурт подходит для шаурмы и легких соусов."],
  ["Week 1", "Рис", "1.5 кг", "плов, перцы, голубцы, жареный рис", "can store", "Если рис остался, использовать для D10."],
  ["Week 1", "Гречка", "1 кг", "курица/рыба с гречкой", "can store", "Можно заменить картофелем или макаронами."],
  ["Week 1", "Макароны/лапша", "0.8-1 кг", "паста, суп, резервные обеды", "can store", "Обычные макароны без дорогих соусов."],
  ["Week 1", "Картофель", "4-5 кг", "пюре, рыба, запеканки, рагу", "can store", "Главный бюджетный гарнир."],
  ["Week 1", "Лук", "1.5 кг", "почти все ужины", "can store", "Брать сразу на неделю."],
  ["Week 1", "Морковь", "1.5 кг", "плов, суп, рагу, рыба, голубцы", "can store", "Базовая заготовка."],
  ["Week 1", "Капуста белокочанная", "1 кочан", "голубцы, шаурма, салаты", "can store", "Не заменять на цветную капусту или брокколи."],
  ["Week 1", "Масло, соль, специи, томатная паста", "проверить запас; томат 1-2 банки", "база соусов и жарки", "can store", "Покупать pantry только если закончилось."],
  ["Week 1", "Огурцы/помидоры/зелень", "2-2.5 кг", "салаты, шаурма, завтраки", "buy fresh", "Докупать 2-3 раза."],
  ["Week 2", "Хлеб/лаваш базово", "2-3 хлеба; лаваш под D13", "завтраки, быстрые ужины", "buy fresh", "Покупать по мере необходимости."],
  ["Week 2", "Чай, сахар", "проверить запас", "завтраки", "can store", "Не включать в бюджет, если есть дома."],
  ["Week 2", "Заварные каши", "8-10 пакетов", "завтраки", "can store", "Можно заменить бутербродами."],
  ["Week 2", "Яйца", "10-20 шт", "завтраки, D10/D18/D12", "can store", "20 шт, если часто выбирать быстрые блюда."],
  ["Week 2", "Молоко", "2 л", "каши, пюре", "buy fresh", "Докупать свежим."],
  ["Week 2", "Сметана/йогурт", "600-800 г", "соусы, шаурма, строганов", "buy fresh", "Контролировать срок годности."],
  ["Week 2", "Рис", "1-1.5 кг", "плов, рыбные котлеты, жареный рис", "can store", "Проверить остаток Week 1."],
  ["Week 2", "Гречка", "0.7-1 кг", "рыба/курица с гречкой", "can store", "Не покупать, если осталась."],
  ["Week 2", "Макароны/лапша", "0.8 кг", "паста, суп, резерв", "can store", "Резерв для быстрого ужина."],
  ["Week 2", "Картофель", "5-6 кг", "запеканка, азу, рагу, пюре", "can store", "Главный гарнир недели."],
  ["Week 2", "Лук", "1.5 кг", "почти все ужины", "can store", "Брать сразу."],
  ["Week 2", "Морковь", "1.5 кг", "плов, суп, рагу, азу", "can store", "Базовая овощная заготовка."],
  ["Week 2", "Капуста белокочанная", "1 кочан", "шаурма, салаты, голубцы", "can store", "Проверять остаток Week 1."],
  ["Week 2", "Огурцы/помидоры/зелень", "2.5-3 кг", "салаты, D13", "buy fresh", "Докупать маленькими партиями."],
  ["Week 2", "Соленые огурцы", "1 банка, если выбран D21", "азу", "can store", "Не обязательны без азу."],
];

const dishShopping = [
  ["D01", "Плов с курицей или говядиной", "курица/говядина", "600-800 г", "required", "куриные бедра вместо говядины", "Говядина повышает бюджет."],
  ["D01", "Плов с курицей или говядиной", "рис", "300-350 г", "required", "гречка не подходит, лучше картофельное рагу", "Брать обычный длиннозерный."],
  ["D01", "Плов с курицей или говядиной", "морковь + лук", "500-700 г", "required", "готовая овощная нарезка", "Базовые овощи."],
  ["D02", "Тефтели в томатно-сметанном соусе", "фарш", "600-700 г", "required", "куриный фарш", "Можно сделать больше и заморозить."],
  ["D02", "Тефтели в томатно-сметанном соусе", "картофель или макароны", "1 кг картофеля или 300 г макарон", "required", "рис/гречка", "Выбрать один гарнир."],
  ["D02", "Тефтели в томатно-сметанном соусе", "томат + сметана", "200 г + 200 г", "required", "йогурт вместо сметаны", "Для соуса."],
  ["D03", "Хек/минтай с картофелем в духовке", "хек/минтай", "700-900 г", "required", "скумбрия", "Замороженная рыба дешевле."],
  ["D03", "Хек/минтай с картофелем в духовке", "картофель", "1-1.2 кг", "required", "рис", "Картофель проще для противня."],
  ["D03", "Хек/минтай с картофелем в духовке", "морковь + лук", "300-400 г", "required", "перец/кабачок", "Без запрещенных овощных смесей."],
  ["D04", "Куриный суп с лапшой + горячие бутерброды", "курица", "500-700 г", "required", "бедро/голень", "На бульон лучше не филе."],
  ["D04", "Куриный суп с лапшой + горячие бутерброды", "лапша + картофель", "150 г + 600 г", "required", "рис вместо лапши", "Один суп на ужин и обед."],
  ["D04", "Куриный суп с лапшой + горячие бутерброды", "хлеб + сыр", "1 хлеб + 150 г", "optional", "сухари/тосты", "Для сытности."],
  ["D05", "Паста с курицей и грибами", "курица", "400-500 г", "required", "индейка", "Филе бедра сочнее."],
  ["D05", "Паста с курицей и грибами", "макароны", "300-350 г", "required", "гречка", "Макароны быстрее."],
  ["D05", "Паста с курицей и грибами", "шампиньоны + сметана", "300 г + 200 г", "optional", "перец/морковь + йогурт", "Грибы можно убрать ради экономии."],
  ["D06", "Фаршированные перцы", "болгарский перец", "6-8 шт", "required", "ленивый слой из фарша и риса", "Если перец дорогой, выбрать D08."],
  ["D06", "Фаршированные перцы", "фарш + рис", "600 г + 250 г", "required", "куриный фарш", "База начинки."],
  ["D06", "Фаршированные перцы", "томатный соус", "300-400 г", "required", "томатная паста + вода", "Для тушения."],
  ["D07", "Куриные бедра/голени в духовке + крупа", "куриные бедра/голени", "1-1.2 кг", "required", "куриные четверти", "Дешевле филе."],
  ["D07", "Куриные бедра/голени в духовке + крупа", "рис или гречка", "300-400 г", "required", "картофель", "Выбрать один гарнир."],
  ["D07", "Куриные бедра/голени в духовке + крупа", "салатные овощи", "500-700 г", "optional", "капуста/морковь", "Свежие докупить."],
  ["D08", "Ленивые голубцы", "фарш", "600-700 г", "required", "куриный фарш", "Можно готовить слоем."],
  ["D08", "Ленивые голубцы", "капуста белокочанная + рис", "700 г + 250 г", "required", "больше моркови вместо части капусты", "Не цветная капуста."],
  ["D08", "Ленивые голубцы", "томат + сметана", "300 г + 200 г", "required", "йогурт", "Для соуса."],
  ["D09", "Картофельная запеканка с курицей или фаршем", "картофель", "1.2-1.5 кг", "required", "макароны для запеканки", "Картофель бюджетнее."],
  ["D09", "Картофельная запеканка с курицей или фаршем", "курица/фарш", "500-700 г", "required", "остатки курицы", "Можно использовать уже готовую курицу."],
  ["D09", "Картофельная запеканка с курицей или фаршем", "сыр + сметана", "200 г + 200 г", "optional", "меньше сыра + яйцо", "Сыр главный драйвер цены."],
  ["D10", "Жареный рис с яйцом и курицей", "готовый рис", "400-500 г", "required", "гречка", "Лучше вчерашний рис."],
  ["D10", "Жареный рис с яйцом и курицей", "яйца + курица", "3-4 шт + 250-300 г", "required", "колбаса/остатки мяса", "Использовать остатки."],
  ["D10", "Жареный рис с яйцом и курицей", "морковь + лук", "250-300 г", "required", "замороженная смесь без запретов", "Проверить состав смеси."],
  ["D11", "Курица по-строгановски + гречка", "курица", "500-600 г", "required", "индейка", "Дешевле говядины."],
  ["D11", "Курица по-строгановски + гречка", "гречка", "300 г", "required", "рис/макароны", "Любой базовый гарнир."],
  ["D11", "Курица по-строгановски + гречка", "сметана + лук", "200 г + 1-2 шт", "required", "йогурт", "Соус."],
  ["D12", "Рыбные котлеты из минтая/хека + рис", "минтай/хек", "800-1000 г", "required", "готовый рыбный фарш", "Проверить состав."],
  ["D12", "Рыбные котлеты из минтая/хека + рис", "яйцо + хлеб/панировка", "1-2 шт + 100 г", "required", "манка", "Связка котлет."],
  ["D12", "Рыбные котлеты из минтая/хека + рис", "рис + салат", "300 г + 500 г", "required", "гречка/картофель", "Гарнир и свежесть."],
  ["D13", "Домашняя шаурма с курицей", "лаваш", "3-4 шт", "required", "хлеб + салат отдельно", "Покупать свежим."],
  ["D13", "Домашняя шаурма с курицей", "курица", "400-500 г", "required", "остатки запеченной курицы", "Хорошо использует остатки."],
  ["D13", "Домашняя шаурма с курицей", "огурцы/помидоры/капуста + йогурт", "700-900 г + 200 г", "required", "морковь/соленья + сметана", "Свежие овощи."],
  ["D14", "Курица с овощным рагу", "курица", "600-800 г", "required", "бедра/голени", "Можно меньше мяса, больше овощей."],
  ["D14", "Курица с овощным рагу", "картофель + морковь + лук", "1.2-1.5 кг", "required", "рис", "Основа рагу."],
  ["D14", "Курица с овощным рагу", "перец/кабачок/баклажан", "500-700 г", "optional", "капуста", "Докупать по цене."],
  ["D15", "Курица с гречкой, шампиньонами и морковью", "курица", "500-600 г", "required", "индейка", "Быстро на сковороде."],
  ["D15", "Курица с гречкой, шампиньонами и морковью", "гречка", "300 г", "required", "рис", "Гарнир."],
  ["D15", "Курица с гречкой, шампиньонами и морковью", "шампиньоны + морковь + лук", "300 г + 400 г", "optional", "перец/кабачок", "Грибы можно убрать."],
  ["D16", "Паста с фаршем в томатном соусе", "фарш", "500-600 г", "required", "курица мелко", "Быстрый мясной соус."],
  ["D16", "Паста с фаршем в томатном соусе", "макароны", "350-400 г", "required", "гречка", "Паста быстрее."],
  ["D16", "Паста с фаршем в томатном соусе", "томат + лук", "300 г + 1-2 шт", "required", "сметанный соус", "Без редких соусов."],
  ["D17", "Бефстроганов по-домашнему с рисом", "говядина", "500-600 г", "required", "курица", "Главный риск бюджета."],
  ["D17", "Бефстроганов по-домашнему с рисом", "рис", "300 г", "required", "гречка", "Гарнир."],
  ["D17", "Бефстроганов по-домашнему с рисом", "сметана + лук", "200 г + 1-2 шт", "required", "йогурт", "Соус."],
  ["D18", "Картофельная фриттата с овощами и сыром", "яйца", "5-6 шт", "required", "омлет без картофеля", "Быстрая белковая база."],
  ["D18", "Картофельная фриттата с овощами и сыром", "картофель", "500-700 г", "required", "макароны/рис остатки", "Использовать остатки."],
  ["D18", "Картофельная фриттата с овощами и сыром", "сыр + овощи", "100-150 г + 300 г", "optional", "без сыра", "Сыр можно сократить."],
  ["D19", "Котлеты с пюре и салатом", "фарш курицы/индейки", "600-700 г", "required", "смешанный фарш", "Можно запечь."],
  ["D19", "Котлеты с пюре и салатом", "картофель + молоко", "1-1.2 кг + 200 мл", "required", "гречка", "Пюре для сытности."],
  ["D19", "Котлеты с пюре и салатом", "огурцы/морковь", "500 г", "optional", "капустный салат", "Свежий салат."],
  ["D20", "Скумбрия или хек с гречкой", "скумбрия/хек", "700-900 г", "required", "минтай", "Хек дешевле."],
  ["D20", "Скумбрия или хек с гречкой", "гречка", "300 г", "required", "картофель", "Гарнир."],
  ["D20", "Скумбрия или хек с гречкой", "огурцы/помидоры", "500-700 г", "optional", "капуста/морковь", "Салат по цене."],
  ["D21", "Азу по-домашнему", "говядина/курица", "600-800 г", "required", "курица", "Говядина дороже."],
  ["D21", "Азу по-домашнему", "картофель", "1-1.2 кг", "required", "рис", "Классический вариант с картофелем."],
  ["D21", "Азу по-домашнему", "соленые огурцы + томат", "300 г + 200 г", "required", "свежие огурцы не подходят", "Покупать только если выбран D21."],
];

const cookingPlan = [
  [1, "Выбрать D15 или D05", "Нарезать лук/морковь на 2 дня; сварить крупу с запасом", "свежую курицу, грибы", "Если времени мало, использовать D10 только при наличии риса."],
  [2, "Выбрать D03 или D16", "Разморозить рыбу или фарш утром", "рыбу/фарш, открытый томат", "D18 как быстрый резерв из яиц и картофеля."],
  [3, "Выбрать D02 или D04", "Сделать фарш/овощную нарезку заранее", "сметану, курицу на суп", "Оба варианта лучше готовить на 4 порции."],
  [4, "Выбрать D11 или D12", "Сварить гречку/рис заранее", "курицу или рыбу", "D10 закрывает ужин за 35 минут при готовом рисе."],
  [5, "Выбрать D13 или D18", "Курицу для шаурмы нарезать заранее", "лаваш, свежие овощи", "Не планировать тяжелую готовку перед выходными."],
  [6, "Выбрать D06 или D20", "Для D06 подготовить перцы и начинку", "перец/рыбу", "Если перцы дорогие, выбрать D20 или D07."],
  [7, "Выбрать D08 или D07", "Нашинковать капусту; замариновать курицу", "фарш/курицу", "Готовить больше для обеда Day 8."],
  [8, "Выбрать D19 или D14", "Сформировать котлеты или нарезать овощи", "размороженный фарш/курицу", "D13 быстрый резерв без остатков."],
  [9, "Выбрать D20 или D16", "Разморозить рыбу или фарш", "рыбу/фарш", "D10 использовать, если остался рис."],
  [10, "Выбрать D01 или D04", "Нарезать морковь/лук; проверить рис", "мясо/курицу", "D18 дешевле и быстрее, если нет сил на плов."],
  [11, "Выбрать D17 или D05", "Говядину нарезать тонко; курицу для пасты держать резервом", "говядину, сметану", "Если бюджет важнее, выбрать D05."],
  [12, "Выбрать D14 или D18", "Использовать овощи конца недели", "перец/кабачок/картофель", "D10 быстрее, но требует готового риса."],
  [13, "Выбрать D09 или D12", "Картофель нарезать заранее; рыбу разморозить", "сыр/рыбу", "Запеканка удобна на 2 дня."],
  [14, "Выбрать D21 или D13", "Для D21 нарезать мясо и огурцы заранее", "мясо, соленые огурцы, лаваш", "D13 выбрать, если не нужен большой остаток."],
];

const decisionGuide = [
  ["Мало времени", "quick / simple", "D10 жареный рис; D13 шаурма; D18 фриттата; D05 паста с курицей", "30-45 минут, минимум посуды и отдельной подготовки."],
  ["Хочется сытный ужин", "hearty with leftovers", "D01 плов; D02 тефтели; D07 курица в духовке; D09 запеканка; D21 азу", "Дают плотный ужин и часто закрывают обед."],
  ["Нужен обед на завтра", "4 portions / leftovers yes", "D02, D04, D06, D07, D08, D09, D12, D14, D19", "Готовятся сразу на 3-4 порции."],
  ["Нужно использовать курицу из холодильника", "chicken-based", "D05, D07, D10, D11, D13, D14, D15", "Курица встречается в быстрых и бюджетных вариантах."],
  ["Нужно использовать фарш", "mince-based", "D02, D06, D08, D09, D16, D19", "Фарш легко заморозить порциями и использовать в разных блюдах."],
  ["Хочется лёгкий ужин", "light / no heavy meat", "D03, D12, D13, D18, D20", "Рыба, яйца или шаурма без тяжелого гарнира."],
  ["Выходной день", "medium / batch cooking", "D06, D08, D09, D21", "Больше подготовки, зато есть остатки."],
  ["Нужно уложиться дешевле", "low budget", "D03, D04, D07, D10, D11, D12, D18, D20", "Меньше говядины и сыра, больше круп/картофеля/курицы."],
  ["Есть дорогие продукты уже куплены", "use first", "D17 для говядины; D21 для говядины/соленых огурцов; D09 для сыра", "Так дорогие продукты не портятся и не требуют второй закупки."],
];

const substitutions = [
  ["Индейка", "Курица", "Если индейка дорогая или недоступна", "Прямая замена в фарше, котлетах, пасте."],
  ["Говядина", "Курица / куриный фарш", "Если нужно удержать бюджет", "Снижает цену и время готовки."],
  ["Дорогая рыба", "Хек / минтай / скумбрия", "Для запекания и котлет", "Не брать панировку и готовые дорогие наборы."],
  ["Свежие овощи", "Замороженная смесь без запрещенных компонентов", "Когда нет времени на нарезку", "Проверить состав: без брокколи, цветной капусты, фасоли, бобовых и нута."],
  ["Рис", "Гречка / картофель / макароны", "Если гарнир надоел или есть остатки", "Кроме плова и перцев, где рис лучше оставить."],
  ["Сметана", "Натуральный йогурт", "Для соусов и шаурмы", "В горячем тушении сметана стабильнее."],
  ["Сыр", "Меньше сыра + яйцо/сметана", "Для запеканки и фриттаты", "Сыр может выбить бюджет."],
  ["Шампиньоны", "Морковь / перец / кабачок", "Если грибы дорогие", "Грибы опциональны в D05/D15."],
  ["Лаваш", "Хлеб + салат отдельно", "Если лаваша нет", "Шаурма становится быстрым сэндвич-ужином."],
  ["Болгарский перец", "Ленивые голубцы / запеканка", "Если перец дорогой", "Не покупать дорогой перец ради одного блюда."],
];

const budget = [
  ["Week 1", "25 000 KZT", "22 000-29 000 KZT for 7 selected dinners", "High if choosing D06 + D17/D21-style beef + much cheese in one week", "Use D03/D04/D07/D10/D11/D18 as anchors; beef no more than once."],
  ["Week 2", "25 000 KZT", "23 000-31 000 KZT for 7 selected dinners", "High if choosing D17 and D21 plus cheese-heavy D09", "Choose either D17 or D21, not both with beef; use chicken versions and budget fish."],
];

const excluded = [
  ["Плов с курицей vs простой плов", "Merged into D01", "same core dish; protein can vary"],
  ["Тефтели с пюре vs тефтели с макаронами", "Merged into D02", "same base dish; garnish is selectable"],
  ["Рыба с картофелем из обоих меню", "Merged into D03", "same cooking logic"],
  ["Ленивые голубцы из обоих меню", "Merged into D08", "direct duplicate"],
  ["Домашняя шаурма из обоих меню", "Merged into D13", "same role: quick dinner"],
  ["Картофельная запеканка с курицей vs фаршем", "Merged into D09", "same form; protein can be selected"],
];

function catalogRows() {
  return dishes.map((dish) => [
    dish.id,
    dish.name,
    dish.source,
    dish.dayType,
    dish.ingredients,
    `${dish.time} min`,
    dish.difficulty,
    dish.portions,
    dish.leftovers,
    dish.budget,
    dish.comment,
  ]);
}

function addSheet(workbook, name, headers, rows, widths = []) {
  const sheet = workbook.worksheets.add(name);
  sheet.showGridLines = false;
  const matrix = [headers, ...rows];
  const lastCol = columnName(headers.length);
  const range = sheet.getRange(`A1:${lastCol}${matrix.length}`);
  range.values = matrix;
  range.format = {
    wrapText: true,
    verticalAlignment: "top",
    borders: { preset: "inside", style: "thin", color: "#E5E7EB" },
  };
  sheet.getRange(`A1:${lastCol}1`).format = {
    fill: "#E5E7EB",
    font: { bold: true, color: "#111827" },
    wrapText: true,
    borders: { preset: "outside", style: "thin", color: "#9CA3AF" },
  };
  sheet.freezePanes.freezeRows(1);
  widths.forEach((width, idx) => {
    sheet.getRangeByIndexes(0, idx, matrix.length, 1).format.columnWidth = width;
  });
  sheet.getRange(`A1:${lastCol}${matrix.length}`).format.autofitRows();
  return sheet;
}

function columnName(n) {
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function validate() {
  const forbidden = ["брокколи", "цветная капуста", "цветной капуст", "фасоль", "бобов", "нут"];
  const actualFoodText = JSON.stringify({
    menu,
    dishes: dishes.map(({ name, ingredients }) => ({ name, ingredients })),
    dishShopping: dishShopping.map((row) => row.slice(0, 4)),
  }).toLowerCase();
  const violations = forbidden.filter((term) => actualFoodText.includes(term));
  const errors = [];
  if (menu.length !== 14) errors.push("Menu must have 14 days.");
  if (menu.some((row) => !row[3] || !row[4])) errors.push("Every day must have two dinner options.");
  if (violations.length) errors.push(`Forbidden products found in actual food fields: ${violations.join(", ")}`);
  const weekdayDays = new Set([1, 2, 3, 4, 5, 8, 9, 10, 11, 12]);
  for (const row of menu) {
    if (!weekdayDays.has(row[0])) continue;
    for (const idx of [3, 4]) {
      const id = String(row[idx]).match(/D\d+/)?.[0];
      if (id && byId[id].time > 90) errors.push(`Weekday option over 90 min: Day ${row[0]} ${id}`);
    }
  }
  if (dishes.filter((dish) => dish.leftovers === "yes").length < 10) errors.push("Not enough leftover-friendly dishes.");
  if (errors.length) throw new Error(errors.join(" "));
}

validate();

const workbook = Workbook.create();

addSheet(
  workbook,
  "Menu with dinner options",
  ["Day", "Breakfast", "Lunch for 1 person", "Dinner Option A", "Dinner Option B", "Optional Quick Dinner", "Best choice if short on time", "Leftovers possible", "Notes"],
  menu,
  [8, 30, 34, 42, 42, 32, 34, 24, 50],
);

addSheet(
  workbook,
  "Dinner options catalog",
  ["Dish ID", "Dish name", "Source menu", "Best day type", "Main ingredients", "Cooking time", "Difficulty", "Portions", "Leftovers", "Budget level", "Comment"],
  catalogRows(),
  [10, 38, 16, 16, 52, 16, 14, 12, 14, 14, 52],
);

addSheet(
  workbook,
  "Base shopping list",
  ["Week", "Product", "Approx quantity", "Used broadly for", "Buy fresh / can store", "Comment"],
  baseShopping,
  [14, 32, 28, 42, 22, 56],
);

addSheet(
  workbook,
  "Dinner option shopping",
  ["Dish ID", "Dish name", "Product", "Approx quantity", "Required / optional", "Can be replaced with", "Comment"],
  dishShopping,
  [10, 38, 30, 24, 20, 34, 48],
);

addSheet(
  workbook,
  "Cooking plan",
  ["Day", "What to cook", "What can be prepared in advance", "What to use first", "Time-saving note"],
  cookingPlan,
  [8, 36, 52, 36, 54],
);

addSheet(
  workbook,
  "Dinner decision guide",
  ["Situation", "Recommended option type", "Examples", "Why"],
  decisionGuide,
  [34, 32, 72, 58],
);

addSheet(
  workbook,
  "Substitutions",
  ["Ingredient", "Possible replacement", "When to use", "Comment"],
  substitutions,
  [28, 40, 44, 62],
);

const budgetSheet = addSheet(
  workbook,
  "Budget check",
  ["Week", "Budget limit", "Realistic selected menu range", "Risk if cooking expensive options", "Economy recommendation"],
  budget,
  [14, 18, 34, 56, 64],
);

budgetSheet.getRange("A5:C5").values = [["Excluded / merged dish", "Decision", "Reason"]];
budgetSheet.getRange("A6:C11").values = excluded;
budgetSheet.getRange("A5:C5").format = {
  fill: "#F3F4F6",
  font: { bold: true, color: "#111827" },
  wrapText: true,
  borders: { preset: "outside", style: "thin", color: "#9CA3AF" },
};
budgetSheet.getRange("A5:C11").format = {
  wrapText: true,
  verticalAlignment: "top",
  borders: { preset: "inside", style: "thin", color: "#E5E7EB" },
};
budgetSheet.getRange("A13:C16").values = [
  ["Quality check", "Status", "Comment"],
  ["14 days filled; 2+ dinner options per day", "OK", "Optional quick option included for every day."],
  ["Forbidden products", "OK", "Not used in actual dishes or shopping lines; mentioned only in substitution warnings."],
  ["Budget logic", "OK", "Base shopping is broad; dinner shopping is per selected dish, not all alternatives."],
];
budgetSheet.getRange("A13:C13").format = {
  fill: "#F3F4F6",
  font: { bold: true, color: "#111827" },
  wrapText: true,
  borders: { preset: "outside", style: "thin", color: "#9CA3AF" },
};
budgetSheet.getRange("A13:C16").format = {
  wrapText: true,
  verticalAlignment: "top",
  borders: { preset: "inside", style: "thin", color: "#E5E7EB" },
};

const formulaErrors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
  summary: "final formula error scan",
});
console.log(formulaErrors.ndjson);

for (const sheetName of [
  "Menu with dinner options",
  "Dinner options catalog",
  "Base shopping list",
  "Dinner option shopping",
  "Cooking plan",
  "Dinner decision guide",
  "Substitutions",
  "Budget check",
]) {
  const preview = await workbook.render({ sheetName, autoCrop: "all", scale: 1, format: "png" });
  await fs.writeFile(`${outputDir}/${sheetName.replaceAll(" ", "_")}.png`, new Uint8Array(await preview.arrayBuffer()));
}

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(`${outputDir}/combined_family_menu_options_karaganda.xlsx`);
console.log(`${outputDir}/combined_family_menu_options_karaganda.xlsx`);
