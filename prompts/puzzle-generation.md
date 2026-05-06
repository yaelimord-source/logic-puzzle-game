# Logic Puzzle Generation Specification

This file is the single source of truth for generating new logic puzzles for this project.
Use it for every future request to create, draft, import, or generate a puzzle.

The target style is a human-friendly printed logic puzzle: natural, contextual,
deductive, and satisfying to solve. Do not optimize only for dense constraints,
minimal clue count, direct elimination, or parser convenience. The puzzle should
feel authored, not mechanically assembled.

Do not output reasoning. Think through the puzzle internally, validate it, and
output only the final JSON puzzle object unless the user explicitly asks for
analysis.

## 1. Current App Structure

- Generate exactly 3 categories.
- Each category must contain exactly 3 items for now.
- All categories must have the same number of items.
- Categories must be clearly distinct from one another.
- One category must be the primary entity category, such as people, contestants,
  shops, rooms, teams, animals, or similar entities.
- The first category should be the primary entity category.
- The solution must map each primary entity to exactly one value from each other
  category.
- Do not generate 4-category puzzles for now, even if future designs may support
  them later.

## 2. Category Design

- Categories should belong naturally to the same scenario.
- Avoid category combinations that feel arbitrary.
- In most puzzles, include one ordered category, such as:
  - times: 09:00, 10:00, 11:00
  - ranks: מקום 1, מקום 2, מקום 3
  - positions: עמדה 1, עמדה 2, עמדה 3
  - stages: שלב 1, שלב 2, שלב 3
- In some puzzles, avoid ordered categories to maintain variety.
- If order matters, the ordered category must be explicit in the category values.
- Do not invent hidden order inside the story.

## 3. Story Rules

- Include a short story of 1 to 2 sentences.
- The story should be light, fun, original, and connected to the categories.
- The story should make it clear what kind of relationships the player is
  comparing.
- The story should give context without solving the puzzle.
- Avoid generic or repetitive setups.
- Keep the tone friendly and suitable for a Hebrew logic puzzle app.

## 4. Solution Rules

- Construct the complete solution before writing clues.
- Provide a complete valid solution.
- Each primary entity must map to exactly one item from every other category.
- No item may be reused within the same category.
- Use category keys in the solution, not display labels.
- The solution must be internally consistent.
- The solution must match all clues.
- All category relationships in the solution must make sense in the story
  scenario.
- If the puzzle uses an ordered category, verify that all ordered relationships
  are consistent with the category order.
- Do not create arbitrary or incoherent solution associations.

## 5. Clue Philosophy

Clues should feel like natural observations from a printed puzzle book, not like
machine-generated constraints.

- Include 5 to 7 meaningful clues.
- Prefer meaningful clue quality over the absolute minimum number of clues.
- Every clue should contribute to reasoning.
- A clue may contain one constraint or multiple constraints, as long as it feels
  natural, improves reasoning, and is not artificially compressed.
- Avoid repetitive formulaic clues such as:
  - "X is not Y"
  - repeated "מי ש..."
  - long chains of mechanical negations
- Use direct negative clues sparingly and only when they create useful deduction.
- Avoid overusing multi-negation chains.
- Avoid ultra-dense clues that feel compressed only to reduce clue count.
- Clues should sound natural in the story world.
- Use contextual language, observations, preferences, habits, timing, behavior,
  or small human details when possible.

## 6. What Makes a Clue Interesting

An interesting clue creates a small reasoning moment. Prefer clues that:

- interact with another clue
- provide partial information that resolves later
- create a contradiction path that eliminates a possibility
- connect two different categories in a meaningful way
- reveal something through context, habit, preference, timing, or behavior
- make the solver feel they discovered something, not merely copied a fact
- are clear on rereading, even if not immediately decisive

Good clues often leave the player thinking:

- "This does not solve it yet, but it limits the options."
- "Now that I know X, this clue tells me Y."
- "That cannot be true because it would contradict another clue."

Avoid clues that are technically valid but dull, such as a long list of isolated
eliminations.

## 7. Clue Mix

Use a balanced clue set that may include:

