import { readFileSync } from 'fs';
import path from 'path';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { parseChangelogMarkdown } from '@/lib/changelog-parser';
import { cn } from '@/lib/utils';

function getChangelogMarkdown(): string {
  const filePath = path.join(process.cwd(), 'CHANGELOG.md');
  return readFileSync(filePath, 'utf-8');
}

function toAnchorId(version: string) {
  return `v-${version.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
}

function sectionLabelToTitle(label: string) {
  switch (label) {
    case 'Added':
      return '新增';
    case 'Changed':
      return '變更';
    case 'Fixed':
      return '修正';
    case 'Deprecated':
      return '棄用';
    case 'Removed':
      return '移除';
    case 'Security':
      return '安全性';
    default:
      return label;
  }
}

export default function ChangelogPage() {
  const markdown = getChangelogMarkdown();
  const releases = parseChangelogMarkdown(markdown);
  const currentVersion = process.env.NEXT_PUBLIC_APP_VERSION ?? null;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="container mx-auto flex items-center justify-between gap-3 p-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">版本更新內容</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              以 CHANGELOG.md 為唯一資料來源，網站會同步顯示最新更新。
            </p>
          </div>
          <div className="flex items-center gap-2">
            {currentVersion && (
              <Badge variant="secondary" className="font-mono">
                v{currentVersion}
              </Badge>
            )}
            <Link
              href="/dashboard"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              返回平台
            </Link>
          </div>
        </div>
      </div>

      <div className="container mx-auto grid gap-6 p-6 lg:grid-cols-[280px_1fr]">
        <aside className="lg:sticky lg:top-6 lg:h-[calc(100vh-6rem)] lg:overflow-auto">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">版本列表</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {releases.map((r) => (
                <a
                  key={r.version}
                  href={`#${toAnchorId(r.version)}`}
                  className={cn(
                    'block rounded-md px-3 py-2 text-sm transition-colors',
                    'hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{r.version}</span>
                    {r.date && (
                      <span className="text-xs text-muted-foreground">
                        {r.date}
                      </span>
                    )}
                  </div>
                </a>
              ))}
            </CardContent>
          </Card>
        </aside>

        <main className="space-y-6">
          {releases.map((r) => {
            const sectionEntries = Object.entries(r.sections).filter(
              ([, items]) => items && items.length > 0
            );

            return (
              <Card key={r.version} id={toAnchorId(r.version)}>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">v{r.version}</CardTitle>
                      {currentVersion === r.version && (
                        <Badge className="font-mono">目前版本</Badge>
                      )}
                    </div>
                    {r.date && (
                      <span className="text-sm text-muted-foreground">
                        {r.date}
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  {sectionEntries.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      此版本尚未整理更新內容。
                    </p>
                  ) : (
                    sectionEntries.map(([section, items]) => (
                      <div key={section}>
                        <h3 className="text-sm font-semibold">
                          {sectionLabelToTitle(section)}
                        </h3>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                          {(items ?? []).map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            );
          })}
        </main>
      </div>
    </div>
  );
}

