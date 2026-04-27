const fs = require("fs");
const path = require("path");

const difficultyOrder = ["קל", "בינוני", "קשה", "קשה מאוד"];

function findProjectRoot(startDir) {
  let currentDir = startDir;

  while (true) {
    if (fs.existsSync(path.join(currentDir, "package.json"))) {
      return currentDir;
    }

    const parentDir = path.dirname(currentDir);

    if (parentDir === currentDir) {
      throw new Error("Could not find package.json");
    }

    currentDir = parentDir;
  }
}

function getProjectPaths() {
  const projectRoot = findProjectRoot(process.cwd());
  const puzzlesDir = path.resolve(projectRoot, "puzzles");

  return {
    projectRoot,
    puzzlesDir,
    indexPath: path.join(puzzlesDir, "index.json"),
    draftPath: path.join(projectRoot, "draft-puzzle.json")
  };
}

function ensurePuzzlesDir(paths) {
  if (!fs.existsSync(paths.puzzlesDir)) {
    throw new Error(`Missing puzzles folder: ${paths.puzzlesDir}`);
  }
}

function getPuzzleJsonFiles(puzzlesDir) {
  return fs.readdirSync(puzzlesDir)
    .filter((fileName) => fileName.endsWith(".json") && fileName !== "index.json");
}

function readPuzzleFile(puzzlesDir, fileName) {
  const filePath = path.join(puzzlesDir, fileName);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function validatePuzzle(puzzle) {
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
  const missingField = requiredFields.find((field) => puzzle[field] === undefined || puzzle[field] === null);

  if (missingField) {
    throw new Error(`Missing required puzzle field: ${missingField}`);
  }

  if (typeof puzzle.categories !== "object" || Array.isArray(puzzle.categories)) {
    throw new Error("Puzzle categories must be an object");
  }

  if (Object.keys(puzzle.categories).length !== 3) {
    throw new Error("Puzzle must include exactly 3 categories");
  }

  if (!Array.isArray(puzzle.clues)) {
    throw new Error("Puzzle clues must be an array");
  }

  if (typeof puzzle.solution !== "object" || Array.isArray(puzzle.solution)) {
    throw new Error("Puzzle solution must be an object");
  }
}

function writePuzzleIndex(indexPath, fileNames) {
  fs.writeFileSync(indexPath, `${JSON.stringify(fileNames, null, 2)}\n`, "utf8");
}

function createPuzzleIndexEntry(fileName, puzzle) {
  return {
    file: fileName,
    id: puzzle.id,
    difficulty: puzzle.difficulty,
    levelNumber: puzzle.levelNumber,
    title: puzzle.title
  };
}

function comparePuzzlesByLevel(a, b) {
  const difficultyA = difficultyOrder.indexOf(a.puzzle.difficulty);
  const difficultyB = difficultyOrder.indexOf(b.puzzle.difficulty);
  const normalizedDifficultyA = difficultyA === -1 ? Number.MAX_SAFE_INTEGER : difficultyA;
  const normalizedDifficultyB = difficultyB === -1 ? Number.MAX_SAFE_INTEGER : difficultyB;

  if (normalizedDifficultyA !== normalizedDifficultyB) {
    return normalizedDifficultyA - normalizedDifficultyB;
  }

  if (a.puzzle.levelNumber !== b.puzzle.levelNumber) {
    return a.puzzle.levelNumber - b.puzzle.levelNumber;
  }

  return a.fileName.localeCompare(b.fileName, undefined, { numeric: true, sensitivity: "base" });
}

module.exports = {
  comparePuzzlesByLevel,
  createPuzzleIndexEntry,
  ensurePuzzlesDir,
  getProjectPaths,
  getPuzzleJsonFiles,
  readPuzzleFile,
  validatePuzzle,
  writePuzzleIndex
};
