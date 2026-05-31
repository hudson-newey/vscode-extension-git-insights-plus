import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import { getBranchesModifyingFile, getRepoRoot } from './gitService.js';
import { generatePillSvg } from './svgGenerator.js';
import { getInitials, getColorForString, escapeMarkdown } from './utils.js';
import type { BranchContributor, UserAvatarInfo } from './types.js';

interface EditorState {
  decorationType: vscode.TextEditorDecorationType;
  svgPath: string;
}

const editorStates = new Map<string, EditorState>();

function getConfig() {
  const cfg = vscode.workspace.getConfiguration('gitInsightsPlus');
  return {
    daysThreshold: cfg.get<number>('activeDaysThreshold', 3),
    maxVisible: cfg.get<number>('maxVisibleAvatars', 3),
    maxBranches: cfg.get<number>('maxBranchesToCheck', 50),
  };
}

export async function updateDecoration(editor: vscode.TextEditor): Promise<void> {
  const { document } = editor;
  if (document.uri.scheme !== 'file') {
    return;
  }

  const filePath = document.uri.fsPath;
  const repoRoot = await getRepoRoot(filePath);
  if (!repoRoot) {
    clearDecoration(editor);
    return;
  }

  const { daysThreshold, maxVisible, maxBranches } = getConfig();
  const relativeFilePath = path.relative(repoRoot, filePath);

  let contributors: BranchContributor[];
  try {
    contributors = await getBranchesModifyingFile(
      repoRoot,
      relativeFilePath,
      daysThreshold,
      maxBranches,
    );
  } catch {
    clearDecoration(editor);
    return;
  }

  if (contributors.length === 0) {
    clearDecoration(editor);
    return;
  }

  const users: UserAvatarInfo[] = contributors.map((c) => ({
    name: c.authorName,
    email: c.authorEmail,
    branchName: c.shortBranchName,
    initials: getInitials(c.authorName),
    color: getColorForString(c.authorEmail || c.authorName),
    lastCommitDate: c.lastCommitDate,
  }));

  const { svg: svgContent, dimensions } = generatePillSvg(users, maxVisible);

  // Use content hash in filename so VS Code doesn't cache a stale version
  const contentHash = crypto.createHash('md5').update(svgContent).digest('hex').slice(0, 12);
  const svgPath = path.join(os.tmpdir(), `git-insights-pill-${contentHash}.svg`);
  await fs.writeFile(svgPath, svgContent, 'utf8');

  const editorKey = document.uri.toString();
  clearDecoration(editor);

  const decorationType = vscode.window.createTextEditorDecorationType({
    after: {
      contentIconPath: vscode.Uri.file(svgPath),
      width: `${dimensions.width}px`,
      height: `${dimensions.height}px`,
      margin: '0 2px 0 10px',
    },
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
  });

  editorStates.set(editorKey, { decorationType, svgPath });

  // Anchor the pill at the end of the first line so it appears in the top-right
  // area of the editor content (similar to git blame annotations)
  const firstLine = document.lineAt(0);
  const endPos = new vscode.Position(0, firstLine.text.length);
  const range = new vscode.Range(endPos, endPos);

  editor.setDecorations(decorationType, [{ range, hoverMessage: buildHoverMessage(contributors) }]);
}

function clearDecoration(editor: vscode.TextEditor): void {
  const key = editor.document.uri.toString();
  const state = editorStates.get(key);
  if (state) {
    state.decorationType.dispose();
    editorStates.delete(key);
    fs.unlink(state.svgPath).catch(() => {
      /* temp file cleanup, best-effort */
    });
  }
}

function buildHoverMessage(contributors: BranchContributor[]): vscode.MarkdownString {
  const md = new vscode.MarkdownString('', true);
  md.isTrusted = true;

  md.appendMarkdown('### ⚠️ Active branches modifying this file\n\n');
  md.appendMarkdown(
    'The following collaborators have open branches that modify this file and may cause merge conflicts:\n\n',
  );

  for (const c of contributors) {
    const daysAgo = Math.floor(
      (Date.now() - c.lastCommitDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    const timeStr =
      daysAgo === 0 ? 'today' : daysAgo === 1 ? 'yesterday' : `${daysAgo} days ago`;

    md.appendMarkdown(
      `- **${escapeMarkdown(c.authorName)}** — \`${escapeMarkdown(c.shortBranchName)}\` — updated ${timeStr}\n`,
    );
  }

  md.appendMarkdown('\n---\n*Coordinate with these collaborators to avoid merge conflicts.*');
  return md;
}

export function disposeAll(): void {
  for (const state of editorStates.values()) {
    state.decorationType.dispose();
    fs.unlink(state.svgPath).catch(() => {
      /* best-effort cleanup */
    });
  }
  editorStates.clear();
}
