# Dinner Planner Test Cases

## Scope

Verify that the Web App lets the user select actual dinners and builds a shopping list only for those selected dinners.

## Functional Tests

1. Web App opens
   - Open deployed Web App URL.
   - Expected: page loads without stack trace.

2. Menu days load
   - Check `Day selection`.
   - Expected: menu days from `Menu with dinner options` are visible.

3. Dinner options display
   - Select one day.
   - Expected: Dinner Option A, Dinner Option B, and Optional Quick Dinner appear if filled.

4. Dish metadata display
   - Inspect a dinner card.
   - Expected: cooking time, difficulty, portions, leftovers, budget, and comment are shown when present in catalog.

5. Select one dinner
   - Choose one option for one day.
   - Expected: `Selected dinners` shows exactly that dish.

6. Select several dinners
   - Select several days and one dish per day.
   - Expected: `Selected dinners` shows one selected dish per selected day.

7. Shopping list uses only selected dinners
   - Select Dinner Option A for Day 1.
   - Build shopping list.
   - Expected: products from Dinner Option B and Optional Quick Dinner are not included.

8. Base shopping list off
   - Disable `Include base shopping list`.
   - Build shopping list.
   - Expected: only products from selected dinners appear.

9. Base shopping list on
   - Enable `Include base shopping list`.
   - Build shopping list.
   - Expected: base products are included and page shows that base list is included.

10. Duplicate products merge
   - Select two dishes with the same product.
   - Expected: one product row appears with combined quantity text and both dishes in `Used for`.

11. Different quantity formats do not break app
   - Use the same product with quantities such as `1 kg` and `2 packs`.
   - Expected: quantity shows as `1 kg + 2 packs`.

12. Mark already have / skip
   - Uncheck a product.
   - Expected: row remains visible and is marked `already have / skipped`.

13. Copy shopping list
   - Click `Copy shopping list`.
   - Expected copied text has `Shopping list` and `Skipped / already have` sections.

14. Print shopping list
   - Click `Print shopping list`.
   - Expected: browser print dialog opens.

15. Save selected dinners
   - Click `Save selected dinners`.
   - Expected: rows are added to `Selected dinners` with status `planned`.

16. Save shopping session
   - Build shopping list.
   - Expected: a row is added to `Shopping sessions`.

17. Recent selections
   - Save selected dinners and reload.
   - Expected: latest saved rows appear in `Recent selections`.

18. Filters
   - Enable fast, budget, leftovers, weekend, and weekday filters one by one.
   - Expected: visible dinner cards are filtered by catalog fields.

19. Missing source tab
   - Temporarily rename a required source tab.
   - Expected: UI shows a readable missing sheet message.

20. Missing required column
   - Temporarily rename a required column.
   - Expected: UI shows a readable missing column message.

21. Empty Dish ID with dish name fallback
   - Put a dish name in the menu instead of ID.
   - Expected: catalog lookup works if `Dish name` matches.

22. Unknown dish
   - Put an unknown dish ID/name in menu.
   - Expected: card is shown as catalog missing and app does not crash.

23. No shopping rows for dish
   - Select a catalog dish with no rows in `Dinner option shopping`.
   - Expected: warning is shown and app does not crash.

24. Empty selected dinners
   - Click `Build shopping list` without selecting dinner.
   - Expected: readable error asks to select at least one dinner.

25. Mobile layout
   - Open on mobile or narrow browser width.
   - Expected: panels stack vertically and buttons remain usable.

## Acceptance Criteria

- Alternative dishes are never included unless selected.
- The app works without relying on column order.
- Auto-created tabs are created if missing.
- User-facing errors do not expose technical stack traces.
