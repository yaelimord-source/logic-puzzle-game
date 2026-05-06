const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const { validatePuzzle } = require("./validate-puzzles");

const projectRoot = path.resolve(__dirname, "..");
const specPath = path.join(projectRoot, "prompts", "puzzle-generation.md");
const puzzlesDir = path.join(projectRoot, "puzzles");
const indexPath = path.join(puzzlesDir, "index.json");
const rejectedDir = path.join(projectRoot, "debug", "generated-rejected");

const defaultDifficulty = process.env.PUZZLE_DIFFICULTY || "בינוני";
const maxRetries = Number(process.env.PUZZLE_GENERATION_RETRIES || 10);
const minParserCoverage = Number(process.env.PUZZLE_MIN_PARSER_COVERAGE || 90);
const validDifficulties = ["קל", "בינוני", "קשה", "קשה מאוד"];
const difficultyMap = {
  easy: "קל",
  medium: "בינוני",
  hard: "קשה",
  "very-hard": "קשה מאוד",
  veryHard: "קשה מאוד"
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function timestampForFileName() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");

  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    "-",
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds())
  ].join("");
}

function safeStatusForFileName(status) {
  return String(status || "ERROR").replace(/[^a-z0-9_-]+/gi, "_");
}

function saveRejectedAttempt({ puzzle, validation, reason, attempt }) {
  fs.mkdirSync(rejectedDir, { recursive: true });

  const status = validation?.status || "ERROR";
  const baseName = `attempt-${timestampForFileName()}-${String(attempt).padStart(2, "0")}-${safeStatusForFileName(status)}`;
  const puzzlePath = path.join(rejectedDir, `${baseName}.json`);
  const reportPath = path.join(rejectedDir, `${baseName}.report.json`);
  const unsupportedClues =
    validation?.parsedClues
      ?.filter((clue) => clue.unsupportedReason)
      .map((clue) => ({
        clueNumber: clue.clueIndex + 1,
        clue: clue.clue,
        reason: clue.unsupportedReason
      })) || [];

  writeJson(puzzlePath, puzzle || { error: "No puzzle JSON was produced." });
  writeJson(reportPath, {
    status,
    possibleSolutions: validation?.possibleSolutions ?? null,
    parserCoverage: validation?.parserSummary?.coverage ?? null,
    reason,
    qualityReview: arguments[0].qualityReview || null,
    unsupportedClues
  });
}

function parseArgs() {
  const args = process.argv.slice(2);
  const countArg = args.find((arg) => arg.startsWith("--count="));
  const difficultyArg = args.find((arg) => arg.startsWith("--difficulty="));

  return {
    count: countArg ? Number(countArg.split("=")[1]) : 1,
    difficulty: normalizeDifficulty(
      difficultyArg ? difficultyArg.split("=").slice(1).join("=") : defaultDifficulty
    )
  };
}

function normalizeDifficulty(difficulty) {
  return difficultyMap[difficulty] || difficulty;
}

function getPuzzleFileName(entry) {
  return typeof entry === "string" ? entry : entry.file;
}

function getExistingPuzzleFiles() {
  return fs
    .readdirSync(puzzlesDir)
    .filter((fileName) => /^\d+\.json$/.test(fileName));
}

function getNextFileNumber() {
  const fileNumbers = getExistingPuzzleFiles()
    .map((fileName) => Number(fileName.replace(".json", "")))
    .filter(Number.isFinite);

  return fileNumbers.length ? Math.max(...fileNumbers) + 1 : 1;
}

function getNextLevelNumber(indexEntries, difficulty) {
  const normalizedDifficulty = normalizeDifficulty(difficulty);
  const levelNumbers = indexEntries
    .filter((entry) => typeof entry === "object")
    .filter((entry) => normalizeDifficulty(entry.difficulty) === normalizedDifficulty)
    .map((entry) => Number(entry.levelNumber))
    .filter(Number.isFinite);

  return levelNumbers.length ? Math.max(...levelNumbers) + 1 : 1;
}

