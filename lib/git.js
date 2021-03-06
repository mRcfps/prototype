const cp = require('child_process');
const fs = require('fs-extra');
const minimatch = require('minimatch');
const parser = require('gitdiff-parser');
const path = require('path');
const which = require('which');

const { ignoreFiles, tutureRoot } = require('./config');

/**
 * Check if Git command is available.
 */
function isGitAvailable() {
  return which.sync('git', { nothrow: true }) !== null;
}

/**
 * Run arbitrary Git commands.
 * @param {Array} args arguments of command
 * @returns {Promise<String>} stdout of running this git command
 */
function runGitCommand(args) {
  return new Promise((resolve, reject) => {
    const git = cp.spawn('git', args);
    let stdout = '';
    let stderr = '';

    git.stdout.on('data', (data) => {
      stdout += data;
    });

    git.stderr.on('data', (data) => {
      stderr += data;
    });

    git.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(stderr));
      }
    });
  });
}

/**
 * Initialize a Git repo.
 */
async function initGit() {
  await runGitCommand(['init']);
}

/**
 * Get an array of Git commit messages.
 * @returns {Array} Git commit messages
 */
async function getGitLogs() {
  try {
    const output = await runGitCommand(['log', '--oneline', '--no-merges']);
    return output.trim().split('\n');
  } catch (err) {
    // Current repo doesn't have any commit yet.
    return [];
  }
}

function parseDiff(diff) {
  const files = parser.parse(diff);

  return files.map((file) => {
    const hunks = file.hunks.map(hunk => ({
      ...hunk,
      isPlain: false,
    }));

    return { ...file, hunks };
  });
}

/**
 * Get diff of a given commit.
 * @param {String} commit Commit ID
 * @returns {Array} Diff objects with attrs `file`, `explain`, and optional `collapse`
 */
async function getGitDiff(commit) {
  const output = await runGitCommand(['show', commit, '--name-only']);
  let changedFiles = output.split('\n\n').slice(-1)[0].split('\n');
  changedFiles = changedFiles.slice(0, changedFiles.length - 1);
  return changedFiles
    // don't track changes of ignored files
    .filter(file => !ignoreFiles.some(pattern => minimatch(path.basename(file), pattern)))
    .map(file => ({ file }));
}

/**
 * Store diff of all commits.
 * @param {string[]} commits Hashes of all commits
 */
async function storeDiff(commits) {
  const diffPromises = commits.map(async (commit) => {
    const output = await runGitCommand(['show', commit]);
    const diffText = output.split('\n\n').slice(-1)[0];
    const diff = parseDiff(diffText);
    return { commit, diff };
  });

  Promise.all(diffPromises).then((diffs) => {
    fs.writeFileSync(
      path.join(tutureRoot, 'diff.json'),
      JSON.stringify(diffs),
    );
  });
}

/**
 * Generate Git hook for different platforms.
 */
function getGitHook() {
  let tuturePath = path.join(__dirname, '..', 'bin', 'tuture');
  if (process.platform === 'win32') {
    // replace all \ with / in the path, as is required in Git hook on windows
    // e.g. C:\foo\bar => C:/foo/bar
    tuturePath = tuturePath.replace(/\\/g, '/');
  }
  return `#!/bin/sh\n${tuturePath} reload\n`;
}

/**
 * Add post-commit Git hook for reloading.
 */
function appendGitHook() {
  const reloadHook = getGitHook();
  const hookPath = path.join('.git', 'hooks', 'post-commit');
  if (!fs.existsSync(hookPath)) {
    fs.writeFileSync(hookPath, reloadHook, { mode: 0o755 });
  } else if (!fs.readFileSync(hookPath).toString().includes('tuture reload')) {
    fs.appendFileSync(hookPath, reloadHook);
  }
}

/**
 * Remove Git hook for reloading.
 */
function removeGitHook() {
  const reloadHook = getGitHook();
  const hookPath = path.join('.git', 'hooks', 'post-commit');
  if (fs.existsSync(hookPath)) {
    const hook = fs.readFileSync(hookPath).toString();
    if (hook === reloadHook) {
      // Auto-generated by Tuture, so delete it.
      fs.removeSync(hookPath);
    } else {
      fs.writeFileSync(hookPath, hook.replace('tuture reload', ''));
    }
  }
}

exports.isGitAvailable = isGitAvailable;
exports.initGit = initGit;
exports.getGitLogs = getGitLogs;
exports.getGitDiff = getGitDiff;
exports.storeDiff = storeDiff;
exports.appendGitHook = appendGitHook;
exports.removeGitHook = removeGitHook;
