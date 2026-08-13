/**
 * Run a numbered slice of the full ALAYA Playwright suite.
 *
 * PROBLEM THIS SOLVES:
 * run-all-tests.bat runs all ~90 tests in one go. If the terminal window
 * gets closed partway through (e.g. it died at test #62 of 90), there was
 * previously no way to resume - you had to restart from #1 and re-run
 * everything, including the 61 tests that already passed.
 *
 * HOW IT WORKS:
 * The numbers in the `list` reporter's output (the "ok 49 ...", "ok 50 ..."
 * lines you see while a run is in progress) are just the 1-based position
 * of each test in Playwright's discovery order. Since this suite runs
 * serially (fullyParallel: false, single chromium project, --workers=1),
 * that discovery order IS the run order. This script re-runs
 * `npx playwright test --list --reporter=json` to get that same ordered
 * list fresh (so it's always accurate even as tests are added/removed),
 * slices it to the range you ask for, and re-invokes Playwright targeting
 * only those specific tests by `file:line` - which Playwright's CLI
 * supports natively and unambiguously (unlike matching by title, which can
 * collide across files since many specs share titles like "[Happy Path]").
 *
 * USAGE:
 *   node run-range.js <start> <end>
 *   node run-range.js 63 77
 *
 * Both ends are inclusive, 1-based, matching what you see in the terminal
 * output of a previous run-all-tests.bat run.
 */

const { execFileSync, spawn } = require('child_process');

const [, , startArg, endArg] = process.argv;
const start = parseInt(startArg, 10);
const end = parseInt(endArg, 10);

if (!start || !end || start < 1 || end < start) {
  console.error('Usage: node run-range.js <start> <end>   e.g. node run-range.js 63 77');
  process.exit(1);
}

console.log(`Listing all tests to resolve range ${start}-${end}...\n`);

let listOutput;
try {
  listOutput = execFileSync('npx', ['playwright', 'test', '--list', '--reporter=json'], {
    encoding: 'utf-8',
    maxBuffer: 1024 * 1024 * 50,
    shell: true,
  });
} catch (err) {
  console.error('Failed to list tests. Run this from the project root (where playwright.config.js lives).');
  console.error(err.message);
  process.exit(1);
}

let report;
try {
  report = JSON.parse(listOutput);
} catch (err) {
  console.error('Could not parse `playwright test --list --reporter=json` output as JSON.');
  console.error(listOutput.slice(0, 500));
  process.exit(1);
}

// Flatten the suite tree (file suites > describe-block suites > specs)
// into a single ordered list of { file, line, title }.
const flat = [];
function walk(suite, inheritedFile) {
  const currentFile = suite.file || inheritedFile;
  if (Array.isArray(suite.specs)) {
    for (const spec of suite.specs) {
      flat.push({ file: currentFile, line: spec.line, title: spec.title });
    }
  }
  if (Array.isArray(suite.suites)) {
    for (const child of suite.suites) walk(child, currentFile);
  }
}
for (const project of report.suites || []) walk(project, project.file);

if (flat.length === 0) {
  console.error('No tests found. Try `npx playwright test --list` directly to check the suite is discoverable.');
  process.exit(1);
}

if (end > flat.length) {
  console.warn(`Note: the suite only has ${flat.length} tests total; clamping end to ${flat.length}.\n`);
}
const slice = flat.slice(start - 1, Math.min(end, flat.length));

if (slice.length === 0) {
  console.error(`No tests found in range ${start}-${end} (suite has ${flat.length} tests total).`);
  process.exit(1);
}

console.log(`Running tests #${start} to #${start + slice.length - 1} (${slice.length} of ${flat.length} total):\n`);
slice.forEach((t, i) => console.log(`  ${start + i}. ${t.title}  [${t.file}:${t.line}]`));
console.log('');

const targets = slice.map((t) => `${t.file}:${t.line}`);

const child = spawn('npx', ['playwright', 'test', ...targets, '--workers=1', '--reporter=list'], {
  stdio: 'inherit',
  shell: true,
});

child.on('exit', (code) => process.exit(code === null ? 1 : code));
