# Dinner Planner Web App Setup

## Minimum Ready Result

Google Apps Script Web App opens from a Google Sheet, loads dinner options, lets the user select real dinners, builds a shopping list only for selected dishes, and saves selections/sessions back to the sheet.

## Expected Google Sheet Tabs

### `Menu with dinner options`

- Day
- Breakfast
- Lunch for 1 person
- Dinner Option A
- Dinner Option B
- Optional Quick Dinner
- Best choice if short on time
- Leftovers possible
- Notes

### `Dinner options catalog`

- Dish ID
- Dish name
- Source menu
- Best day type
- Main ingredients
- Cooking time
- Difficulty
- Portions
- Leftovers
- Budget level
- Comment

### `Dinner option shopping`

- Dish ID
- Dish name
- Product
- Approx quantity
- Required / optional
- Can be replaced with
- Comment

### `Base shopping list`

- Week
- Product
- Approx quantity
- Used broadly for
- Buy fresh / can store
- Comment

### Auto-created by script

`Selected dinners`

- Timestamp
- Planning date
- Day
- Dish ID
- Dish name
- Selected option
- User note
- Status

`Shopping sessions`

- Timestamp
- Session ID
- Selected days
- Selected dishes
- Include base shopping list
- Shopping list JSON
- User note

## Installation

1. Open the Google Sheet with the family menu.
2. Go to `Extensions -> Apps Script`.
3. Create or replace `Code.gs` with the contents of `Code.gs`.
4. Add an HTML file named `Index` and paste `Index.html`.
5. Save the Apps Script project.
6. Click `Deploy -> New deployment`.
7. Select `Web app`.
8. Set `Execute as: Me`.
9. Set access:
   - `Only myself` for personal use, or
   - `Anyone with the link` if family members need access.
10. Authorize permissions.
11. Open the Web App URL.

## Architecture

- `Code.gs` is the backend.
- `SpreadsheetApp` reads and writes Google Sheets.
- Headers are resolved by column names, not by column order.
- `Dish ID` is the primary key.
- If a menu cell contains a dish name instead of `Dish ID`, the script falls back to `Dish name`.
- `Index.html` is a single-page mobile-friendly UI.
- `google.script.run` connects the page to Apps Script functions.
- No external database, paid API, or external frontend library is used.

## Core Data Flow

1. `getAppData()` loads menu days, dinner options, catalog details, and recent selections.
2. User selects one dinner per day.
3. `buildShoppingList()` receives only selected dishes.
4. Backend pulls rows from `Dinner option shopping` only for selected dishes.
5. Equal product names are merged by normalized product name.
6. Optional `Base shopping list` rows are added only when the toggle is enabled.
7. `saveSelectedDinners()` writes planned dinners.
8. `saveShoppingSession()` stores the generated shopping list JSON.

## Important Limitation

The shopping list intentionally ignores unselected alternative dishes. This is the critical rule for v1.

## Current Version Limits

- Quantities are merged as text, for example `1 kg + 0.8 kg`.
- The app does not calculate calories, macros, prices, or inventory.
- No multi-user authorization model is implemented.
- No Telegram, WhatsApp, store API, or external backend integration.
- Week mode selects the first 7 menu rows.
- Today mode uses a manual dropdown because menu day names may not match real calendar dates.

## Recommended Next Stage

- Add category grouping for products.
- Add explicit shopping categories in the source sheet.
- Add `cooked` / `skipped` status editing.
- Add saved session reopening.
- Add a simple duplicate-dish warning.
- Add quantity normalization only for clearly compatible units.
