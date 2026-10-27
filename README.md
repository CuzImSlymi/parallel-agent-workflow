# Parallel Agent Workflow

## What is this for?

This lets you open multiple AI chats on the same project. Each agent creates its own Git worktree and handles the merge when you're finished.

I made this because my chats kept conflicting when they worked on the same project at the same time. The setup is designed to keep token usage low: once the agent has written the project instructions and any helper scripts, future chats can follow them without figuring everything out again.

## How to install

Open your project and copy this prompt into your AI agent:

```text
Read https://raw.githubusercontent.com/CuzImSlymi/parallel-agent-workflow/main/INSTALL.md and follow the instructions.
```

## How to use

Start your chats as usual. Each agent creates its own worktree for its task, so you can work in parallel.

When you're happy with the work and ready to close the chat, say "finish up." The agent merges the work back and cleans up its worktree. If your project uses pull requests, it follows that workflow instead.

Worktrees separate files, but databases and development ports may still be shared.
