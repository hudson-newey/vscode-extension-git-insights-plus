const AVATAR_COLORS = [
  '#1f6feb',
  '#388bfd',
  '#3fb950',
  '#f0883e',
  '#d29922',
  '#bc8cff',
  '#ff7b72',
  '#79c0ff',
  '#56d364',
  '#e3b341',
];

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter((p) => p.length > 0);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  if (parts.length === 1 && parts[0].length > 0) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return '??';
}

export function getColorForString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function escapeMarkdown(str: string): string {
  return str.replace(/[\\`*_{}[\]()#+\-.!|]/g, '\\$&');
}
