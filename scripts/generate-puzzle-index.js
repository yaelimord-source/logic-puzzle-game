const fs = require("fs");
const {
  createPuzzleIndexEntry,
  ensurePuzzlesDir,
  getProjectPaths,
  getPuzzleJsonFiles,
  readPuzzleFile,
  validatePuzzle,
  writePuzzleIndex
} = require("./puzzle-file-utils");

function printDiagnostics(paths) {
  const rootFiles = fs.existsSync(paths.projectRoot)
    ? fs.readdirSync(paths.projectRoot)
    : [];

  console.error("current working directory:", process.cwd());
  console.error("absolute resolved project root:", paths.projectRoot);
  console.error("absolute resolved puzzles directory:", paths.puzzlesDir);
  console.error("files visible in the project root:", rootFiles.join(", "));
}

const paths = getProjectPaths();

try {
  ensurePuzzlesDir(paths);
} catch (error) {
  printDiagnostics(paths);
  process.exit(1);
}

const puzzleFiles = getPuzzleJsonFiles(paths.puzzlesDir)
  .sort((a, b) => {
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
  });
const puzzleIndex = puzzleFiles.map((fileName) => {
  const puzzle = readPuzzleFile(paths.puzzlesDir, fileName);
  validatePuzzle(puzzle);
  return createPuzzleIndexEntry(fileName, puzzle);
});

writePuzzleIndex(paths.indexPath, puzzleIndex);
console.log(`Generated puzzles/index.json with ${puzzleIndex.length} puzzle files.`);
