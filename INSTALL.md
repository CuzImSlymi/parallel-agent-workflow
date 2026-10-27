# Set up Parallel Agent Workflow

Set up this project so the user can work in multiple coding chats at once without handling Git manually.

## 1. Inspect the project

Check `git status`, the current branch, existing worktrees (`git worktree list`), and the project's agent instructions, setup, and worktree tools. Identify the base branch and how the project normally merges work. Preserve existing instructions and uncommitted changes. If a needed choice is unclear, ask the user.

## 2. Offer helper commands

If the project already has suitable worktree tools, reuse them. Otherwise ask: "Want me to add small commands to create and finish task worktrees?"

For example, a pnpm project could offer `pnpm wt:new <branch>` to create a worktree and `pnpm wt:done <branch>` to merge and clean up an approved task. If useful, read this [example helper](https://github.com/CuzImSlymi/parallel-agent-workflow/blob/main/examples/worktree.mjs). Adapt its names, language, and setup to the project's stack and merge process. Agree with the user on any environment files, dependencies, or shared resources the helpers should set up.

If the user agrees, create only the helpers the project needs, include checks that protect existing work during creation and cleanup, coordinate concurrent merges, and add a runnable test for non-trivial logic. Preserve ignored local data. If they decline, use Git directly. Do not add a runtime or package manager just for the helpers.

## 3. Add the workflow

Update the instruction file this coding agent reads, such as `AGENTS.md`. Keep the existing content and update an existing workflow section rather than duplicating it. Make sure future chats and new worktrees can read the instructions.

Use the following as an example, not a file to copy verbatim. Replace the bracketed details with the project's actual branch, commands, checks, and setup; omit anything that does not apply. Adapt the finish step for projects that use pull requests.

```markdown
<!-- Existing project instructions stay here. -->

## Parallel work

- For every new feature or fix, create a task branch and worktree from [base branch] using [project command or Git]. Do all work, checks, and commits in that worktree. Continue using it for follow-up requests on the same task.
- Set up the worktree with [project-specific setup]. Use separate development ports and follow [project rules for shared databases, media, and other resources].
- Run [project checks] and show the result for review.
- When the user says "finish up," "looks good," or otherwise approves the finished work, merge it into [base branch], remove the worktree, and delete the task branch. If they request more changes, make those first.
- Integrate one task at a time using [project coordination or a shared lock]. Confirm the task branch still points to the reviewed commit. Check the worktree and working states; reconcile changes if the base moved. Preserve uncommitted work and ignored local data. Stop if conflicts or cleanup are unsafe.
```

Use the selected helper commands or Git directly in the instructions. Respect existing project rules, including rules for publishing. Worktrees do not isolate shared databases, ports, or other external resources.

## 4. Check the setup

Test any helper you created, then ask:

> Want me to commit the setup, test it with a subagent, and push it to the remote? Committing makes it available to new local worktrees; pushing shares it with other checkouts. You can choose which steps you want.

Follow the user's choices and the project's normal process. Commit only the setup changes. If an instruction file is ignored, explain that it must be tracked and ask before changing the ignore rule or adding it explicitly. If the setup is not committed to the base, explain that new worktrees will not inherit it and the fresh-worktree test cannot run yet.

## Optional setup check

If the user agrees, create a temporary base at the current base commit and give a fresh subagent a small task, such as a script that prints `Hello`. Let it discover the installed instructions rather than explaining the workflow in the task. Review whether it used its own worktree, found the commands it needed, and left the work ready for review. For the finish test, explicitly tell it to use the temporary base and its checkout instead of the real base. Fix observed gaps and retry once if needed. Clean up only the test's own worktrees and branches. If subagents are unavailable, suggest testing in a new chat instead.

After testing, commit any approved instruction fixes before pushing, if the user chose to push. Report any unfinished steps or cleanup.
