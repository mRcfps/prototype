/**
 * Utilities for implementing Tuture CLI.
 */

const cp = require('child_process');
const fs = require('fs-extra');

const ora = require('ora');
const path = require('path');
const prompts = require('prompts');
const signale = require('signale');
const yaml = require('js-yaml');

const { tutureRoot } = require('./config');
const git = require('./git');

/**
 * Check if .tuture directory and tuture.yml both exists.
 */
function ifTutureSuiteExists() {
  return fs.existsSync(tutureRoot) && fs.existsSync('tuture.yml');
}

/**
 * Remove all Tuture-related files.
 */
async function removeTutureSuite() {
  await fs.remove('tuture.yml');
  await fs.remove(tutureRoot);
}

/**
 * Output error message and exit with status 1.
 * @param {String} message Error message
 */
function errAndExit(message) {
  signale.fatal(message.trim().replace('fatal: ', ''));
  process.exit(1);
}

/**
 * Construct metadata object from user prompt
 * @param {boolean} shouldPrompt Whether `-y` option is provided
 * @returns {object} Metadata object to be dumped into tuture.yml
 */
async function promptMetaData(shouldPrompt) {
  const defaultValues = {
    name: 'My Awesome Tutorial',
    version: '0.0.1',
    language: 'en',
  };
  const questions = [
    {
      type: 'text',
      name: 'name',
      message: 'Tutorial Name',
      initial: defaultValues.name,
    },
    {
      type: 'text',
      name: 'version',
      message: 'Version',
      initial: defaultValues.version,
    },
    {
      type: 'select',
      name: 'language',
      message: 'Tutorial Language',
      choices: [
        { title: 'English', value: 'en' },
        { title: '简体中文', value: 'zh-CN' },
      ],
      initial: 0,
    },
    {
      type: 'list',
      name: 'topics',
      message: 'Topics',
      initial: 'javascript, git, cli',
    },
    {
      type: 'text',
      name: 'email',
      message: 'Maintainer Email',
      initial: 'me@example.com',
    },
  ];

  const onCancel = () => errAndExit('Aborted!');

  return shouldPrompt ? prompts(questions, { onCancel }) : defaultValues;
}

async function makeSteps() {
  let logs = await git.getGitLogs();
  logs = logs
    .reverse()
    // filter out commits whose commit message starts with 'tuture:'
    .filter(log => !log.slice(8, log.length).startsWith('tuture:'));

  // Store all diff into .tuture/diff.json
  const commits = logs.map(log => log.slice(0, 7));
  await git.storeDiff(commits);

  return logs
    .map(async (log, idx) => {
      const msg = log.slice(8, log.length);
      return {
        name: msg,
        commit: commits[idx],
        diff: await git.getGitDiff(commits[idx]),
      };
    });
}

/**
 * Constructs "steps" section in tuture.yml and store diff files.
 */
async function getSteps() {
  const spinner = ora('Extracting diffs from git log...').start();
  const steps = await makeSteps().then(async (resArr) => {
    const res = await Promise.all(resArr);
    spinner.stop();
    signale.success('Diff files are created!');
    return res;
  });

  return steps;
}

/**
 * Write tuture object into tuture.yml and .tuture/tuture.json
 * @param {Object} tuture Tuture object
 */
function writeTuture(tuture) {
  fs.writeFileSync(
    path.join(tutureRoot, 'tuture.json'),
    JSON.stringify(tuture),
  );
  fs.writeFileSync('tuture.yml', yaml.safeDump(tuture));
}

/**
 * Append .tuture rule to gitignore.
 * If it's already ignored, do nothing.
 * If .gitignore doesn't exist, create one and add the rule.
 */
function appendGitignore() {
  const ignoreRules = '# Tuture supporting files\n\n.tuture\n';

  if (!fs.existsSync('.gitignore')) {
    fs.writeFileSync('.gitignore', ignoreRules);
  } else if (!fs.readFileSync('.gitignore').toString().includes('.tuture')) {
    fs.appendFileSync('.gitignore', `\n${ignoreRules}`);
  }
}

