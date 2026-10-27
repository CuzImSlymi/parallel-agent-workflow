import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

function fixture(t) {
  const temporaryRoot = realpathSync(tmpdir())
  const directory = mkdtempSync(join(temporaryRoot, 'parallel-agent-workflow-'))
  const repository = join(directory, 'project with spaces')
  mkdirSync(repository)
  t.after(() => {
    assert.equal(dirname(realpathSync(directory)), temporaryRoot)
    assert.ok(directory.startsWith(join(temporaryRoot, 'parallel-agent-workflow-')))
    rmSync(directory, { recursive: true, force: true, maxRetries: 3 })
  })

  const environment = { ...process.env, GIT_CONFIG_NOSYSTEM: '1' }
  for (const key of Object.keys(environment)) {
    if (key.startsWith('GIT_') && key !== 'GIT_CONFIG_NOSYSTEM') delete environment[key]
  }
  environment.GIT_CONFIG_GLOBAL = process.platform === 'win32' ? 'NUL' : '/dev/null'

  function git(cwd, args, success = true) {
    const result = spawnSync('git', args, { cwd, env: environment, encoding: 'utf8' })
    assert.ifError(result.error)
    if (success) assert.equal(result.status, 0, result.stderr || result.stdout)
    else assert.notEqual(result.status, 0, 'Expected Git to refuse the operation')
    return result.stdout.trim()
  }

  function commit(cwd, file, text) {
    writeFileSync(join(cwd, file), text)
    git(cwd, ['add', '--', file])
    git(cwd, ['commit', '-m', `Add ${file}`])
    return git(cwd, ['rev-parse', 'HEAD'])
  }

  git(repository, ['init', '-b', 'trunk'])
  git(repository, ['config', 'user.name', 'Workflow Test'])
  git(repository, ['config', 'user.email', 'workflow-test@example.invalid'])
  git(repository, ['config', 'commit.gpgsign', 'false'])
  git(repository, ['config', 'core.hooksPath', join(directory, 'no-hooks')])
  commit(repository, 'README.md', 'Initial project\n')
  return { directory, repository, git, commit, environment }
}

test('example helper isolates and finishes a reviewed task without deleting ignored data', (t) => {
  const { repository, git, commit, environment } = fixture(t)
  const example = new URL('../examples/worktree.mjs', import.meta.url)
  const run = (...args) => spawnSync(process.execPath, [fileURLToPath(example), ...args], {
    cwd: repository, env: environment, encoding: 'utf8',
  })
  commit(repository, '.gitignore', 'private.txt\n')
  const start = run('start', 'trunk', 'test-task')
  assert.equal(start.status, 0, start.stderr)
  const task = join(dirname(repository), `${basename(repository)}-worktrees`, 'test-task')
  const reviewed = commit(task, 'hello.txt', 'Hello\n')
  writeFileSync(join(task, 'private.txt'), 'Keep me\n')
  assert.notEqual(run('finish', 'trunk', 'test-task', reviewed).status, 0)
  assert.equal(readFileSync(join(task, 'private.txt'), 'utf8'), 'Keep me\n')
  rmSync(join(task, 'private.txt'))
  assert.notEqual(run('finish', 'trunk', 'test-task', '0'.repeat(40)).status, 0)
  const lock = join(realpathSync(resolve(repository, git(repository, ['rev-parse', '--git-common-dir']))), 'parallel-agent-workflow.lock')
  mkdirSync(lock)
  assert.notEqual(run('finish', 'trunk', 'test-task', reviewed).status, 0)
  rmSync(lock, { recursive: true })
  const finish = run('finish', 'trunk', 'test-task', reviewed)
  assert.equal(finish.status, 0, finish.stderr)
  assert.equal(readFileSync(join(repository, 'hello.txt'), 'utf8'), 'Hello\n')
  git(repository, ['show-ref', '--verify', 'refs/heads/test-task'], false)
})

