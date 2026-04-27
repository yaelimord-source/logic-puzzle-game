const fs = require("fs");
const path = require("path");
const {
  createPuzzleIndexEntry,
  ensurePuzzlesDir,
  getProjectPaths,
  getPuzzleJsonFiles,
  readPuzzleFile,
  validatePuzzle,
  writePuzzleIndex
} = require("./puzzle-file-utils");

const paths = getProjectPaths();
ensurePuzzlesDir(paths);

if (!fs.existsSync(paths.draftPath)) {
  throw new Error("Missing draft-puzzle.json in the project root");
}

const draftPuzzle = JSON.parse(fs.readFileSync(paths.draftPath, "utf8"));
validatePuzzle(draftPuzzle);

const numericFileNames = getPuzzleJsonFiles(paths.puzzlesDir)
  .filter((fileName) => /^\d+\.json$/.test(fileName));
const highestNumber = numericFileNames.reduce((highest, fileName) => {
  const number = Number.parseInt(fileName, 10);
  return Number.isNaN(number) ? highest : Math.max(highest, number);
}, 0);
const nextFileName = `${highestNumber + 1}.json`;
const nextFilePath = path.join(paths.puzzlesDir, nextFileName);

if (fs.existsSync(nextFilePath)) {
  throw new Error(`Refusing to overwrite existing file: ${nextFileName}`);
}

fs.writeFileSync(nextFilePath, `${JSON.stringify(draftPuzzle, null, 2)}\n`, "utf8");

const updatedIndex = getPuzzleJsonFiles(paths.puzzlesDir)
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))
  .map((fileName) => {
    const puzzle = readPuzzleFile(paths.puzzlesDir, fileName);
    validatePuzzle(puzzle);
    return createPuzzleIndexEntry(fileName, puzzle);
  });

writePuzzleIndex(paths.indexPath, updatedIndex);
console.log(`Imported draft puzzle to puzzles/${nextFileName}.`);