- negative clues
- positive relationship clues
- relational clues
- indirect inference clues
- cross-category clues
- partial information
- order clues, if an ordered category exists

Encourage:

- cross-category reasoning
- indirect deductions
- clue interaction
- deduction chains
- contextual observations
- preferences or habits that matter logically

Do not make every clue independently decisive. The puzzle should require clues
to work together.

## 8. Order Clue Semantics

Order clues must be precise.

- "אחרי", "לפני", "מאוחר יותר", and "מוקדם יותר" mean relative order only.
- "מיד אחרי" and "מיד לפני" mean exact adjacency.

Example:

If:

- A = 1st
- B = 2nd
- C = 3rd

Then:

- B is immediately after A.
- C is after A.
- C is not immediately after A.

Use before/after clues only if one category is clearly ordered.

Do not use before/after between people unless people are the ordered category.

Prefer cross-category order clues when possible.

Good:

- "מי ששתה שוקו הגיע מיד אחרי אדם."

Less interesting:

- "דנה הגיעה מיד אחרי רועי."

Do not write order clues unless the relation can be checked against the ordered
category.

## 9. No Inline Order Explanations

Avoid clues like:

- "בדירוג: כחול, ירוק, סגול"
- "בסדר החדרים: ..."

If order matters, make that category itself ordered in the categories list.

## 10. Avoid Real-World Automatic Mappings

Do not rely on real-world stereotypes or automatic associations as hidden clues.

Bad examples:

- Italian stand ↔ pasta
- Mexican stand ↔ taco
- bakery ↔ bread
- librarian ↔ book

These create implicit clues outside the puzzle logic and can make the puzzle feel
unfair or too obvious.

If a relationship is important, make it an explicit clue or avoid the automatic
pairing.

## 11. Clue Safety

- Every clue must be true according to the declared solution.
- Do not generate any clue that contradicts the solution.
- Verify the logical direction of every relation, especially:
  - before
  - after
  - immediately before
  - immediately after
- Do not use "immediately after" or "immediately before" unless the adjacency is
  strictly verified in the ordered category.
- Avoid vague phrases like "זה ש..." when they could be ambiguous.
- Prefer clear references to exact category values.
- Do not include clues that reference items not present in the categories.
- Do not include ambiguous clues.

## 12. Difficulty Rules

- Default difficulty should be medium to hard.
- The puzzle should require deduction, not guessing.
- At least one clue should require combining information from another clue.
- The puzzle should include at least one satisfying deduction chain.
- The difficulty should come from interaction between clues, not obscure wording.
- Avoid puzzles where every clue is immediately obvious or isolated.
- Avoid puzzles that become solved after only one or two simple eliminations.

## 13. Anti-Redundancy Rules

- Do not include unnecessary clues.
- Removing any clue should break uniqueness or increase ambiguity.
- If a clue can be removed while preserving exactly one solution, revise the clue
  set.
- Every clue should contribute to the reasoning path.
- Avoid duplicate clues that express the same relationship in different words.
- Do not remove a clue merely to minimize clue count if the remaining puzzle
  becomes less pleasant or less human-readable.
- A clue is acceptable when it meaningfully supports reasoning, even if it is not
  maximally dense.

## 14. Validation Rules

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

## 15. Validator and App Compatibility

Keep the puzzle compatible with the current app and validator:

- Use exactly 3 categories.
- Use exactly 3 items per category.
- Use category keys in the solution, not display labels.
- Keep the first category as the primary entity category.
- Use clear category values that can be recognized in clue text.
- Avoid wording that depends on hidden assumptions.
- Prefer clue phrasing that can be represented as structured logic, even when
  written naturally.
- The puzzle must still have exactly one valid solution.

Natural language is encouraged, but structured logic must remain clear.

## 16. Advanced Human Deduction Patterns

This section documents long-term clue families for the puzzle engine. These are
valuable for human-style deduction, but they are not all fully implemented in the
current parser and validator.

### Currently Supported Clue Types

Use these freely when they fit the story and remain clear:

- Direct equality clues:
  - logical meaning: A is matched with B
  - example meaning: the person, object, or event belongs with another category value
