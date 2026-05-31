import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import type { BranchContributor } from './types.js';

const execFileAsync = promisify(execFile);

const EXEC_TIMEOUT_MS = 8000;
const BATCH_SIZE = 6;

export async function getRepoRoot(filePath: string): Promise<string | null> {
  const dir = path.dirname(filePath);
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['-C', dir, 'rev-parse', '--show-toplevel'],
      { timeout: EXEC_TIMEOUT_MS },
    );
    return stdout.trim();
  } catch {
    return null;
  }
}

export async function getCurrentBranch(repoRoot: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['-C', repoRoot, 'rev-parse', '--abbrev-ref', 'HEAD'],
      { timeout: EXEC_TIMEOUT_MS },
    );
    return stdout.trim();
  } catch {
    return '';
  }
}

export async function getDefaultRemoteBranch(repoRoot: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['-C', repoRoot, 'symbolic-ref', 'refs/remotes/origin/HEAD'],
      { timeout: EXEC_TIMEOUT_MS },
    );
    // Returns 'refs/remotes/origin/main' — strip the 'refs/remotes/' prefix
    return stdout.trim().replace('refs/remotes/', '');
  } catch {
    // Fall back to checking for common default branch names
    for (const branch of ['origin/main', 'origin/master', 'origin/develop', 'origin/trunk']) {
      try {
        await execFileAsync('git', ['-C', repoRoot, 'rev-parse', '--verify', branch], {
          timeout: 3000,
        });
        return branch;
      } catch {
        continue;
      }
    }
    return 'origin/main';
  }
}

interface RawBranchEntry {
  name: string;
  date: Date;
  authorName: string;
  authorEmail: string;
}

async function getRecentRemoteBranches(
  repoRoot: string,
  cutoffDate: Date,
  maxBranches: number,
): Promise<RawBranchEntry[]> {
  const { stdout } = await execFileAsync(
    'git',
    [
      '-C',
      repoRoot,
      'for-each-ref',
      `--count=${maxBranches}`,
      '--sort=-committerdate',
      '--format=%(refname:short)|%(committerdate:iso8601)|%(committername)|%(committeremail)',
      'refs/remotes/origin/',
    ],
    { timeout: EXEC_TIMEOUT_MS },
  );

  return stdout
    .trim()
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const parts = line.split('|');
      return {
        name: parts[0]?.trim() ?? '',
        date: new Date(parts[1]?.trim() ?? ''),
        authorName: parts[2]?.trim() || 'Unknown',
        authorEmail: parts[3]?.trim() ?? '',
      };
    })
    .filter(
      (b) => b.name && b.name !== 'origin/HEAD' && !isNaN(b.date.getTime()) && b.date >= cutoffDate,
    );
}

async function branchModifiesFile(
  repoRoot: string,
  defaultBranch: string,
  branchName: string,
  normalizedFilePath: string,
): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync(
      'git',
      [
        '-C',
        repoRoot,
        'diff',
        '--name-only',
        `${defaultBranch}...${branchName}`,
        '--',
        normalizedFilePath,
      ],
      { timeout: EXEC_TIMEOUT_MS },
    );
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

export async function getBranchesModifyingFile(
  repoRoot: string,
  relativeFilePath: string,
  daysThreshold: number,
  maxBranches: number,
): Promise<BranchContributor[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysThreshold);

  let rawBranches: RawBranchEntry[];
  try {
    rawBranches = await getRecentRemoteBranches(repoRoot, cutoffDate, maxBranches);
  } catch {
    return [];
  }

  if (rawBranches.length === 0) {
    return [];
  }

  const [defaultBranch, currentBranch] = await Promise.all([
    getDefaultRemoteBranch(repoRoot),
    getCurrentBranch(repoRoot),
  ]);

  // Normalize path separators for git (always forward slashes)
  const normalizedPath = relativeFilePath.replace(/\\/g, '/');

  const branchesToCheck = rawBranches.filter(
    (b) => b.name !== defaultBranch && b.name !== `origin/${currentBranch}`,
  );

  const results: BranchContributor[] = [];
  const seenAuthors = new Set<string>();

  // Process in batches to limit concurrency
  for (let i = 0; i < branchesToCheck.length; i += BATCH_SIZE) {
    const batch = branchesToCheck.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (branch) => {
        const modifies = await branchModifiesFile(repoRoot, defaultBranch, branch.name, normalizedPath);
        return modifies ? branch : null;
      }),
    );

    for (const branch of batchResults) {
      if (!branch) continue;
      // Deduplicate by author email (or name as fallback)
      const dedupeKey = branch.authorEmail || branch.authorName;
      if (!seenAuthors.has(dedupeKey)) {
        seenAuthors.add(dedupeKey);
        results.push({
          branchName: branch.name,
          shortBranchName: branch.name.replace(/^origin\//, ''),
          authorName: branch.authorName,
          authorEmail: branch.authorEmail,
          lastCommitDate: branch.date,
        });
      }
    }
  }

  return results;
}
