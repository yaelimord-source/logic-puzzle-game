const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const PUZZLES_DIR = path.join(PROJECT_ROOT, "puzzles");
const INDEX_PATH = path.join(PUZZLES_DIR, "index.json");

const DIFFICULTY_ORDER = ["קל", "בינוני", "קשה", "קשה מאוד"];
const DIFFICULTY_MAP = {
  easy: "קל",
  medium: "בינוני",
  hard: "קשה",
  "very-hard": "קשה מאוד",
  veryHard: "קשה מאוד"
};

const ORDER_WORDS = {
  before: ["לפני", "קודם"],
  after: ["אחרי", "לאחר"],
  immediatelyBefore: [
    "מיד לפני",
    "בדיוק לפני",
    "אחת לפני",
    "אחד לפני",
    "שעה אחת לפני",
    "צעד אחד לפני"
  ],
  immediatelyAfter: [
    "מיד אחרי",
    "בדיוק אחרי",
    "אחת אחרי",
    "אחד אחרי",
    "שעה אחת אחרי",
    "צעד אחד אחרי"
  ]
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function normalizeDifficulty(difficulty) {
  return DIFFICULTY_MAP[difficulty] || difficulty;
}

function normalizeText(value) {
  return String(value)
    .replace(/[\u0591-\u05C7]/g, "")
    .replace(/[־-]/g, " ")
    .replace(/[.,!?;:"'״׳()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function loadPuzzleEntries() {
  const manifest = readJson(INDEX_PATH);

  return manifest.map((entry) => {
    const fileName = typeof entry === "string" ? entry : entry.file;
    return {
      fileName,
      puzzle: readJson(path.join(PUZZLES_DIR, fileName))
    };
  });
}

function validatePuzzleShape(puzzle) {
  const requiredFields = [
    "id",
    "difficulty",
    "levelNumber",
    "title",
    "story",
    "categories",
    "clues",
    "solution"
  ];
  const missing = requiredFields.filter((field) => puzzle[field] === undefined);

  if (missing.length > 0) {
    return [`Missing required fields: ${missing.join(", ")}`];
  }

  const categoryKeys = Object.keys(puzzle.categories || {});
  if (categoryKeys.length !== 3) {
    return [`Expected exactly 3 categories, found ${categoryKeys.length}.`];
  }

  const lengths = categoryKeys.map((key) => puzzle.categories[key]?.length);
  if (!lengths.every((length) => Number.isInteger(length) && length === lengths[0])) {
    return [`Category item counts do not match: ${lengths.join(", ")}.`];
  }

  return [];
}

function getItemForms(item) {
  const normalized = normalizeText(item);
  const words = normalized.split(" ");
  const forms = new Set([normalized]);
  const hasDigit = /\d/.test(normalized);
  const isTimeLike = /^\d{1,2}\s+\d{2}$/.test(normalized);
  const isNumericLike = hasDigit || isTimeLike;

  forms.add(words.map((word) => (word.startsWith("ה") ? word.slice(1) : word)).join(" "));
  forms.add(words.map((word) => (word.startsWith("ה") ? word : `ה${word}`)).join(" "));

  if (words.length > 1 && !isNumericLike) {
    const tailForm = words.slice(1).join(" ");
    if (tailForm.length >= 3) {
      forms.add(tailForm);
    }
    forms.add(`${words[0]} ה${words.slice(1).join(" ")}`);
  }

  return unique([...forms]).sort((a, b) => b.length - a.length);
}

function stripHebrewPrefixes(token) {
  if (/\d/.test(token)) {
    return token;
  }

  let stripped = token;
  let removed = 0;

  while (/^[ובלהכמש]/.test(stripped) && stripped.length > 2 && removed < 1) {
    stripped = stripped.slice(1);
    removed += 1;
  }

  return stripped;
}

function normalizeHebrewFinalLetters(token) {
  return token
    .replace(/ך/g, "כ")
    .replace(/ם/g, "מ")
    .replace(/ן/g, "נ")
    .replace(/ף/g, "פ")
    .replace(/ץ/g, "צ");
}

function tokenVariants(token, options = {}) {
  if (!token) {
    return [];
  }

  const stripPrefixes = options.stripPrefixes !== false;
  const base = normalizeHebrewFinalLetters(token);
  const variants = new Set([base]);

  if (stripPrefixes) {
    variants.add(normalizeHebrewFinalLetters(stripHebrewPrefixes(token)));
  }

  for (const value of [...variants]) {
    if (/\d/.test(value)) {
      continue;
    }

    if (value.startsWith("ה") && value.length > 2) {
      variants.add(value.slice(1));
    }

    if (value.endsWith("ה") && value.length > 3) {
      variants.add(value.slice(0, -1));
    }
  }

  return unique([...variants]);
}

function tokenMatchesValueToken(clueToken, valueToken) {
  if (!clueToken || !valueToken) {
    return false;
  }

  if (/\d/.test(valueToken)) {
    return clueToken === valueToken;
  }

  const clueVariants = tokenVariants(clueToken, { stripPrefixes: true });
  const valueVariants = tokenVariants(valueToken, { stripPrefixes: false });

  return clueVariants.some((clueVariant) =>
    valueVariants.some((valueVariant) => clueVariant === valueVariant)
  );
}

function findFormMatch(normalizedClue, form) {
  const exactMatch = normalizedClue.match(
    new RegExp(`(^|\\s)${escapeRegExp(form)}(?=\\s|$)`)
  );

  if (exactMatch) {
    return {
      position: exactMatch.index + (exactMatch[1] ? exactMatch[1].length : 0),
      matchedText: form
    };
  }

  const clueTokens = normalizedClue.split(" ").filter(Boolean);
  const formTokens = form.split(" ").filter(Boolean);

  if (formTokens.length === 0) {
    return null;
  }

  for (let start = 0; start <= clueTokens.length - formTokens.length; start += 1) {
    const candidateTokens = clueTokens.slice(start, start + formTokens.length);
    const isMatch = formTokens.every((formToken, index) =>
      tokenMatchesValueToken(candidateTokens[index], formToken)
    );

    if (isMatch) {
      const prefix = clueTokens.slice(0, start).join(" ");
      return {
        position: prefix.length ? prefix.length + 1 : 0,
        matchedText: candidateTokens.join(" ")
      };
    }
  }

  return null;
}

function rangesOverlap(left, right) {
  return left.position < right.end && right.position < left.end;
}

function parseTimeValue(value) {
  const match = normalizeText(value).match(/^(\d{1,2})\s*:?\s*(\d{2})$/);
  if (!match) {
    return null;
  }

  return Number(match[1]) * 60 + Number(match[2]);
}

function parseNumberValue(value) {
  const normalized = normalizeText(value);
  return /^-?\d+(\.\d+)?$/.test(normalized) ? Number(normalized) : null;
}

function parseOrdinalValue(value) {
  const normalized = normalizeText(value).toLowerCase();
  const ordinalWords = {
    ראשון: 1,
    ראשונה: 1,
    שני: 2,
    שניה: 2,
    שנייה: 2,
    שלישי: 3,
    שלישית: 3,
    רביעי: 4,
    רביעית: 4,
    חמישי: 5,
    חמישית: 5,
    שישי: 6,
    שישית: 6,
    שביעי: 7,
    שביעית: 7,
    שמיני: 8,
    שמינית: 8,
    תשיעי: 9,
    תשיעית: 9,
    עשירי: 10,
    עשירית: 10,
    first: 1,
    second: 2,
    third: 3,
    fourth: 4,
    fifth: 5,
    sixth: 6,
    seventh: 7,
    eighth: 8,
    ninth: 9,
    tenth: 10
  };
  const numericOrdinal = normalized.match(/^(\d+)(st|nd|rd|th)?$/);

  if (numericOrdinal) {
    return Number(numericOrdinal[1]);
  }

  return ordinalWords[normalized] || null;
}

function isCategoryExplicitlyOrdered(puzzle, categoryKey) {
  return Boolean(
    puzzle.orderedCategories?.includes?.(categoryKey) ||
      puzzle.orderedCategory === categoryKey ||
      puzzle.categoryMetadata?.[categoryKey]?.ordered ||
      puzzle.categoryMeta?.[categoryKey]?.ordered ||
      puzzle.categoriesMeta?.[categoryKey]?.ordered
  );
}

function orderedCandidateFromValues(categoryKey, items, parser, type, priority) {
  const values = items.map(parser);
  const matchedCount = values.filter((value) => value !== null).length;
  const requiredCount = Math.max(2, Math.ceil(items.length * 0.8));

  if (matchedCount >= requiredCount) {
    return {
      accepted: true,
      categoryKey,
      type,
      priority,
      matchedCount,
      totalCount: items.length,
      reason: `${matchedCount}/${items.length} values matched ${type} pattern`,
      order: items
        .map((item, index) => ({
          item,
          value: values[index] === null ? Number.MAX_SAFE_INTEGER + index : values[index]
        }))
        .sort((a, b) => a.value - b.value)
        .map(({ item }) => item)
    };
  }

  return {
    accepted: false,
    categoryKey,
    type,
    priority,
    matchedCount,
    totalCount: items.length,
    reason: `${matchedCount}/${items.length} values matched ${type} pattern; needs at least ${requiredCount}`
  };
}

function detectOrderedCategories(puzzle) {
  const categories = puzzle.categories;
  const orderedCategories = {};
  const diagnostics = [];

  for (const [categoryKey, items] of Object.entries(categories)) {
    const candidates = [
      orderedCandidateFromValues(categoryKey, items, parseTimeValue, "time", 1),
      orderedCandidateFromValues(categoryKey, items, parseNumberValue, "number", 2),
      orderedCandidateFromValues(categoryKey, items, parseOrdinalValue, "ordinal", 3)
    ];
    const acceptedPattern = candidates.find((candidate) => candidate.accepted);

    diagnostics.push(...candidates);

    if (acceptedPattern) {
      orderedCategories[categoryKey] = {
        type: acceptedPattern.type,
        priority: acceptedPattern.priority,
        isReliableOrder: true,
        order: acceptedPattern.order,
        reason: acceptedPattern.reason
      };
      continue;
    }

    if (isCategoryExplicitlyOrdered(puzzle, categoryKey)) {
      orderedCategories[categoryKey] = {
        type: "explicit-array",
        priority: 4,
        isReliableOrder: true,
        order: [...items],
        reason: "category metadata marks this category as ordered"
      };
      diagnostics.push({
        accepted: true,
        categoryKey,
        type: "explicit-array",
        priority: 4,
        matchedCount: items.length,
        totalCount: items.length,
        reason: "category metadata marks this category as ordered"
      });
    } else {
      diagnostics.push({
        accepted: false,
        categoryKey,
        type: "explicit-array",
        priority: 4,
        matchedCount: 0,
        totalCount: items.length,
        reason: "no explicit ordered metadata"
      });
    }
  }

  return { orderedCategories, diagnostics };
}

function buildCategoryIndex(puzzle) {
  const categories = puzzle.categories;
  const categoryKeys = Object.keys(categories);
  const values = [];
  const orderedDetection = detectOrderedCategories(puzzle);

  for (const [categoryKey, items] of Object.entries(categories)) {
    for (const item of items) {
      values.push({
        categoryKey,
        item,
        forms: getItemForms(item)
      });
    }
  }

  return {
    categoryKeys,
    primaryKey: categoryKeys[0],
    orderedCategories: orderedDetection.orderedCategories,
    orderedCategoryDiagnostics: orderedDetection.diagnostics,
    values
  };
}

function findMentionedValues(clue, index) {
  const normalizedClue = normalizeText(clue);
  const mentions = [];

  for (const value of index.values) {
    const matches = value.forms
      .map((form) => ({
        form,
        match: findFormMatch(normalizedClue, form)
      }))
      .filter((candidate) => candidate.match)
      .sort(
        (a, b) =>
          b.form.length - a.form.length ||
          a.match.position - b.match.position ||
          b.match.matchedText.length - a.match.matchedText.length
      );

    if (matches.length > 0) {
      mentions.push({
        categoryKey: value.categoryKey,
        item: value.item,
        position: matches[0].match.position,
        end: matches[0].match.position + matches[0].match.matchedText.length,
        matchedText: matches[0].match.matchedText,
        matchedForm: matches[0].form
      });
    }
  }

  const uniqueMentions = mentions.filter(
    (mention, mentionIndex, allMentions) =>
      allMentions.findIndex(
        (other) =>
          other.categoryKey === mention.categoryKey && other.item === mention.item
      ) === mentionIndex
  );

  const selected = [];
  for (const mention of uniqueMentions.sort(
    (a, b) =>
      b.matchedText.length - a.matchedText.length ||
      normalizeText(b.item).length - normalizeText(a.item).length ||
      b.matchedText.length - a.matchedText.length ||
      a.position - b.position
  )) {
    if (!selected.some((other) => rangesOverlap(mention, other))) {
      selected.push(mention);
    }
  }

  return selected.sort((a, b) => a.position - b.position);
}

function hasNegativeLanguage(clue) {
  const words = normalizeText(clue).split(" ");
  return (
    words.includes("לא") ||
    words.some((word) => ["אינו", "אינה", "אינם", "אינן"].includes(word))
  );
}

function findFirstNegativePosition(clue) {
  const normalized = ` ${normalizeText(clue)} `;
  const candidates = [" לא ", " אינו ", " אינה ", " אינם ", " אינן "]
    .map((word) => normalized.indexOf(word))
    .filter((position) => position >= 0);

  return candidates.length ? Math.min(...candidates) : -1;
}

function splitNegativeSegments(clue) {
  return normalizeText(clue)
    .split(/\s+ולא\s+|\s+לא\s+|\s+אינו\s+|\s+אינה\s+|\s+אינם\s+|\s+אינן\s+/)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .slice(1);
}

function splitMixedPositiveNegativeClue(clue) {
  const normalized = normalizeText(clue);
  const match = normalized.match(/\s+(ולא|לא|אינו|אינה|אינם|אינן)\s+/);

  if (!match || match.index <= 0) {
    return null;
  }

  const positivePart = normalized.slice(0, match.index).trim();
  const negativePart = normalized.slice(match.index).trim();

  if (!positivePart || !negativePart) {
    return null;
  }

  return {
    positivePart,
    negativePart
  };
}

function positionInsideMention(position, length, mentions) {
  return mentions.some(
    (mention) => position >= mention.position && position + length <= mention.end
  );
}

function findRelationPhrase(normalized, phrase, mentions) {
  const regex = new RegExp(`(^|\\s)${escapeRegExp(phrase)}(?=\\s|$)`, "g");
  let match = regex.exec(normalized);

  while (match) {
    const position = match.index + (match[1] ? match[1].length : 0);
    if (!positionInsideMention(position, phrase.length, mentions)) {
      return true;
    }
    match = regex.exec(normalized);
  }

  return false;
}

function detectOrderRelation(clue, mentions = []) {
  const normalized = normalizeText(clue);

  for (const word of ORDER_WORDS.immediatelyBefore) {
    if (findRelationPhrase(normalized, word, mentions)) {
      return "immediatelyBefore";
    }
  }

  for (const word of ORDER_WORDS.immediatelyAfter) {
    if (findRelationPhrase(normalized, word, mentions)) {
      return "immediatelyAfter";
    }
  }

  for (const word of ORDER_WORDS.before) {
    if (findRelationPhrase(normalized, word, mentions)) {
      return "before";
    }
  }

  for (const word of ORDER_WORDS.after) {
    if (findRelationPhrase(normalized, word, mentions)) {
      return "after";
    }
  }

  return null;
}

function mentionsItem(segment, item) {
  const normalizedSegment = normalizeText(segment);
  return getItemForms(item).some((form) => findFormMatch(normalizedSegment, form));
}

function chooseNegativeSubject(mentions, primaryKey, clue) {
  const firstNegativePosition = findFirstNegativePosition(clue);
  const beforeNegative = mentions.filter(
    (mention) => firstNegativePosition === -1 || mention.position < firstNegativePosition
  );

  return (
    beforeNegative.find((mention) => mention.categoryKey === primaryKey) ||
    beforeNegative[0] ||
    mentions.find((mention) => mention.categoryKey === primaryKey) ||
    mentions[0]
  );
}

function parseNegativeClue(clue, mentions, index) {
  const subject = chooseNegativeSubject(mentions, index.primaryKey, clue);
  const segments = splitNegativeSegments(clue);

  if (!subject) {
    return unsupported(clue, "Could not identify the subject of the negative clue.");
  }

  const targets = mentions.filter((mention) => {
    const isSubject =
      mention.categoryKey === subject.categoryKey && mention.item === subject.item;
    return (
      !isSubject &&
      mention.categoryKey !== subject.categoryKey &&
      segments.some((segment) => mentionsItem(segment, mention.item))
    );
  });

  if (targets.length === 0 && mentions.length === 2) {
    const target = mentions.find(
      (mention) =>
        mention.categoryKey !== subject.categoryKey
    );
    if (!target) {
      return unsupported(
        clue,
        "Negative clue does not identify a value from another category."
      );
    }
    return parsed(clue, [
      {
        type: "notEquals",
        left: subject,
        right: target
      }
    ]);
  }

  if (targets.length === 0) {
    return unsupported(clue, "Could not safely identify the negated value(s).");
  }

  const negTermCount = countNegationTerms(clue);
  const partialReason =
    targets.length < negTermCount
      ? `Negation chain: expected ~${negTermCount} negated value(s), extracted ${targets.length}.`
      : null;

  return parsed(
    clue,
    targets.map((target) => ({
      type: "notEquals",
      left: subject,
      right: target
    })),
    partialReason
  );
}

function parseOrderClue(clue, mentions, index, relation) {
  const reliableOrderedKeys = Object.keys(index.orderedCategories)
    .filter((key) => index.orderedCategories[key].isReliableOrder)
    .sort(
      (a, b) =>
        index.orderedCategories[a].priority - index.orderedCategories[b].priority
    );
  const mentionedCategoryKeys = unique(mentions.map((mention) => mention.categoryKey));
  const mentionedReliableKeys = reliableOrderedKeys.filter((key) =>
    mentionedCategoryKeys.includes(key)
  );
  const topPriority = reliableOrderedKeys.length
    ? index.orderedCategories[reliableOrderedKeys[0]].priority
    : null;
  const topPriorityKeys = reliableOrderedKeys.filter(
    (key) => index.orderedCategories[key].priority === topPriority
  );
  const selectedKeys =
    reliableOrderedKeys.length === 1
      ? reliableOrderedKeys
      : mentionedReliableKeys.length === 1
        ? mentionedReliableKeys
        : topPriorityKeys.length === 1
          ? topPriorityKeys
          : [];

  if (selectedKeys.length !== 1) {
    return unsupported(
      clue,
      "Order clue detected, but no single reliable ordered category could be chosen safely."
    );
  }

  if (mentions.length !== 2) {
    return unsupported(
      clue,
      "Order clue detected, but it does not mention exactly two known values."
    );
  }

  return parsed(clue, [
    {
      type: relation,
      orderedCategoryKey: selectedKeys[0],
      left: mentions[0],
      right: mentions[1]
    }
  ]);
}

function parsePositiveClue(clue, mentions, index) {
  if (mentions.length === 2) {
    if (mentions[0].categoryKey === mentions[1].categoryKey) {
      return unsupported(
        clue,
        "Positive equality clue mentions two values from the same category."
      );
    }

    return parsed(clue, [
      {
        type: "equals",
        left: mentions[0],
        right: mentions[1]
      }
    ]);
  }

  const subject = mentions.find((mention) => mention.categoryKey === index.primaryKey);

  if (!subject || mentions.length < 2) {
    return unsupported(
      clue,
      "Positive clue needs exactly two values, or one clear primary-category subject."
    );
  }

  const targets = mentions
    .filter(
      (mention) =>
        mention.categoryKey !== subject.categoryKey || mention.item !== subject.item
    )
    .filter((target) => target.categoryKey !== subject.categoryKey);

  if (targets.length === 0) {
    return unsupported(
      clue,
      "Positive clue did not identify a value from another category."
    );
  }

  return parsed(
    clue,
    targets.map((target) => ({
      type: "equals",
      left: subject,
      right: target
    }))
  );
}

function parsed(clue, constraints, partialReason = null) {
  return {
    clue,
    constraints,
    unsupportedReason: null,
    partialReason
  };
}

function unsupported(clue, reason) {
  return {
    clue,
    constraints: [],
    unsupportedReason: reason,
    partialReason: null
  };
}

function countNegationTerms(clue) {
  const negTokens = new Set(["לא", "ולא", "אינו", "אינה", "אינם", "אינן"]);
  return normalizeText(clue)
    .split(/\s+/)
    .filter((token) => negTokens.has(token)).length;
}

function isMiShePattern(clue) {
  return /(?:^|\s)מי\s+ש/.test(normalizeText(clue));
}

function parseMiSheClue(clue, mentions, index) {
  const normalized = normalizeText(clue);

  // Split at the first negation keyword to separate the subject clause from the predicate.
  // Pattern: "[מי ש...subject value...] [negation] [predicate values...]"
  const negSplit = normalized.match(/^(.*?)\s+(לא|ולא|אינו|אינה|אינם|אינן)\s+(.+)$/);

  if (negSplit) {
    const subjectPart = negSplit[1];
    const predicatePart = negSplit[3];

    const subjectMentions = findMentionedValues(subjectPart, index);
    const predicateMentions = findMentionedValues(predicatePart, index);

    if (subjectMentions.length === 0) {
      return parseNegativeClue(clue, mentions, index);
    }

    // Use the last mention in the subject clause as the subject value
    // (the value typically follows the verb: "מי שלבש כחול" → כחול)
    const subject = subjectMentions[subjectMentions.length - 1];
    const targets = predicateMentions.filter((m) => m.categoryKey !== subject.categoryKey);

    if (targets.length === 0) {
      return unsupported(
        clue,
        "מי ש clue: predicate does not mention a value from a different category than the subject."
      );
    }

    // Detect partial extraction: count negation terms in the predicate
    // plus 1 for the negation keyword we split on
    const predicateNegCount = countNegationTerms(predicatePart);
    const expectedTargets = predicateNegCount + 1;
    const partialReason =
      targets.length < expectedTargets
        ? `מי ש clue: expected ${expectedTargets} negated value(s), extracted ${targets.length}.`
        : null;

    return parsed(
      clue,
      targets.map((target) => ({ type: "notEquals", left: subject, right: target })),
      partialReason
    );
  }

  // Positive "מי ש" clue (no negation detected)
  if (mentions.length < 2) {
    return unsupported(clue, "מי ש positive clue: fewer than two known values identified.");
  }

  if (mentions.length === 2 && mentions[0].categoryKey !== mentions[1].categoryKey) {
    return parsed(clue, [{ type: "equals", left: mentions[0], right: mentions[1] }]);
  }

  const subject = mentions[0];
  const targets = mentions.slice(1).filter((m) => m.categoryKey !== subject.categoryKey);

  if (targets.length === 0) {
    return unsupported(
      clue,
      "מי ש positive clue: all mentioned values are from the same category as the subject."
    );
  }

  return parsed(
    clue,
    targets.map((target) => ({ type: "equals", left: subject, right: target }))
  );
}

function parseClue(clue, index) {
  const mentions = findMentionedValues(clue, index);
  const orderRelation = detectOrderRelation(clue, mentions);

  if (mentions.length < 2) {
    return unsupported(clue, "Could not identify at least two known category values.");
  }

  if (orderRelation) {
    return parseOrderClue(clue, mentions, index, orderRelation);
  }

  // Route "מי ש..." patterns to a dedicated handler that treats the value inside
  // the "מי ש" clause as the constraint subject rather than requiring a primary-
  // category entity to be named explicitly.
  if (isMiShePattern(clue)) {
    return parseMiSheClue(clue, mentions, index);
  }

  if (hasNegativeLanguage(clue)) {
    const mixedParts = splitMixedPositiveNegativeClue(clue);

    if (mixedParts) {
      const positiveMentions = findMentionedValues(mixedParts.positivePart, index);
      const negativeMentions = findMentionedValues(mixedParts.negativePart, index);

      // Only look for a subject inside the positive (pre-negation) part of the clue.
      // Falling back to the full mentions list would pick primary-category values
      // that appear in the negative part, producing a wrong subject and incorrect
      // constraint direction (e.g. "כחול לא שייך לדור" would make דור the subject).
      const subject =
        positiveMentions.find((mention) => mention.categoryKey === index.primaryKey) ||
        positiveMentions[0];

      // If the positive part contains no recognised subject, defer entirely to
      // parseNegativeClue which uses position-based subject selection.
      if (!subject) {
        return parseNegativeClue(clue, mentions, index);
      }

      const positiveTargets = positiveMentions.filter(
        (mention) =>
          mention.categoryKey !== subject.categoryKey ||
          mention.item !== subject.item
      );
      const negativeTargets = negativeMentions.filter(
        (mention) =>
          mention.categoryKey !== subject.categoryKey &&
          mention.item !== subject.item
      );
      const constraints = [];

      for (const target of positiveTargets) {
        if (target.categoryKey !== subject.categoryKey) {
          constraints.push({
            type: "equals",
            left: subject,
            right: target
          });
        }
      }

      for (const target of negativeTargets) {
        constraints.push({
          type: "notEquals",
          left: subject,
          right: target
        });
      }

      if (constraints.length > 0) {
        const negTermCount = countNegationTerms(clue);
        const notEqualsCount = constraints.filter((c) => c.type === "notEquals").length;
        const partialReason =
          notEqualsCount > 0 && notEqualsCount < negTermCount
            ? `Mixed clue: expected ~${negTermCount} negation(s), extracted ${notEqualsCount} notEquals constraint(s).`
            : null;
        return parsed(clue, constraints, partialReason);
      }
    }

    return parseNegativeClue(clue, mentions, index);
  }

  return parsePositiveClue(clue, mentions, index);
}

function permutations(items) {
  if (items.length <= 1) {
    return [items];
  }

  const result = [];
  items.forEach((item, index) => {
    const rest = [...items.slice(0, index), ...items.slice(index + 1)];
    for (const permutation of permutations(rest)) {
      result.push([item, ...permutation]);
    }
  });
  return result;
}

function buildCandidate(primaryKey, primaryItems, comparisonKeys, selectedPermutations) {
  const candidate = {};

  primaryItems.forEach((primaryItem, itemIndex) => {
    candidate[primaryItem] = {};
    comparisonKeys.forEach((categoryKey, categoryIndex) => {
      candidate[primaryItem][categoryKey] = selectedPermutations[categoryIndex][itemIndex];
    });
  });

  return candidate;
}

function primaryForValue(candidate, mention) {
  if (candidate[mention.item]) {
    return mention.item;
  }

  return Object.keys(candidate).find(
    (primaryItem) => candidate[primaryItem][mention.categoryKey] === mention.item
  );
}

function valuesAreEqual(candidate, left, right) {
  const leftPrimary = primaryForValue(candidate, left);
  const rightPrimary = primaryForValue(candidate, right);
  return Boolean(leftPrimary && rightPrimary && leftPrimary === rightPrimary);
}

function valueOnOrderedCategory(candidate, mention, orderedCategoryKey) {
  if (mention.categoryKey === orderedCategoryKey) {
    return mention.item;
  }

  const primary = primaryForValue(candidate, mention);
  return primary ? candidate[primary][orderedCategoryKey] : null;
}

function satisfiesOrderConstraint(candidate, constraint, orderedCategories) {
  const order = orderedCategories[constraint.orderedCategoryKey]?.order;
  if (!order) {
    return false;
  }

  const leftValue = valueOnOrderedCategory(
    candidate,
    constraint.left,
    constraint.orderedCategoryKey
  );
  const rightValue = valueOnOrderedCategory(
    candidate,
    constraint.right,
    constraint.orderedCategoryKey
  );
  const leftIndex = order.indexOf(leftValue);
  const rightIndex = order.indexOf(rightValue);

  if (leftIndex < 0 || rightIndex < 0) {
    return false;
  }

  if (constraint.type === "before") {
    return leftIndex < rightIndex;
  }

  if (constraint.type === "after") {
    return leftIndex > rightIndex;
  }

  if (constraint.type === "immediatelyBefore") {
    return leftIndex + 1 === rightIndex;
  }

  if (constraint.type === "immediatelyAfter") {
    return leftIndex - 1 === rightIndex;
  }

  return false;
}

function satisfiesConstraint(candidate, constraint, orderedCategories) {
  if (constraint.type === "equals") {
    return valuesAreEqual(candidate, constraint.left, constraint.right);
  }

  if (constraint.type === "notEquals") {
    return !valuesAreEqual(candidate, constraint.left, constraint.right);
  }

  return satisfiesOrderConstraint(candidate, constraint, orderedCategories);
}

function countSolutions(puzzle, constraints, index) {
  const primaryKey = index.primaryKey;
  const comparisonKeys = index.categoryKeys.slice(1);
  const primaryItems = puzzle.categories[primaryKey];
  const comparisonPermutations = comparisonKeys.map((key) =>
    permutations(puzzle.categories[key])
  );
  let count = 0;
  const samples = [];

  function walk(categoryIndex, selectedPermutations) {
    if (categoryIndex === comparisonPermutations.length) {
      const candidate = buildCandidate(
        primaryKey,
        primaryItems,
        comparisonKeys,
        selectedPermutations
      );
      const isValid = constraints.every((constraint) =>
        satisfiesConstraint(candidate, constraint, index.orderedCategories)
      );

      if (isValid) {
        count += 1;
        if (samples.length < 3) {
          samples.push(candidate);
        }
      }
      return;
    }

    for (const permutation of comparisonPermutations[categoryIndex]) {
      walk(categoryIndex + 1, [...selectedPermutations, permutation]);
    }
  }

  walk(0, []);
  return { count, samples };
}

function getSolutionStatus(solutionCount, hasUnsupported, hasPartial) {
  if (hasUnsupported) {
    return {
      status: "NEEDS_MANUAL_REVIEW",
      reason: "unsupported clues exist, result may be unreliable"
    };
  }

  if (hasPartial) {
    return {
      status: "NEEDS_MANUAL_REVIEW",
      reason: "partially parsed clues exist, some constraints may be missing"
    };
  }

  if (solutionCount === 0) {
    return {
      status: "CONTRADICTION",
      reason: "no full solution satisfies all structured constraints"
    };
  }

  if (solutionCount > 1) {
    return {
      status: "INVALID",
      reason: "multiple solutions satisfy the structured constraints"
    };
  }

  return {
    status: "VALID",
    reason: null
  };
}

function getSeverity(result) {
  const hasFullCoverage =
    result.parserSummary?.coverage === 100 &&
    result.parserSummary?.unsupported === 0 &&
    result.parserSummary?.partial === 0;

  if (result.status === "VALID" && hasFullCoverage && result.possibleSolutions === 1) {
    return "OK";
  }

  if (result.status === "INVALID" || result.status === "CONTRADICTION") {
    return hasFullCoverage ? "BLOCKER" : "REVIEW";
  }

  if (result.status === "NEEDS_MANUAL_REVIEW") {
    return "REVIEW";
  }

  return "REVIEW";
}

function constraintToText(constraint) {
  const leftMatch = constraint.left.matchedText
    ? `, matched "${constraint.left.matchedText}" as "${constraint.left.matchedForm || constraint.left.item}"`
    : "";
  const rightMatch = constraint.right.matchedText
    ? `, matched "${constraint.right.matchedText}" as "${constraint.right.matchedForm || constraint.right.item}"`
    : "";
  const left = `${constraint.left.item} (${constraint.left.categoryKey}${leftMatch})`;
  const right = `${constraint.right.item} (${constraint.right.categoryKey}${rightMatch})`;

  if (constraint.type === "equals") {
    return `${left} == ${right}`;
  }

  if (constraint.type === "notEquals") {
    return `${left} != ${right}`;
  }

  return `${left} ${constraint.type} ${right} by ${constraint.orderedCategoryKey}`;
}

function validatePuzzle(fileName, puzzle) {
  const shapeErrors = validatePuzzleShape(puzzle);
  if (shapeErrors.length > 0) {
    return {
      fileName,
      puzzle,
      status: "INVALID_DATA",
      reason: shapeErrors.join(" "),
      possibleSolutions: 0,
      parsedClues: [],
      constraints: [],
      orderedCategoryDiagnostics: [],
      selectedOrderedCategories: [],
      redundantClues: [],
      samples: [],
      parserSummary: {
        total: Array.isArray(puzzle.clues) ? puzzle.clues.length : 0,
        parsed: 0,
        unsupported: Array.isArray(puzzle.clues) ? puzzle.clues.length : 0,
        coverage: 0
      }
    };
  }

  const index = buildCategoryIndex(puzzle);
  const parsedClues = puzzle.clues.map((clue, clueIndex) => ({
    clueIndex,
    ...parseClue(clue, index)
  }));
  const unsupportedClues = parsedClues.filter((clue) => clue.unsupportedReason);
  // Partially parsed: the parser extracted some constraints but detected it may have missed others.
  const partialClues = parsedClues.filter((clue) => !clue.unsupportedReason && clue.partialReason);
  const constraints = parsedClues.flatMap((clue) =>
    clue.constraints.map((constraint) => ({
      ...constraint,
      clueIndex: clue.clueIndex
    }))
  );
  const solutionResult = countSolutions(puzzle, constraints, index);
  const status = getSolutionStatus(
    solutionResult.count,
    unsupportedClues.length > 0,
    partialClues.length > 0
  );
  const redundantClues = [];

  if (unsupportedClues.length === 0 && partialClues.length === 0 && solutionResult.count === 1) {
    const individuallyRedundantClues = [];

    for (const parsedClue of parsedClues) {
      const withoutClue = constraints.filter(
        (constraint) => constraint.clueIndex !== parsedClue.clueIndex
      );
      const result = countSolutions(puzzle, withoutClue, index);
      if (result.count === 1) {
        individuallyRedundantClues.push(parsedClue.clueIndex);
      }
    }

    if (individuallyRedundantClues.length > 0) {
      const withoutAllCandidates = constraints.filter(
        (constraint) => !individuallyRedundantClues.includes(constraint.clueIndex)
      );
      const combinedRemovalResult = countSolutions(puzzle, withoutAllCandidates, index);

      if (combinedRemovalResult.count === 1) {
        redundantClues.push(...individuallyRedundantClues);
      }
    }
  }

  const result = {
    fileName,
    puzzle,
    status: status.status,
    reason: status.reason,
    possibleSolutions: solutionResult.count,
    parsedClues,
    constraints,
    orderedCategoryDiagnostics: index.orderedCategoryDiagnostics,
    selectedOrderedCategories: Object.entries(index.orderedCategories).map(
      ([categoryKey, details]) => ({
        categoryKey,
        type: details.type,
        reason: details.reason,
        order: details.order
      })
    ),
    redundantClues,
    samples: solutionResult.samples,
    parserSummary: {
      total: parsedClues.length,
      parsed: parsedClues.length - unsupportedClues.length - partialClues.length,
      partial: partialClues.length,
      unsupported: unsupportedClues.length,
      coverage: parsedClues.length
        ? Math.round(
            ((parsedClues.length - unsupportedClues.length - partialClues.length) /
              parsedClues.length) *
              100
          )
        : 100
    },
    severity: null
  };

  result.severity = getSeverity(result);
  return result;
}

function assertGeneralParserSample(name, puzzle, clue, expectedType, expectedItems) {
  const index = buildCategoryIndex(puzzle);
  const result = parseClue(clue, index);
  if (result.unsupportedReason) {
    const mentions = findMentionedValues(clue, index)
      .map((mention) => `${mention.item}:${mention.matchedText}`)
      .join(", ");
    throw new Error(
      `${name}: expected parsed clue, got unsupported: ${result.unsupportedReason}; mentions: ${mentions || "none"}`
    );
  }

  if (result.constraints.length !== 1) {
    throw new Error(`${name}: expected one constraint, got ${result.constraints.length}`);
  }

  const [constraint] = result.constraints;
  const actualItems = [constraint.left.item, constraint.right.item].sort();
  const wantedItems = [...expectedItems].sort();

  if (
    constraint.type !== expectedType ||
    actualItems.length !== wantedItems.length ||
    actualItems.some((item, index) => item !== wantedItems[index])
  ) {
    throw new Error(
      `${name}: expected ${expectedType} ${wantedItems.join(" / ")}, got ${constraint.type} ${actualItems.join(" / ")}`
    );
  }
}

function assertMultiConstraintSample(name, puzzle, clue, expectedConstraints) {
  const index = buildCategoryIndex(puzzle);
  const result = parseClue(clue, index);

  if (result.unsupportedReason) {
    throw new Error(`${name}: expected parsed clue, got unsupported: ${result.unsupportedReason}`);
  }

  if (result.constraints.length !== expectedConstraints.length) {
    throw new Error(
      `${name}: expected ${expectedConstraints.length} constraint(s), got ${result.constraints.length}`
    );
  }

  expectedConstraints.forEach(({ type, items }, constraintIndex) => {
    const constraint = result.constraints[constraintIndex];
    const actualItems = [constraint.left.item, constraint.right.item].sort();
    const wantedItems = [...items].sort();

    if (
      constraint.type !== type ||
      actualItems.some((item, i) => item !== wantedItems[i])
    ) {
      throw new Error(
        `${name} constraint ${constraintIndex + 1}: expected ${type} ${wantedItems.join(" / ")}, got ${constraint.type} ${actualItems.join(" / ")}`
      );
    }
  });
}

function runGeneralParserSelfChecks() {
  const samples = [
    {
      name: "coffee-cup-color",
      puzzle: {
        categories: {
          people: ["דנה", "יואב"],
          drinks: ["קפה", "תה"],
          colors: ["אדום", "כחול"]
        }
      },
      clue: "מי ששותה קפה משתמש בכוס אדומה.",
      type: "equals",
      items: ["קפה", "אדום"]
    },
    {
      name: "basket-bed-negative",
      puzzle: {
        categories: {
          pets: ["צ׳יפס", "מוקי"],
          costumes: ["כובע פיראט", "גלימת קוסם"],
          beds: ["סל קש", "כרית עגולה"]
        }
      },
      clue: "צ׳יפס לא נח בסל הקש.",
      type: "notEquals",
      items: ["צ׳יפס", "סל קש"]
    },
    {
      name: "rolls-time-negative",
      puzzle: {
        categories: {
          people: ["רחל", "יונתן"],
          items: ["לחמניות", "חלב"],
          times: ["09:00", "09:30"]
        }
      },
      clue: "הלחמניות לא הגיעו ב-09:30.",
      type: "notEquals",
      items: ["לחמניות", "09:30"]
    },
    {
      name: "milk-time-negative",
      puzzle: {
        categories: {
          people: ["רחל", "יונתן"],
          items: ["לחמניות", "חלב"],
          times: ["09:00", "09:30"]
        }
      },
      clue: "החלב לא הגיע ב-09:00.",
      type: "notEquals",
      items: ["חלב", "09:00"]
    },
    {
      name: "activity-hall-positive",
      puzzle: {
        categories: {
          guides: ["אלון", "דפנה"],
          activities: ["חידון חלל", "תצפית ירח"],
          halls: ["חדר מאדים", "אולם שביט"]
        }
      },
      clue: "חידון החלל התקיים בחדר מאדים.",
      type: "equals",
      items: ["חידון חלל", "חדר מאדים"]
    },
    {
      name: "equipment-moment-positive",
      puzzle: {
        categories: {
          people: ["נעמה", "כפיר"],
          equipment: ["שמיכת צמר", "פנס ראש"],
          moments: ["ראה ראשון", "ספר בקול"]
        }
      },
      clue: "שמיכת צמר הופיע יחד עם ראה ראשון.",
      type: "equals",
      items: ["שמיכת צמר", "ראה ראשון"]
    },
    {
      name: "robot-ability-positive",
      puzzle: {
        categories: {
          builders: ["אור", "דנה"],
          robots: ["קופצני", "פיקסל"],
          abilities: ["עוקב אחרי קו", "דוחף קוביות"]
        }
      },
      clue: "קופצני הופיע יחד עם עוקב אחרי קו.",
      type: "equals",
      items: ["קופצני", "עוקב אחרי קו"]
    },
    // "מי ש..." negative pattern: subject is the value in the מי ש clause.
    // Verbs are chosen to avoid prefix-stripping into category values
    // (e.g. "שתה" strips ש → "תה", which matches the "tea" value — so we use "קיבל" instead).
    {
      name: "mi-she-negative",
      puzzle: {
        categories: {
          people: ["דנה", "יואב"],
          drinks: ["שוקו", "מיץ"],
          colors: ["כחול", "אדום"]
        }
      },
      clue: "מי שלבש כחול לא קיבל שוקו.",
      type: "notEquals",
      items: ["כחול", "שוקו"]
    },
    // "מי ש..." positive pattern
    {
      name: "mi-she-positive",
      puzzle: {
        categories: {
          people: ["דנה", "יואב"],
          drinks: ["שוקו", "מיץ"],
          colors: ["כחול", "אדום"]
        }
      },
      clue: "מי שלבש כחול קיבל שוקו.",
      type: "equals",
      items: ["כחול", "שוקו"]
    }
  ];

  samples.forEach((sample) => {
    assertGeneralParserSample(
      sample.name,
      sample.puzzle,
      sample.clue,
      sample.type,
      sample.items
    );
  });

  // Multi-constraint checks — negation chains that must produce exactly N constraints
  const multiSamples = [
    {
      name: "negation-chain-two",
      puzzle: {
        categories: {
          people: ["דור", "דנה", "רון"],
          colors: ["כחול", "צהוב", "אדום"],
          drinks: ["קפה", "תה", "מיץ"]
        }
      },
      clue: "דור לא לבש כחול ולא צהוב.",
      constraints: [
        { type: "notEquals", items: ["דור", "כחול"] },
        { type: "notEquals", items: ["דור", "צהוב"] }
      ]
    },
    {
      name: "non-primary-subject-negation-chain",
      puzzle: {
        categories: {
          people: ["דור", "דנה", "רון"],
          colors: ["כחול", "אדום", "ירוק"],
          drinks: ["קפה", "תה", "מיץ"]
        }
      },
      clue: "כחול לא שייך לדור ולא לדנה.",
      constraints: [
        { type: "notEquals", items: ["כחול", "דור"] },
        { type: "notEquals", items: ["כחול", "דנה"] }
      ]
    }
  ];

  multiSamples.forEach((sample) => {
    assertMultiConstraintSample(
      sample.name,
      sample.puzzle,
      sample.clue,
      sample.constraints
    );
  });
}

function printSolution(solution) {
  Object.entries(solution).forEach(([primaryItem, matches]) => {
    const text = Object.entries(matches)
      .map(([key, value]) => `${key}: ${value}`)
      .join(", ");
    console.log(`  - ${primaryItem}: ${text}`);
  });
}

function printParsedClues(result) {
  console.log("Parsed clues:");
  result.parsedClues.forEach((parsedClue) => {
    console.log(`- clue ${parsedClue.clueIndex + 1}: ${parsedClue.clue}`);

    if (parsedClue.unsupportedReason) {
      console.log("  Parsed: unsupported");
      console.log(`  Reason: ${parsedClue.unsupportedReason}`);
      return;
    }

    if (parsedClue.partialReason) {
      console.log("  Parsed: partial");
      console.log(`  Warning: ${parsedClue.partialReason}`);
    }

    parsedClue.constraints.forEach((constraint) => {
      console.log(`  Parsed: ${constraintToText(constraint)}`);
      console.log(`  Type: ${constraint.type}`);
    });
  });
}

function printReport(results, options) {
  if (options.problemsOnly) {
    printProblemsOnlyReport(results);
    return;
  }

  console.log("Puzzle validation report");
  console.log("========================");
  console.log(`Checked ${results.length} puzzle(s).`);
  console.log("");

  for (const result of results) {
    const puzzle = result.puzzle;
    console.log(`Puzzle ${puzzle?.id || result.fileName}:`);
    console.log(`File: ${result.fileName}`);
    console.log(`Difficulty: ${normalizeDifficulty(puzzle?.difficulty) || "unknown"}`);
    console.log(`Status: ${result.status}`);
    console.log(`Severity: ${result.severity}`);
    if (result.status === "NEEDS_MANUAL_REVIEW") {
      console.log(`Partial parsed constraints solutions: ${result.possibleSolutions}`);
    } else {
      console.log(`Possible solutions: ${result.possibleSolutions}`);
    }
    const { parsed: nParsed, partial: nPartial, unsupported: nUnsupported, total: nTotal, coverage } = result.parserSummary;
    const coverageParts = [`${nParsed}/${nTotal} fully parsed (${coverage}%)`];
    if (nPartial > 0) {
      coverageParts.push(`${nPartial} partial`);
    }
    if (nUnsupported > 0) {
      coverageParts.push(`${nUnsupported} unsupported`);
    }
    console.log(`Parser coverage: ${coverageParts.join(", ")}`);

    if (result.reason) {
      console.log(`Reason: ${result.reason}`);
    }

    printParsedClues(result);

    if (result.status === "NEEDS_MANUAL_REVIEW") {
      console.log("Manual review checklist:");
      console.log("- Warning: Validation is incomplete because not all clues were fully parsed");
      const unsupportedClues = result.parsedClues.filter((clue) => clue.unsupportedReason);
      const partialCluesToList = result.parsedClues.filter((clue) => !clue.unsupportedReason && clue.partialReason);
      if (unsupportedClues.length > 0) {
        console.log("- Unsupported clues:");
        unsupportedClues.forEach((clue) => {
          console.log(`  - clue ${clue.clueIndex + 1}: ${clue.clue}`);
          console.log(`    Reason: ${clue.unsupportedReason}`);
        });
      }
      if (partialCluesToList.length > 0) {
        console.log("- Partially parsed clues:");
        partialCluesToList.forEach((clue) => {
          console.log(`  - clue ${clue.clueIndex + 1}: ${clue.clue}`);
          console.log(`    Warning: ${clue.partialReason}`);
        });
      }
      console.log("- Fully parsed clues:");
      result.parsedClues
        .filter((clue) => !clue.unsupportedReason && !clue.partialReason)
        .forEach((clue) => {
          console.log(`  - clue ${clue.clueIndex + 1}: ${clue.clue}`);
        });
      console.log(`- Partial solution count: ${result.possibleSolutions}`);
    }

    if (result.redundantClues.length > 0) {
      console.log("Redundant clues:");
      result.redundantClues.forEach((clueIndex) => {
        console.log(`- clue ${clueIndex + 1}: ${puzzle.clues[clueIndex]}`);
      });
    } else if (result.status === "VALID" && result.possibleSolutions === 1) {
      console.log("Redundant clues: none detected");
    } else {
      console.log(
        "Redundant clues: skipped because parser coverage is incomplete or puzzle is not uniquely solved"
      );
    }

    if (options.debug) {
      console.log("Debug ordered category candidates:");
      if (result.orderedCategoryDiagnostics.length === 0) {
        console.log("- none");
      } else {
        result.orderedCategoryDiagnostics.forEach((candidate) => {
          const decision = candidate.accepted ? "accepted" : "rejected";
          console.log(
            `- ${candidate.categoryKey} as ${candidate.type}: ${decision} (${candidate.reason})`
          );
        });
      }

      console.log("Debug selected ordered categories:");
      if (result.selectedOrderedCategories.length === 0) {
        console.log("- none");
      } else {
        result.selectedOrderedCategories.forEach((category) => {
          console.log(
            `- ${category.categoryKey} (${category.type}): ${category.reason}; order: ${category.order.join(" -> ")}`
          );
        });
      }

      console.log("Debug constraints:");
      if (result.constraints.length === 0) {
        console.log("- none");
      } else {
        result.constraints.forEach((constraint) => {
          console.log(`- clue ${constraint.clueIndex + 1}: ${constraintToText(constraint)}`);
        });
      }

      if (result.samples.length > 0 && result.possibleSolutions <= 3) {
        console.log("Debug sample solutions:");
        result.samples.forEach((solution, index) => {
          console.log(`Solution ${index + 1}:`);
          printSolution(solution);
        });
      } else if (result.samples.length > 0) {
        console.log("Debug sample solutions: hidden because there are many solutions");
      } else {
        console.log("Debug sample solutions: none");
      }
    }

    console.log("");
  }

  const summary = results.reduce(
    (counts, result) => {
      counts[result.status] = (counts[result.status] || 0) + 1;
      return counts;
    },
    {
      VALID: 0,
      INVALID: 0,
      CONTRADICTION: 0,
      NEEDS_MANUAL_REVIEW: 0
    }
  );

  console.log("Summary:");
  console.log(`VALID: ${summary.VALID || 0}`);
  console.log(`INVALID: ${summary.INVALID || 0}`);
  console.log(`CONTRADICTION: ${summary.CONTRADICTION || 0}`);
  console.log(`NEEDS_MANUAL_REVIEW: ${summary.NEEDS_MANUAL_REVIEW || 0}`);
}

function printProblemsOnlyReport(results) {
  const problemResults = results.filter((result) => result.status !== "VALID");

  console.log("Problem puzzle report");
  console.log("=====================");
  console.log(`Showing ${problemResults.length} puzzle(s).`);
  console.log("");

  problemResults.forEach((result) => {
    console.log(`File: ${result.fileName}`);
    console.log(`ID: ${result.puzzle?.id || "unknown"}`);
    console.log(`Status: ${result.status}`);
    console.log(`Severity: ${result.severity}`);
    if (result.status === "NEEDS_MANUAL_REVIEW") {
      console.log(`Partial parsed constraints solutions: ${result.possibleSolutions}`);
      console.log("Warning: Validation is incomplete because not all clues were parsed");
    } else {
      console.log(`Possible solutions: ${result.possibleSolutions}`);
    }

    const unsupportedClues = result.parsedClues.filter(
      (clue) => clue.unsupportedReason
    );

    if (unsupportedClues.length > 0) {
      console.log("Unsupported clue reasons:");
      unsupportedClues.forEach((clue) => {
        console.log(`- clue ${clue.clueIndex + 1}: ${clue.clue}`);
        console.log(`  Reason: ${clue.unsupportedReason}`);
      });
    } else {
      console.log("Unsupported clue reasons: none");
    }

    if (result.status === "NEEDS_MANUAL_REVIEW") {
      console.log("Parsed clues:");
      result.parsedClues
        .filter((clue) => !clue.unsupportedReason)
        .forEach((clue) => {
          console.log(`- clue ${clue.clueIndex + 1}: ${clue.clue}`);
        });
    }

    console.log("");
  });

  const summary = problemResults.reduce(
    (counts, result) => {
      counts[result.status] = (counts[result.status] || 0) + 1;
      return counts;
    },
    {
      VALID: 0,
      INVALID: 0,
      CONTRADICTION: 0,
      NEEDS_MANUAL_REVIEW: 0
    }
  );

  console.log("Summary:");
  console.log(`VALID: ${summary.VALID || 0}`);
  console.log(`INVALID: ${summary.INVALID || 0}`);
  console.log(`CONTRADICTION: ${summary.CONTRADICTION || 0}`);
  console.log(`NEEDS_MANUAL_REVIEW: ${summary.NEEDS_MANUAL_REVIEW || 0}`);
}

function parseNumberValue(value) {
  const normalized = normalizeText(value);
  const exactNumber = normalized.match(/^-?\d+(\.\d)?$/);
  if (exactNumber) {
    return Number(normalized);
  }

  const embeddedNumbers = normalized.match(/-?\d+(\.\d+)?/g);
  if (embeddedNumbers && embeddedNumbers.length === 1) {
    return Number(embeddedNumbers[0]);
  }

  return null;
}

function parseOrderClue(clue, mentions, index, relation) {
  const reliableOrderedKeys = Object.keys(index.orderedCategories)
    .filter((key) => index.orderedCategories[key].isReliableOrder)
    .sort(
      (a, b) =>
        index.orderedCategories[a].priority - index.orderedCategories[b].priority
    );
  const mentionedCategoryKeys = unique(mentions.map((mention) => mention.categoryKey));
  const mentionedReliableKeys = reliableOrderedKeys.filter((key) =>
    mentionedCategoryKeys.includes(key)
  );
  const topPriority = reliableOrderedKeys.length
    ? index.orderedCategories[reliableOrderedKeys[0]].priority
    : null;
  const topPriorityKeys = reliableOrderedKeys.filter(
    (key) => index.orderedCategories[key].priority === topPriority
  );
  const selectedKeys =
    mentionedReliableKeys.length === 1
      ? mentionedReliableKeys
      : reliableOrderedKeys.length === 1
        ? reliableOrderedKeys
        : topPriorityKeys.length === 1
          ? topPriorityKeys
          : [];

  if (selectedKeys.length !== 1) {
    return unsupported(
      clue,
      "Order clue detected, but no single reliable ordered category could be chosen safely."
    );
  }

  if (mentions.length !== 2) {
    return unsupported(
      clue,
      "Order clue detected, but it does not mention exactly two known values."
    );
  }

  return parsed(clue, [
    {
      type: relation,
      orderedCategoryKey: selectedKeys[0],
      left: mentions[0],
      right: mentions[1]
    }
  ]);
}

function main() {
  const args = process.argv.slice(2);
  const debug = args.includes("--debug");
  const problemsOnly = args.includes("--problems-only");
  const target = args.find((arg) => !arg.startsWith("--"));
  runGeneralParserSelfChecks();
  const entries = loadPuzzleEntries()
    .filter(({ fileName, puzzle }) => !target || fileName === target || puzzle.id === target)
    .sort((a, b) => {
      const difficultyCompare =
        DIFFICULTY_ORDER.indexOf(normalizeDifficulty(a.puzzle.difficulty)) -
        DIFFICULTY_ORDER.indexOf(normalizeDifficulty(b.puzzle.difficulty));

      if (difficultyCompare !== 0) {
        return difficultyCompare;
      }

      return Number(a.puzzle.levelNumber) - Number(b.puzzle.levelNumber);
    });

  if (target && entries.length === 0) {
    console.error(`No puzzle found for "${target}". Use a puzzle id or filename.`);
    process.exitCode = 1;
    return;
  }

  const results = entries.map(({ fileName, puzzle }) => validatePuzzle(fileName, puzzle));
  printReport(results, { debug, problemsOnly });

  process.exitCode = results.some(
    (result) => result.status !== "VALID" && result.status !== "NEEDS_MANUAL_REVIEW"
  )
    ? 1
    : 0;
}

module.exports = {
  buildCategoryIndex,
  countSolutions,
  getSolutionStatus,
  loadPuzzleEntries,
  parseClue,
  validatePuzzle
};

if (require.main === module) {
  main();
}