function assertNoDuplicateIndexEntries(indexEntries) {
  const seenFiles = new Set();
  const seenIds = new Set();
  const seenLevelsByDifficulty = new Set();

  for (const entry of indexEntries) {
    const fileName = getPuzzleFileName(entry);
    const id = typeof entry === "object" ? entry.id : null;
    const levelNumber = typeof entry === "object" ? Number(entry.levelNumber) : null;

    if (fileName) {
      if (seenFiles.has(fileName)) {
        throw new Error(`Duplicate file in puzzles/index.json: ${fileName}`);
      }
      seenFiles.add(fileName);
    }

    if (id) {
      if (seenIds.has(id)) {
        throw new Error(`Duplicate puzzle id in puzzles/index.json: ${id}`);
      }
      seenIds.add(id);
    }

    if (Number.isFinite(levelNumber)) {
      const levelKey = `${normalizeDifficulty(entry.difficulty)}:${levelNumber}`;
      if (seenLevelsByDifficulty.has(levelKey)) {
        throw new Error(
          `Duplicate levelNumber in puzzles/index.json for ${normalizeDifficulty(entry.difficulty)}: ${levelNumber}`
        );
      }
      seenLevelsByDifficulty.add(levelKey);
    }
  }
}

function assertDifficultyIsSupported(difficulty) {
  if (!validDifficulties.includes(difficulty)) {
    throw new Error(
      `Unsupported difficulty "${difficulty}". Use one of: ${validDifficulties.join(", ")}`
    );
  }
}

function assertUniqueArrayValues(values, label) {
  const seen = new Set();
  for (const value of values) {
    if (seen.has(value)) {
      throw new Error(`Duplicate value in ${label}: ${value}`);
    }
    seen.add(value);
  }
}

function assertGeneratedPuzzleIntegrity(
  puzzle,
  indexEntries,
  expectedDifficulty,
  expectedLevelNumber,
  expectedId
) {
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
  const missingFields = requiredFields.filter((field) => puzzle[field] === undefined);
  if (missingFields.length > 0) {
    throw new Error(`Generated puzzle is missing fields: ${missingFields.join(", ")}`);
  }

  if (puzzle.difficulty !== expectedDifficulty) {
    throw new Error(
      `Generated puzzle difficulty mismatch: expected ${expectedDifficulty}, got ${puzzle.difficulty}`
    );
  }

  if (Number(puzzle.levelNumber) !== expectedLevelNumber) {
    throw new Error(
      `Generated puzzle levelNumber mismatch: expected ${expectedLevelNumber}, got ${puzzle.levelNumber}`
    );
  }

  if (String(puzzle.id) !== expectedId) {
    throw new Error(`Generated puzzle id mismatch: expected ${expectedId}, got ${puzzle.id}`);
  }

  if (indexEntries.some((entry) => typeof entry === "object" && entry.id === puzzle.id)) {
    throw new Error(`Generated puzzle id already exists: ${puzzle.id}`);
  }

  const categoryEntries = Object.entries(puzzle.categories || {});
  if (categoryEntries.length !== 3) {
    throw new Error(
      `Generated puzzle must have exactly 3 categories for the current app, got ${categoryEntries.length}`
    );
  }

  const categoryLengths = categoryEntries.map(([, values]) =>
    Array.isArray(values) ? values.length : -1
  );
  if (!categoryLengths.every((length) => length === categoryLengths[0] && length >= 3 && length <= 5)) {
    throw new Error(`Generated puzzle category sizes are invalid: ${categoryLengths.join(", ")}`);
  }

  categoryEntries.forEach(([categoryKey, values]) => {
    assertUniqueArrayValues(values, `category "${categoryKey}"`);
  });

  const [mainCategoryKey, ...comparisonKeys] = categoryEntries.map(([key]) => key);
  const mainItems = puzzle.categories[mainCategoryKey];
  const solutionKeys = Object.keys(puzzle.solution || {});
  assertUniqueArrayValues(solutionKeys, "solution main keys");

  if (solutionKeys.length !== mainItems.length || !mainItems.every((item) => puzzle.solution[item])) {
    throw new Error("Generated puzzle solution must include exactly one entry for every main category item.");
  }

  mainItems.forEach((mainItem) => {
    comparisonKeys.forEach((categoryKey) => {
      const value = puzzle.solution[mainItem]?.[categoryKey];
      const label = puzzle.categoryLabels?.[categoryKey];

      if (label && puzzle.solution[mainItem]?.[label] !== undefined) {
        throw new Error(
          `Generated puzzle solution must use category key "${categoryKey}", not display label "${label}".`
        );
      }

      if (!puzzle.categories[categoryKey].includes(value)) {
        throw new Error(
          `Generated puzzle solution value "${value}" for "${mainItem}" is not in category "${categoryKey}".`
        );
      }
    });
  });

  comparisonKeys.forEach((categoryKey) => {
    const usedValues = mainItems.map((mainItem) => puzzle.solution[mainItem][categoryKey]);
    assertUniqueArrayValues(usedValues, `solution values for "${categoryKey}"`);
  });

  if (!Array.isArray(puzzle.clues) || puzzle.clues.length < 5 || puzzle.clues.length > 8) {
    throw new Error(`Generated puzzle must include 5-8 clues, got ${puzzle.clues?.length || 0}.`);
  }
}

