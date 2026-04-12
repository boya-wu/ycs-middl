import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Upload, Scale, FileSpreadsheet } from 'lucide-react';

/**
 * 模組入口首頁 - 平台概念層
 * 列出各功能模組，建立中介層平台感
 */
export default function DashboardPage() {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">模組選單</h1>
        <p className="text-muted-foreground mt-1">
          選擇要使用的功能模組
        </p>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5" />
              請款認領
            </CardTitle>
            <CardDescription>
              工時匯入與認領看板，管理時數紀錄並進行請款認領
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <p className="text-sm text-muted-foreground">
              上傳工時 Excel、對應人員與廠區，並在認領看板中將工時認領至專案／任務。
            </p>
          </CardContent>
          <CardFooter className="flex gap-2">
            <Link
              href="/dashboard/upload"
              className={cn(
                'inline-flex h-9 items-center justify-center rounded-md px-3 text-sm font-medium transition-colors',
                'bg-primary text-primary-foreground hover:bg-primary/90'
              )}
            >
              <Upload className="mr-1.5 h-4 w-4" />
              工時匯入
            </Link>
            <Link
              href="/dashboard/billing"
              className={cn(
                'inline-flex h-9 items-center justify-center rounded-md border border-input px-3 text-sm font-medium transition-colors',
                'hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <Scale className="mr-1.5 h-4 w-4" />
              認領看板
            </Link>
          </CardFooter>
        </Card>

        <Card className="flex flex-col border-dashed opacity-75">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-muted-foreground">
              <FileSpreadsheet className="h-5 w-5" />
              Sheets 報表（規劃中）
            </CardTitle>
            <CardDescription>
              透過網頁間接操作 Google Sheets 報表，敬請期待
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <p className="text-sm text-muted-foreground">
              更多中介層功能將陸續上線。
            </p>
          </CardContent>
          <CardFooter>
            <Button variant="secondary" size="sm" disabled>
              即將推出
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