test('two worktrees keep edits, staging, and commits separate', (t) => {
  const { directory, repository, git, commit } = fixture(t)
  const first = join(directory, 'first task')
  const second = join(directory, 'second task')
  git(repository, ['worktree', 'add', '-b', 'task/hello', first, 'trunk'])
  git(repository, ['worktree', 'add', '-b', 'task/parallel', second, 'trunk'])
  writeFileSync(join(first, 'hello.txt'), 'Hello\n')
  git(first, ['add', '--', 'hello.txt'])
  assert.match(git(first, ['status', '--porcelain']), /A\s+hello\.txt/)
  assert.equal(git(second, ['status', '--porcelain']), '')
  assert.equal(git(repository, ['status', '--porcelain']), '')
  git(first, ['commit', '-m', 'Add hello'])
  commit(second, 'parallel.txt', 'Parallel\n')
  assert.notEqual(git(first, ['rev-parse', 'HEAD']), git(second, ['rev-parse', 'HEAD']))
  git(repository, ['worktree', 'add', join(directory, 'collision'), 'task/hello'], false)
  assert.equal(git(repository, ['branch', '--show-current']), 'trunk')
})

test('a moved base refuses fast-forward until the task is reconciled', (t) => {
  const { directory, repository, git, commit } = fixture(t)
  const first = join(directory, 'first')
  const second = join(directory, 'second')
  git(repository, ['worktree', 'add', '-b', 'first', first, 'trunk'])
  git(repository, ['worktree', 'add', '-b', 'second', second, 'trunk'])
  const firstCommit = commit(first, 'hello.txt', 'Hello\n')
  commit(second, 'parallel.txt', 'Parallel\n')
  git(repository, ['merge', '--ff-only', 'first'])
  git(repository, ['merge', '--ff-only', 'second'], false)
  assert.equal(git(repository, ['rev-parse', 'HEAD']), firstCommit)
  git(second, ['rebase', 'trunk'])
  git(repository, ['merge', '--ff-only', 'second'])
  assert.equal(readFileSync(join(repository, 'hello.txt'), 'utf8'), 'Hello\n')
  assert.equal(readFileSync(join(repository, 'parallel.txt'), 'utf8'), 'Parallel\n')
  git(repository, ['merge-base', '--is-ancestor', 'first', 'trunk'])
  git(repository, ['merge-base', '--is-ancestor', 'second', 'trunk'])
  git(repository, ['worktree', 'remove', first])
  git(repository, ['worktree', 'remove', second])
  git(repository, ['branch', '-d', 'first', 'second'])
})

test('all worktrees share an integration lock and creation is exclusive', (t) => {
  const { directory, repository, git } = fixture(t)
  const task = join(directory, 'task')
  git(repository, ['worktree', 'add', '-b', 'task', task, 'trunk'])
  const common = (cwd) => realpathSync(resolve(cwd, git(cwd, ['rev-parse', '--git-common-dir'])))
  assert.equal(common(repository), common(task))
  const lock = join(common(task), 'parallel-agent-workflow-integration.lock')
  mkdirSync(lock)
  assert.throws(() => mkdirSync(join(common(repository), 'parallel-agent-workflow-integration.lock')), { code: 'EEXIST' })
  rmSync(lock, { recursive: true })
  mkdirSync(lock)
  rmSync(lock, { recursive: true })
})

test('cleanup must inspect ignored data separately from clean Git status', (t) => {
  const { directory, repository, git, commit } = fixture(t)
  commit(repository, '.gitignore', 'local-data/\n')
  const task = join(directory, 'task')
  git(repository, ['worktree', 'add', '-b', 'task', task, 'trunk'])
  writeFileSync(join(task, 'untracked.txt'), 'Keep me\n')
  git(repository, ['worktree', 'remove', task], false)
  rmSync(join(task, 'untracked.txt'))
  mkdirSync(join(task, 'local-data'))
  writeFileSync(join(task, 'local-data', 'database.txt'), 'Irreplaceable data\n')
  assert.equal(git(task, ['status', '--porcelain']), '')
  assert.match(git(task, ['ls-files', '--others', '--ignored', '--exclude-standard', '-z']), /local-data\/database\.txt\0/)
  assert.equal(readFileSync(join(task, 'local-data', 'database.txt'), 'utf8'), 'Irreplaceable data\n')
  // This fixture owns the data; real cleanup must preserve unknown ignored files.
  rmSync(join(task, 'local-data', 'database.txt'))
  rmSync(join(task, 'local-data'), { recursive: true })
  git(repository, ['worktree', 'remove', task])
})
