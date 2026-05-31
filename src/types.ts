export interface BranchContributor {
  branchName: string;
  shortBranchName: string;
  authorName: string;
  authorEmail: string;
  lastCommitDate: Date;
}

export interface UserAvatarInfo {
  name: string;
  email: string;
  branchName: string;
  initials: string;
  color: string;
  lastCommitDate: Date;
}

export interface PillDimensions {
  width: number;
  height: number;
}
