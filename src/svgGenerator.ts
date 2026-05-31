import type { UserAvatarInfo, PillDimensions } from './types.js';
import { escapeXml } from './utils.js';

const AVATAR_SIZE = 18;
const AVATAR_RADIUS = AVATAR_SIZE / 2;
const OVERLAP = 5;
const PADDING_H = 4;
const PILL_HEIGHT = 20;
const OVERFLOW_BADGE_MIN_WIDTH = 26;

function calcPillWidth(totalSlots: number, hasOverflow: boolean): number {
  const baseWidth = PADDING_H + AVATAR_SIZE + (totalSlots - 1) * (AVATAR_SIZE - OVERLAP) + PADDING_H;
  if (hasOverflow) {
    // Make sure overflow badge has enough room
    return Math.max(baseWidth, OVERFLOW_BADGE_MIN_WIDTH + PADDING_H * 2);
  }
  return Math.max(baseWidth, AVATAR_SIZE + PADDING_H * 2);
}

interface RenderedAvatar {
  clipPath: string;
  body: string;
}

function renderAvatar(user: UserAvatarInfo, index: number, cy: number): RenderedAvatar {
  const cx = PADDING_H + AVATAR_RADIUS + index * (AVATAR_SIZE - OVERLAP);
  const clipId = `u${index}`;
  const fontSize = 6;

  const clipPath = `<clipPath id="${clipId}"><circle cx="${cx}" cy="${cy}" r="${AVATAR_RADIUS - 0.5}"/></clipPath>`;

  const body = [
    // Outer border ring drawn first so it appears beneath the overlapping left avatar
    `<circle cx="${cx}" cy="${cy}" r="${AVATAR_RADIUS + 1}" fill="#1e1e1e"/>`,
    `<circle cx="${cx}" cy="${cy}" r="${AVATAR_RADIUS}" fill="${user.color}"/>`,
    `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central"`,
    ` fill="white" font-size="${fontSize}" font-weight="bold"`,
    ` font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"`,
    ` clip-path="url(#${clipId})"`,
    ` pointer-events="none">${escapeXml(user.initials)}</text>`,
  ].join('');

  return { clipPath, body };
}

function renderOverflow(index: number, count: number, cy: number): string {
  const cx = PADDING_H + AVATAR_RADIUS + index * (AVATAR_SIZE - OVERLAP);
  const label = `+${count}`;

  return [
    `<circle cx="${cx}" cy="${cy}" r="${AVATAR_RADIUS + 1}" fill="#1e1e1e"/>`,
    `<circle cx="${cx}" cy="${cy}" r="${AVATAR_RADIUS}" fill="#3d3d3d"/>`,
    `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central"`,
    ` fill="#cccccc" font-size="6" font-weight="bold"`,
    ` font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"`,
    ` pointer-events="none">${escapeXml(label)}</text>`,
  ].join('');
}

export function generatePillSvg(
  users: UserAvatarInfo[],
  maxVisible: number,
): { svg: string; dimensions: PillDimensions } {
  const visibleUsers = users.slice(0, maxVisible);
  const overflowCount = users.length - maxVisible;
  const showOverflow = overflowCount > 0;

  const totalSlots = visibleUsers.length + (showOverflow ? 1 : 0);
  const pillWidth = calcPillWidth(totalSlots, showOverflow);
  const cy = PILL_HEIGHT / 2;

  const defs: string[] = [];
  const bodies: string[] = [];

  // Pill background
  const pillRx = (PILL_HEIGHT - 2) / 2;
  bodies.push(
    `<rect x="0" y="1" width="${pillWidth}" height="${PILL_HEIGHT - 2}"` +
      ` rx="${pillRx}" fill="#252526" fill-opacity="0.9" stroke="#3d3d3d" stroke-width="0.5"/>`,
  );

  // Draw avatars right-to-left so the left avatar's border ring overlaps the right one
  for (let i = visibleUsers.length - 1; i >= 0; i--) {
    const { clipPath, body } = renderAvatar(visibleUsers[i], i, cy);
    defs.push(clipPath);
    bodies.push(body);
  }

  if (showOverflow) {
    bodies.push(renderOverflow(visibleUsers.length, overflowCount, cy));
  }

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${pillWidth}" height="${PILL_HEIGHT}">`,
    defs.length > 0 ? `<defs>${defs.join('')}</defs>` : '',
    bodies.join(''),
    `</svg>`,
  ].join('');

  return {
    svg,
    dimensions: { width: pillWidth, height: PILL_HEIGHT },
  };
}