- Direct inequality clues:
  - logical meaning: A is not matched with B
  - deduction value: eliminates a possibility
- Basic relative order clues:
  - logical meaning: A is before/after B through an explicit ordered category
  - deduction value: restricts position, time, rank, or sequence
- Immediate adjacency order clues:
  - logical meaning: A is exactly one step before/after B
  - deduction value: creates a stronger placement constraint

### Future Advanced Clue Types

The clue families below represent the long-term direction of the puzzle engine.
Do not rely on them for generated puzzles until parser and validator support is
explicitly implemented.

#### Either/Or Clues

- Logical meaning:
  - exactly one of two alternatives is true, or one of two possibilities must hold
  - example structure: either A is matched with B, or C is matched with D
- Deduction value:
  - creates branching logic
  - becomes powerful when one branch is later contradicted
  - feels very natural in printed logic puzzles
- Parser/validation challenges:
  - must represent disjunction safely
  - must avoid treating both alternatives as simultaneously true
  - requires solver support for branching constraints
- Difficulty impact:
  - increases difficulty significantly
  - useful for medium-hard and hard puzzles

#### Exactly-One Clues

- Logical meaning:
  - exactly one item in a set satisfies a condition
  - example structure: exactly one of Dana and Yoav arrived before 10:00
- Deduction value:
  - creates contrast between related possibilities
  - helps produce satisfying elimination chains
- Parser/validation challenges:
  - requires counting constraints
  - must distinguish "at least one", "at most one", and "exactly one"
  - can be misread if phrased casually
- Difficulty impact:
  - adds moderate to high difficulty
  - best when the set is small and clearly defined

#### Relative-Order Relational Clues

- Logical meaning:
  - compares the ordered positions of two matched relationships
  - example meaning: the item paired with A occurred before the item paired with B
- Deduction value:
  - encourages cross-category reasoning
  - connects identity with order
  - often creates multi-step deductions
- Parser/validation challenges:
  - must identify which category supplies the order
  - must evaluate the ordered value associated with each entity
  - must handle before/after direction precisely
- Difficulty impact:
  - increases deduction depth
  - works well in medium and hard puzzles

#### Between Clues

- Logical meaning:
  - A is positioned between B and C in an ordered category
  - may mean strictly between, or immediately between if specified
- Deduction value:
  - strongly constrains order
  - creates useful placement chains
  - feels natural for time, rank, seating, route, or stage puzzles
- Parser/validation challenges:
  - must distinguish "between" from "immediately between"
  - must handle unordered mention order of B and C
  - requires clear ordered-category detection
- Difficulty impact:
  - medium to high
  - especially powerful with three or more ordered positions

#### Group/Comparison Clues

- Logical meaning:
  - compares groups or attributes rather than one direct pair
  - example meaning: the earlier two events did not include the blue item
  - example meaning: the two people with sweet desserts arrived after the soup
- Deduction value:
  - supports richer human-style reasoning
  - creates global constraints rather than local eliminations
  - can make puzzles feel more sophisticated
- Parser/validation challenges:
  - requires grouping, quantifiers, and category-wide comparisons
  - may need support for derived sets
  - easy to make ambiguous without careful wording
- Difficulty impact:
  - high
  - best reserved for advanced puzzles after engine support improves

## 17. Output Format

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

## 18. Creativity Rules

- Avoid repeated themes.
- Vary:
  - names
  - settings
  - objects
  - category types
  - clue structures
  - solution patterns
- Prefer vivid but compact scenarios.
- Prefer fresh, grounded scenarios that allow natural clues:
  - small events
  - shared activities
  - contests
  - schedules
  - collections
  - choices
  - preferences
  - simple mishaps
- Avoid themes that feel too similar to recent puzzles.
- Avoid overused combinations like only friends/drinks/colors unless
  specifically requested.

## 19. Thinking Instructions

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
- Check that the clue set feels like a human puzzle, not a parser stress test.
- Check that the story, categories, solution, and clues belong to the same
  scenario.
- Do not output the internal reasoning.
- Output JSON only.
