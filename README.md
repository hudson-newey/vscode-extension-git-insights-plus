# Git Insights Plus

A VS Code extension that reduces merge conflicts in large teams by surfacing **who else has an active branch that modifies the file you're currently editing**.

## How it works

When you open a file that is tracked by git, the extension:

1. Queries all remote branches on `origin` that were updated within the last **3 days** (configurable).
2. Checks each branch to see if it has made changes to the current file (compared to the default branch).
3. Renders a **pill icon** at the end of the first line of the editor, showing avatar circles for each collaborator.

The pill respects these rules:
- Only shows users whose branches were updated within the threshold window (default: 3 days).
- Shows at most **3 avatars** (configurable). If there are more, the fourth slot shows `+N` (e.g., `+2`).
- **De-duplicates** by author — each person only appears once, even if they have multiple active branches modifying the file.
- Hovering the pill shows a full list of collaborators, their branch names, and when each branch was last updated.

## Requirements

- `git` must be available on `PATH`.
- The file must be inside a git repository with a configured `origin` remote.
- Run `git fetch origin --prune` to ensure local remote-tracking refs are up to date. The extension works with **locally cached** remote refs and does **not** auto-fetch.

## Settings

| Setting | Default | Description |
|---|---|---|
| `gitInsightsPlus.activeDaysThreshold` | `3` | Days before a branch is considered stale and hidden. |
| `gitInsightsPlus.maxVisibleAvatars` | `3` | Max avatars shown before the `+N` overflow indicator. |
| `gitInsightsPlus.refreshIntervalMinutes` | `5` | Auto-refresh interval in minutes. |
| `gitInsightsPlus.maxBranchesToCheck` | `50` | Maximum remote branches to scan per refresh. |

## Commands

| Command | Description |
|---|---|
| **Git Insights Plus: Refresh Active Branches** | Manually re-scan branches for the current file. Also accessible via the `⟳` icon in the editor title bar. |

## Development

```bash
npm install
npm run watch       # incremental TypeScript compilation
# Press F5 in VS Code to launch the Extension Development Host
```

To package:
```bash
npm install -g @vscode/vsce
vsce package
```
