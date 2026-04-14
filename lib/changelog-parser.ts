export type ChangelogSectionKey =
  | 'Added'
  | 'Changed'
  | 'Fixed'
  | 'Deprecated'
  | 'Removed'
  | 'Security';

export interface ChangelogRelease {
  version: string;
  date: string | null;
  sections: Partial<Record<ChangelogSectionKey, string[]>>;
}

/**
 * 解析 CHANGELOG.md（Keep a Changelog 子集合）
 * - 只處理 `## [x.y.z-...] - YYYY-MM-DD` 的 release 區塊
 * - 只處理 `### Added/Changed/Fixed/...` 區塊與 `- ` 清單
 */
export function parseChangelogMarkdown(markdown: string): ChangelogRelease[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');

  const releases: ChangelogRelease[] = [];
  let current: ChangelogRelease | null = null;
  let currentSection: ChangelogSectionKey | null = null;

  const pushCurrent = () => {
    if (!current) return;
    releases.push(current);
    current = null;
    currentSection = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    const releaseMatch = line.match(/^##\s+\[(?<version>[^\]]+)\](?:\s+-\s+(?<date>\d{4}-\d{2}-\d{2}))?\s*$/);
    if (releaseMatch?.groups?.version) {
      const version = releaseMatch.groups.version.trim();
      if (version.toLowerCase() === 'unreleased') {
        pushCurrent();
        continue;
      }
      pushCurrent();
      current = {
        version,
        date: releaseMatch.groups.date ?? null,
        sections: {},
      };
      continue;
    }

    if (!current) continue;

    const sectionMatch = line.match(/^###\s+(?<name>[A-Za-z]+)\s*$/);
    if (sectionMatch?.groups?.name) {
      const name = sectionMatch.groups.name as ChangelogSectionKey;
      const allowed: ChangelogSectionKey[] = [
        'Added',
        'Changed',
        'Fixed',
        'Deprecated',
        'Removed',
        'Security',
      ];
      currentSection = allowed.includes(name) ? name : null;
      continue;
    }

    if (!currentSection) continue;

    const bulletMatch = line.match(/^- (.+)$/);
    if (!bulletMatch) continue;

    const item = bulletMatch[1].trim();
    if (!item) continue;

    const list = current.sections[currentSection] ?? [];
    list.push(item);
    current.sections[currentSection] = list;
  }

  pushCurrent();

  return releases;
}

