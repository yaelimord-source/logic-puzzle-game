const fs = require("fs");
const path = require("path");
const {
  comparePuzzlesByLevel,
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

const puzzleEntries = getPuzzleJsonFiles(paths.puzzlesDir).map((fileName) => {
  const puzzle = readPuzzleFile(paths.puzzlesDir, fileName);
  validatePuzzle(puzzle);

  return { fileName, puzzle };
});

puzzleEntries.sort(comparePuzzlesByLevel);

const timestamp = Date.now();
const renamePlan = puzzleEntries.map((entry, index) => {
  return {
    from: entry.fileName,
    temp: `.${timestamp}-${index + 1}.tmp-json`,
    to: `${index + 1}.json`
  };
});

renamePlan.forEach((step) => {
  const targetPath = path.join(paths.puzzlesDir, step.to);

  if (fs.existsSync(targetPath) && step.from !== step.to) {
    const targetIsPartOfPlan = renamePlan.some((plannedStep) => plannedStep.from === step.to);

    if (!targetIsPartOfPlan) {
      throw new Error(`Refusing to overwrite existing file: ${step.to}`);
    }
  }
});

renamePlan.forEach((step) => {
  fs.renameSync(
    path.join(paths.puzzlesDir, step.from),
    path.join(paths.puzzlesDir, step.temp)
  );
});

renamePlan.forEach((step) => {
  fs.renameSync(
    path.join(paths.puzzlesDir, step.temp),
    path.join(paths.puzzlesDir, step.to)
  );
});

writePuzzleIndex(paths.indexPath, renamePlan.map((step, index) => {
  return createPuzzleIndexEntry(step.to, puzzleEntries[index].puzzle);
}));
console.log(`Renumbered ${renamePlan.length} puzzle files.`);