/**
 * Initialize Tuture tutorial.
 * @param {Object} options Command-line options
 */
async function initTuture(options) {
  if (ifTutureSuiteExists()) {
    signale.success('Tuture has already been initialized!');
    process.exit(0);
  }

  if (!git.isGitAvailable()) {
    errAndExit('Git is not installed on your machine!');
  }

  if (!fs.existsSync('.git')) {
    const onCancel = () => errAndExit('Aborted!');

    const response = options.yes ? { answer: true } : await prompts({
      type: 'confirm',
      name: 'answer',
      message: 'You are not in a Git repository, do you want to initialize one?',
      initial: false,
    }, { onCancel });

    if (!response.answer) {
      errAndExit('Aborted!');
    } else {
      await git.initGit();
      signale.success('Git repo is initialized!');
    }
  }

  const tuture = await promptMetaData(!options.yes);
  fs.mkdirSync(tutureRoot);

  try {
    tuture.steps = await getSteps();

    writeTuture(tuture);
    signale.success('tuture.yml is created!');

    appendGitignore();
    git.appendGitHook();
  } catch (err) {
    await removeTutureSuite();
    errAndExit(err.message);
  }
}

/**
 * Update Tuture files (diff files and tuture.yml).
 */
async function reloadTuture() {
  if (!ifTutureSuiteExists()) {
    errAndExit('Tuture has not been initialized!');
  }

  if (!git.isGitAvailable()) {
    errAndExit('Git is not installed on your machine!');
  }

  let tuture = null;
  try {
    tuture = yaml.safeLoad(fs.readFileSync('tuture.yml'), 'utf8');
  } catch (err) {
    errAndExit(err.message);
  }

  const currentSteps = await getSteps();
  currentSteps.forEach((currentStep, index) => {
    tuture.steps.forEach((step) => {
      if (currentStep.commit === step.commit) {
        currentSteps[index] = step;
      }
    });
  });

  tuture.steps = currentSteps;
  writeTuture(tuture);
  signale.success('Reload complete!');
}

/**
 * Start up tuture-renderer.
 */
function startRenderer() {
  if (!ifTutureSuiteExists()) {
    errAndExit('Tuture has not been initialized!');
  }

  // Syncing tuture.json with tuture.yml.
  const tuture = yaml.safeLoad(fs.readFileSync('tuture.yml'), 'utf8');
  fs.writeFileSync(path.join(tutureRoot, 'tuture.json'), JSON.stringify(tuture));
  signale.success('tuture.json has been synced!');

  try {
    signale.success('Tuture renderer is served on http://localhost:3000.');
    cp.execSync('tuture-renderer');
  } catch (e) {
    errAndExit('tuture-renderer is not available!');
  }
}

/**
 * Delete all Tuture files.
 * @param {Object} options Command-line options
 */
async function destroyTuture(options) {
  if (!ifTutureSuiteExists()) {
    errAndExit('No Tuture tutorial to destroy!');
  }

  const onCancel = () => errAndExit('Aborted!');

  const response = options.force ? { answer: true } : await prompts({
    type: 'confirm',
    name: 'answer',
    message: 'Are you sure?',
    initial: false,
  }, { onCancel });
  if (!response.answer) {
    errAndExit('Aborted!');
  }

  git.removeGitHook();

  const spinner = ora('Deleting Tuture files...').start();
  await removeTutureSuite();
  spinner.stop();
  signale.success('Tuture suite has been destroyed!');
}

exports.initTuture = initTuture;
exports.reloadTuture = reloadTuture;
exports.startRenderer = startRenderer;
exports.destroyTuture = destroyTuture;

exports.handleUnknownCmd = (cmd) => {
  errAndExit(`Unknown command: ${cmd}`);
};
