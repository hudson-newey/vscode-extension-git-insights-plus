import * as vscode from 'vscode';
import { updateDecoration, disposeAll } from './decorationProvider.js';

let refreshTimer: ReturnType<typeof setInterval> | undefined;

export function activate(context: vscode.ExtensionContext): void {
  let pendingUpdate: ReturnType<typeof setTimeout> | undefined;

  function scheduleUpdate(delayMs = 500): void {
    if (pendingUpdate !== undefined) {
      clearTimeout(pendingUpdate);
    }
    pendingUpdate = setTimeout(async () => {
      pendingUpdate = undefined;
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        await updateDecoration(editor);
      }
    }, delayMs);
  }

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() => scheduleUpdate()),
    vscode.workspace.onDidSaveTextDocument(() => scheduleUpdate()),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('gitInsightsPlus.refresh', async () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        await vscode.window.withProgress(
          { location: vscode.ProgressLocation.Window, title: 'Git Insights Plus: Refreshing…' },
          () => updateDecoration(editor),
        );
      }
    }),
  );

  // Periodic background refresh
  const intervalMinutes = vscode.workspace
    .getConfiguration('gitInsightsPlus')
    .get<number>('refreshIntervalMinutes', 5);
  refreshTimer = setInterval(() => scheduleUpdate(0), intervalMinutes * 60 * 1000);

  context.subscriptions.push({
    dispose() {
      disposeAll();
      if (refreshTimer !== undefined) clearInterval(refreshTimer);
      if (pendingUpdate !== undefined) clearTimeout(pendingUpdate);
    },
  });

  // Run initial decoration after VS Code has fully settled
  scheduleUpdate(1500);
}

export function deactivate(): void {
  disposeAll();
  if (refreshTimer !== undefined) clearInterval(refreshTimer);
}
