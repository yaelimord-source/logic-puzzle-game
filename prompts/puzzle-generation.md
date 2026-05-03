# Logic Puzzle Generation Specification

This file is the single source of truth for generating new logic puzzles for this project.
Use it for every future request to create, draft, import, or generate a puzzle.

Do not output reasoning. Think through the puzzle internally, validate it, and output only the final JSON puzzle object unless the user explicitly asks for analysis.

## 1. Structure Rules

- Each puzzle must have exactly 3 categories.
- For the current app version, each category must contain exactly 3 items.
- All categories must have the same number of items.
- Categories must be clearly distinct from one another.
- One category must be the primary entity category, such as people, contestants, shops, animals, teams, rooms, or similar entities.
- The first category should be the primary entity category.
- The solution must map each primary entity to exactly one value from each other category.
- In most puzzles, include one ordered category, such as:
  - time
  - position
  - rank
  - order of arrival
  - station/platform/seat number
- Some puzzles should avoid ordered categories to keep the collection varied.
- Do not reuse the same category combination too often.
- Do not generate 4-category puzzles for now, even if future designs may support them later.

## 2. Story Rules

- Include a short story of 1 to 2 sentences.
- The story should be light, fun, original, and connected to the categories.
- The story should give context without solving the puzzle.
- Avoid generic or repetitive setups.
- Keep the tone friendly and suitable for a Hebrew logic puzzle app.

## 3. Solution Rules

- Construct the complete solution before writing clues.
- Provide a complete valid solution.
- Each main entity must map to exactly one item from every other category.
- No item may be reused within the same category.
- The solution must be internally consistent.
- The solution must match all clues.
- All category relationships in the solution must make sense in the story scenario.
- If the puzzle uses an ordered category, verify that all ordered relationships are consistent with the category order.
- Do not create arbitrary or incoherent solution associations.

## 4. Clue Rules

- Generate clues only after the full solution has been constructed and checked.
- Include 5 to 8 clues.
- Clues must include a mix of:
  - negative clues
  - relational clues
  - indirect inference clues
- If the puzzle has an ordered category, include order clues such as:
  - before
  - after
  - immediately before
  - immediately after
- Use before/after clues only if one category is clearly ordered.
- The ordered category must be explicit in the category values, such as:
  - times: 09:00, 10:00, 11:00
  - ranks: מקום 1, מקום 2, מקום 3
  - positions: עמדה 1, עמדה 2, עמדה 3
  - stages: שלב 1, שלב 2, שלב 3
- Do not use before/after between people unless people are the ordered category.
- Do not invent hidden order inside the story.
- Do not write before/after clues unless the relation can be checked against the ordered category.
- Avoid inline order explanations such as:
  - "בדירוג: כחול, ירוק, סגול"
  - "בסדר החדרים: ..."
- If order matters, make that category itself ordered in the categories list.
- Clues must require reasoning chains.
- Clues must not make the puzzle independently solvable clue-by-clue.
- Clues must not be trivial restatements of the solution.
- Avoid repetitive phrasing.
- Use natural Hebrew.
- Prefer clue variety:
  - direct positive relation
  - direct negative relation
  - two-part clue
  - order relation
  - exclusion relation
  - indirect chain clue
- Do not include clues that reference items not present in the categories.
- Do not include ambiguous clues.
- Do not generate any clue that contradicts the solution.
- For every clue, verify that it is true against the solution before outputting it.
- Avoid compound clues that combine two separate constraints in one sentence.
- Avoid vague phrases like "זה ש..." when they could be ambiguous.
- Prefer clear references to exact category values.
- Verify the logical direction of every relation, especially:
  - before
  - after
  - immediately before
  - immediately after
- Do not use "immediately after" or "immediately before" unless the adjacency is strictly verified in the ordered category.

## 5. Difficulty Rules

- Default difficulty should be medium to hard.
- The puzzle should require deduction, not guessing.
- At least one clue should require combining information from another clue.
- Avoid puzzles where every clue is immediately obvious or isolated.
- Avoid puzzles that become solved after only one or two simple eliminations.

## 6. Anti-Redundancy Rules

- Do not include unnecessary clues.
- Removing any clue should break uniqueness or increase ambiguity.
- If a clue can be removed while preserving exactly one solution, revise the clue set.
- Every clue should contribute to the reasoning path.
- Avoid duplicate clues that express the same relationship in different words.

## 7. Validation Rules

Before outputting a puzzle, verify internally that:

- The puzzle has exactly one valid solution.
- The clues create no contradictions.
- All clues are true according to the solution.
- Every clue has the correct logical direction.
- Time/order clues match the actual order in the ordered category.
- Every category item is used exactly once.
- All clues are used in reasoning.
- At least one multi-step deduction is required.
- No clue is redundant.
- No clue references a missing category item.
- The final JSON is valid and parseable.

Run a final consistency pass:

- Simulate every clue against the solution.
- Reject and revise the puzzle if any clue is inconsistent.
- Reject and revise the puzzle if any clue has reversed before/after meaning.
- Reject and revise the puzzle if any "immediately" clue is not truly adjacent.

If the puzzle cannot be validated as uniquely solvable, do not output it. Revise it internally first.

## 8. Output Format

Output strict JSON only.

Use the same puzzle structure as the project:

```json
{
  "id": "unique-puzzle-id",
  "difficulty": "בינוני",
  "levelNumber": 1,
  "title": "Puzzle title in Hebrew",
  "story": "Short Hebrew story.",
  "categories": {
    "mainCategoryKey": ["item 1", "item 2", "item 3"],
    "secondCategoryKey": ["item 1", "item 2", "item 3"],
    "thirdCategoryKey": ["item 1", "item 2", "item 3"]
  },
  "categoryLabels": {
    "mainCategoryKey": "Hebrew label",
    "secondCategoryKey": "Hebrew label",
    "thirdCategoryKey": "Hebrew label"
  },
  "clues": [
    "Hebrew clue 1.",
    "Hebrew clue 2."
  ],
  "solution": {
    "main item 1": {
      "secondCategoryKey": "matching item",
      "thirdCategoryKey": "matching item"
    }
  }
}
```

Rules for JSON:

- No comments.
- No trailing commas.
- Use double quotes.
- Keep category keys stable and English-like for logic.
- Use Hebrew display text for titles, stories, labels, items, and clues.
- If using an ordered category, keep its array in the intended order.

## 9. Creativity Rules

- Avoid repeated themes.
- Vary:
  - names
  - settings
  - objects
  - category types
  - clue structures
  - solution patterns
- Prefer vivid but compact scenarios.
- Avoid themes that feel too similar to recent puzzles.
- Avoid overused combinations like only friends/drinks/colors unless specifically requested.

## 10. Thinking Instructions

- Think step-by-step internally.
- Construct the solution first.
- Verify that the solution is coherent and contradiction-free.
- Build clues from the solution.
- Check each clue against the solution.
- Check directionality for all ordered clues.
- Simulate all clues against the solution.
- Test whether the clues uniquely determine the solution.
- Remove or revise redundant clues.
- Check for contradictions.
- Do not output the internal reasoning.
- Output JSON only.