function normalizeForConsistency(value) {
  return String(value)
    .replace(/[\u0591-\u05C7]/g, "")
    .replace(/([ובלמשכה])-?(\d)/g, "$2")
    .replace(/[.,!?;:"'״׳()[\]{}\-–—]/g, " ")
    .replace(/(^|\s)את(?=\s|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripPrefixesForConsistency(token) {
  if (/\d/.test(token)) {
    return token.replace(/^[ובלמשכה]+(?=\d)/, "");
  }

  let stripped = token;
  let removed = 0;
  while (/^[ובלמשכה]/.test(stripped) && stripped.length > 3 && removed < 3) {
    stripped = stripped.slice(1);
    removed += 1;
  }
  return stripped;
}

function consistencyTokenMatches(clueToken, valueToken) {
  const clueVariants = [clueToken, stripPrefixesForConsistency(clueToken)];
  const valueVariants = [valueToken, stripPrefixesForConsistency(valueToken)];
  return clueVariants.some((clueVariant) =>
    valueVariants.some((valueVariant) => clueVariant === valueVariant)
  );
}

function consistencyValueMatch(clue, value) {
  const clueTokens = normalizeForConsistency(clue).split(" ").filter(Boolean);
  const valueTokens = normalizeForConsistency(value).split(" ").filter(Boolean);

  for (let start = 0; start <= clueTokens.length - valueTokens.length; start += 1) {
    const candidate = clueTokens.slice(start, start + valueTokens.length);
    if (
      valueTokens.every((valueToken, index) =>
        consistencyTokenMatches(candidate[index], valueToken)
      )
    ) {
      return {
        value,
        position: start,
        matchedText: candidate.join(" ")
      };
    }
  }

  return null;
}

function findClueMentionsForConsistency(clue, puzzle) {
  const mentions = [];

  Object.entries(puzzle.categories).forEach(([categoryKey, values]) => {
    values.forEach((value) => {
      const match = consistencyValueMatch(clue, value);
      if (match) {
        mentions.push({
          categoryKey,
          item: value,
          position: match.position,
          matchedText: match.matchedText
        });
      }
    });
  });

  return mentions
    .sort((a, b) => a.position - b.position)
    .filter(
      (mention, index, all) =>
        all.findIndex(
          (other) =>
            other.categoryKey === mention.categoryKey && other.item === mention.item
        ) === index
    );
}

function parseTimeForConsistency(value) {
  const match = normalizeForConsistency(value).match(/^(\d{1,2})\s*:?\s*(\d{2})$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function parseNumberForConsistency(value) {
  const normalized = normalizeForConsistency(value);
  const time = parseTimeForConsistency(value);
  if (time !== null) {
    return time;
  }

  const numbers = normalized.match(/-?\d+(\.\d+)?/g);
  return numbers && numbers.length === 1 ? Number(numbers[0]) : null;
}

function detectOrderedCategoryForConsistency(puzzle) {
  const candidates = Object.entries(puzzle.categories)
    .map(([categoryKey, values]) => {
      const parsedValues = values.map(parseNumberForConsistency);
      const matched = parsedValues.filter((value) => value !== null).length;
      return {
        categoryKey,
        values,
        parsedValues,
        matched,
        isReliable: matched === values.length && values.length >= 2
      };
    })
    .filter((candidate) => candidate.isReliable);

  if (candidates.length !== 1) {
    return null;
  }

  const candidate = candidates[0];
  return {
    categoryKey: candidate.categoryKey,
    order: candidate.values
      .map((item, index) => ({ item, value: candidate.parsedValues[index] }))
      .sort((a, b) => a.value - b.value)
      .map(({ item }) => item)
  };
}

function primaryForConsistencyMention(puzzle, mention) {
  if (puzzle.solution[mention.item]) {
    return mention.item;
  }

  return Object.keys(puzzle.solution).find(
    (primaryItem) => puzzle.solution[primaryItem]?.[mention.categoryKey] === mention.item
  );
}

function orderedValueForMention(puzzle, orderedCategoryKey, mention) {
  if (mention.categoryKey === orderedCategoryKey) {
    return mention.item;
  }

  const primary = primaryForConsistencyMention(puzzle, mention);
  return primary ? puzzle.solution[primary]?.[orderedCategoryKey] : null;
}

function detectOrderRelationForConsistency(clue) {
  const normalized = normalizeForConsistency(clue);
  if (/מיד\s+אחרי|בדיוק\s+אחרי/.test(normalized)) {
    return "immediatelyAfter";
  }
  if (/מיד\s+לפני|בדיוק\s+לפני/.test(normalized)) {
    return "immediatelyBefore";
  }
  if (/מאוחר\s+יותר|אחרי|לאחר/.test(normalized)) {
    return "after";
  }
  if (/מוקדם\s+יותר|לפני/.test(normalized)) {
    return "before";
  }
  return null;
}

function assertGeneratedCluesMatchDeclaredSolution(puzzle) {
  const orderedCategory = detectOrderedCategoryForConsistency(puzzle);

  puzzle.clues.forEach((clue, clueIndex) => {
    const mentions = findClueMentionsForConsistency(clue, puzzle);
    const normalizedClue = normalizeForConsistency(clue);
    const hasRelationalByReceiverPattern =
      /נבחר\s+על\s+ידי\s+מי\s+שקיבל|נבחרה\s+על\s+ידי\s+מי\s+שקיבל|נבחר\s+על\s+ידי\s+מי\s+שקיבלה|נבחרה\s+על\s+ידי\s+מי\s+שקיבלה/.test(
        normalizedClue
      );

    if (hasRelationalByReceiverPattern && mentions.length === 2) {
      const leftPrimary = primaryForConsistencyMention(puzzle, mentions[0]);
      const rightPrimary = primaryForConsistencyMention(puzzle, mentions[1]);

      if (!leftPrimary || !rightPrimary || leftPrimary !== rightPrimary) {
        throw new Error(
          `False clue ${clueIndex + 1}: "${clue}" (${mentions[0].item} and ${mentions[1].item} do not belong to the same solution entity).`
        );
      }
    }

    const relation = detectOrderRelationForConsistency(clue);
    if (!relation) {
      return;
    }

    if (!orderedCategory) {
      throw new Error(
        `Clue ${clueIndex + 1} uses an order relation, but no single ordered category was detected: ${clue}`
      );
    }

    if (mentions.length !== 2) {
      return;
    }

    const leftOrderedValue = orderedValueForMention(
      puzzle,
      orderedCategory.categoryKey,
      mentions[0]
    );
    const rightOrderedValue = orderedValueForMention(
      puzzle,
      orderedCategory.categoryKey,
      mentions[1]
    );
    const leftIndex = orderedCategory.order.indexOf(leftOrderedValue);
    const rightIndex = orderedCategory.order.indexOf(rightOrderedValue);
    let isTrue = false;

    if (leftIndex < 0 || rightIndex < 0) {
      throw new Error(
        `Clue ${clueIndex + 1} could not be evaluated against the declared solution: ${clue}`
      );
    }

    if (relation === "before") {
      isTrue = leftIndex < rightIndex;
    } else if (relation === "after") {
      isTrue = leftIndex > rightIndex;
    } else if (relation === "immediatelyBefore") {
      isTrue = leftIndex + 1 === rightIndex;
    } else if (relation === "immediatelyAfter") {
      isTrue = leftIndex - 1 === rightIndex;
    }

    if (!isTrue) {
      throw new Error(
        `False clue ${clueIndex + 1}: "${clue}" (${mentions[0].item} maps to ${leftOrderedValue}, ${mentions[1].item} maps to ${rightOrderedValue}; relation ${relation} is false).`
      );
    }
  });
}

function extractJsonObject(text) {
  const trimmed = text.trim();

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fencedMatch) {
    return fencedMatch[1].trim();
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  throw new Error("Model response did not contain a JSON object.");
}

function callClaude(prompt) {
  return new Promise((resolve, reject) => {
    const proc = execFile(
      "claude",
      ["--print", "--dangerously-skip-permissions"],
      { maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`claude process failed: ${error.message}\n${stderr}`));
          return;
        }
        resolve(stdout);
      }
    );
    proc.stdin.write(prompt, "utf8");
    proc.stdin.end();
  });
}

async function callClaudeJson(prompt) {
  const text = await callClaude(prompt);
  if (!text.trim()) {
    throw new Error("claude returned empty output.");
  }
  return JSON.parse(extractJsonObject(text));
}

async function callClaudeText(prompt) {
  const text = await callClaude(prompt);
  if (!text.trim()) {
    throw new Error("claude returned empty output.");
  }
  return text;
}

function buildPrompt(spec, difficulty, levelNumber) {
  return [
    spec,
    "",
    "Generate one new puzzle now.",
    "For the current app version, generate exactly 3 categories.",
    `Use difficulty: ${difficulty}`,
    `Use levelNumber: ${levelNumber}`,
    "Use the exact id provided by the caller after generation; it will be the numeric file id.",
    "Return strict JSON only. Do not include markdown or explanations."
  ].join("\n");
}

function buildQualityGatePrompt(spec, puzzle) {
  return [
    "You are a strict quality reviewer for Hebrew logic puzzles.",
    "Use the following project puzzle-generation specification as your standard:",
    spec,
    "",
    "Review this generated puzzle before it is saved:",
    JSON.stringify(puzzle, null, 2),
    "",
    "Reject the puzzle if any of the following are true:",
    "- category relationships are nonsensical",
    "- clues are grammatically valid but semantically unnatural",
    "- story does not naturally connect to the categories",
    "- solution associations feel arbitrary or incoherent",
    "- a human player would not understand what is being compared",
    "- any clue contradicts the provided solution",
    "- any clue has reversed before/after direction",
    "- any immediately-before or immediately-after clue is not strictly adjacent",
    "- any ordered/time relation is inconsistent with the ordered category array",
    "",
    "Perform this internal self-check:",
    "1. Does the story make sense?",
    "2. Do all categories belong naturally to the same scenario?",
    "3. Are all clues meaningful in the scenario?",
    "4. Would a human player understand what is being compared?",
    "5. Is every clue true according to the solution?",
    "6. Are all before/after directions correct?",
    "7. Are all immediately-before/immediately-after clues strictly adjacent?",
    "8. Do all ordered clues match the ordered category array?",
    "",
    "Return strict JSON only:",
    "{",
    '  "approved": true,',
    '  "reasons": []',
    "}",
    "or",
    "{",
    '  "approved": false,',
    '  "reasons": ["short reason 1", "short reason 2"]',
    "}"
  ].join("\n");
}

async function runQualityGate(spec, puzzle) {
  const rawReview = await callClaudeText(buildQualityGatePrompt(spec, puzzle));
  const review = JSON.parse(extractJsonObject(rawReview));

  if (!review.approved) {
    const reasons = Array.isArray(review.reasons) ? review.reasons.join("; ") : "No reason provided";
    const error = new Error(`Quality gate rejected puzzle: ${reasons}`);
    error.qualityReview = review;
    throw error;
  }

  return review;
}

function makeIndexEntry(fileName, puzzle) {
  return {
    file: fileName,
    id: puzzle.id,
    difficulty: puzzle.difficulty,
    levelNumber: puzzle.levelNumber,
    title: puzzle.title
  };
}

function validateGeneratedPuzzle(fileName, puzzle) {
  const firstValidation = validatePuzzle(fileName, puzzle);
  const secondValidation = validatePuzzle(fileName, JSON.parse(JSON.stringify(puzzle)));
  const validations = [firstValidation, secondValidation];
  const failedValidation = validations.find(
    (validation) =>
      validation.status !== "VALID" ||
      validation.possibleSolutions !== 1 ||
      validation.parserSummary?.coverage < minParserCoverage
  );

  if (failedValidation) {
    const error = new Error(
      `${fileName} failed validation: ${failedValidation.status}, ${failedValidation.possibleSolutions} solution(s), ${failedValidation.parserSummary?.coverage || 0}% parser coverage.`
    );
    error.validation = failedValidation;
    throw error;
  }

  if (
    firstValidation.status !== secondValidation.status ||
    firstValidation.possibleSolutions !== secondValidation.possibleSolutions ||
    firstValidation.parserSummary?.coverage !== secondValidation.parserSummary?.coverage
  ) {
    const error = new Error("Double validation was not stable across both validation passes.");
    error.validation = secondValidation;
    throw error;
  }

  return secondValidation;
}

async function generateOnePuzzle({ spec, indexEntries, difficulty }) {
  const fileNumber = getNextFileNumber();
  const fileName = `${fileNumber}.json`;
  const id = String(fileNumber);
  const levelNumber = getNextLevelNumber(indexEntries, difficulty);

  if (fs.existsSync(path.join(puzzlesDir, fileName))) {
    throw new Error(`Refusing to overwrite existing puzzle file: ${fileName}`);
  }

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    let puzzle = null;

    try {
      puzzle = await callClaudeJson(buildPrompt(spec, difficulty, levelNumber));
      puzzle.id = id;
      puzzle.difficulty = difficulty;
      puzzle.levelNumber = levelNumber;
      assertGeneratedPuzzleIntegrity(puzzle, indexEntries, difficulty, levelNumber, id);
      assertGeneratedCluesMatchDeclaredSolution(puzzle);
      await runQualityGate(spec, puzzle);
      validateGeneratedPuzzle(fileName, puzzle);
      const filePath = path.join(puzzlesDir, fileName);
      writeJson(filePath, puzzle);
      indexEntries.push(makeIndexEntry(fileName, puzzle));
      writeJson(indexPath, indexEntries);

      return {
        fileName,
        puzzle,
        attempts: attempt,
        failedAttempts: attempt - 1
      };
    } catch (error) {
      saveRejectedAttempt({
        puzzle,
        validation: error.validation,
        reason: error.message,
        qualityReview: error.qualityReview,
        attempt
      });
      console.log(
        `Discarded generated puzzle attempt ${attempt}/${maxRetries}: ${error.message}`
      );
    }
  }

  throw new Error(`Failed to generate a valid puzzle after ${maxRetries} attempt(s).`);
}

async function main() {
  const { count, difficulty } = parseArgs();
  assertDifficultyIsSupported(difficulty);
  const spec = fs.readFileSync(specPath, "utf8");
  const indexEntries = readJson(indexPath);
  assertNoDuplicateIndexEntries(indexEntries);
  const saved = [];
  let attempts = 0;
  let failedAttempts = 0;

  for (let i = 0; i < count; i += 1) {
    const result = await generateOnePuzzle({ spec, indexEntries, difficulty });
    attempts += result.attempts;
    failedAttempts += result.failedAttempts;
    saved.push(result);
    console.log(`Saved ${result.fileName}: ${result.puzzle.id}`);
  }

  console.log("");
  console.log("Generation summary");
  console.log("==================");
  console.log(`Requested: ${count}`);
  console.log(`Saved valid puzzles: ${saved.length}`);
  console.log(`Total attempts: ${attempts}`);
  console.log(`Failed attempts: ${failedAttempts}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
