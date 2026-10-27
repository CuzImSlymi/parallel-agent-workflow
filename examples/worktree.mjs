// Example for a Node project using local, fast-forward merges. Adapt it to your project.
import { execFileSync } from 'node:child_process'
import { mkdirSync, realpathSync, rmdirSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'

const [action, base, branch, reviewedCommit] = process.argv.slice(2)
const fail = (message) => { throw new Error(message) }
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()

try {
  if (!['start', 'finish'].includes(action) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(branch || '')) {
    fail('Usage: node worktree.mjs start <base> <task> OR finish <base> <task> <reviewed-commit>')
  }

  const root = realpathSync(git(process.cwd(), 'rev-parse', '--show-toplevel'))
  const common = realpathSync(resolve(root, git(root, 'rev-parse', '--git-common-dir')))
  if (!base || base === branch || git(root, 'branch', '--show-current') !== base) {
    fail('Run this from the specified base branch checkout.')
  }

  const parent = join(dirname(root), `${basename(root)}-worktrees`)
  const target = join(parent, branch)

  if (action === 'start') {
    if (reviewedCommit) fail('Start takes only a task name.')
    mkdirSync(parent, { recursive: true })
    git(root, 'worktree', 'add', '-b', branch, target, base)
    console.log(`Worktree: ${target}\nBranch: ${branch}`)
  } else {
    if (!/^[0-9a-f]{40,64}$/.test(reviewedCommit || '')) fail('Provide the full reviewed commit ID.')
    const lock = join(common, 'parallel-agent-workflow.lock')
    mkdirSync(lock)
    try {
      const records = git(root, 'worktree', 'list', '--porcelain', '-z').split('\0\0')
      const record = records.find((item) => {
        const path = item.split('\0').find((line) => line.startsWith('worktree '))?.slice(9)
        return path && realpathSync(path) === realpathSync(target)
      })
      if (!record?.split('\0').includes(`branch refs/heads/${branch}`)) fail('Task worktree or branch does not match.')
      if (git(target, 'rev-parse', 'HEAD') !== reviewedCommit) fail('Task has changed since review.')
      if (git(root, 'status', '--porcelain', '--untracked-files=all')) fail('Base checkout has uncommitted changes.')
      if (git(target, 'status', '--porcelain', '--untracked-files=all', '--ignored')) {
        fail('Task worktree contains uncommitted or ignored files. Preserve them before cleanup.')
      }
      git(root, 'merge', '--ff-only', branch)
      git(root, 'worktree', 'remove', target)
      git(root, 'branch', '-d', branch)
      console.log(`Merged ${branch} into ${base} and removed its worktree.`)
    } finally {
      rmdirSync(lock)
    }
  }
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
