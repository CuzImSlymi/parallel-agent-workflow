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

Test any helper you created, then ask this question before starting the optional test:

> Want me to test the setup with a subagent, commit it, and push it to the remote?
>
> - Yes, run the optional test, commit, and push
> - No, keep the setup local

The yes option explicitly authorizes all three steps. If the user selects it, test the setup, commit the setup changes, and push through the project's normal process without asking again. If the user chooses otherwise, follow their answer. If an instruction file is ignored, explain that it must be tracked and ask before changing the ignore rule or adding it explicitly. New local worktrees need the setup committed to the base; pushing shares it with other checkouts.

## Optional setup check

If the user agrees, create a temporary clone, copy the setup changes into it, and commit them there so its worktrees can discover the instructions. Give a fresh subagent a small task, such as a script that prints `Hello`, without explaining the workflow. Review whether it used its own worktree, found the commands it needed, and left the work ready for review. Test finishing in the temporary clone, not the real project. Fix observed gaps and retry once if needed. Clean up only the test's own files. If subagents are unavailable, suggest testing in a new chat instead.

After testing, include instruction fixes in the setup commit before pushing. Report any unfinished steps or cleanup.
