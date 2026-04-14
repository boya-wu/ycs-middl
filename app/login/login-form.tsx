'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { loginByEmployeeNo } from '@/actions/auth/login';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { LogIn } from 'lucide-react';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      <LogIn className="mr-2 h-4 w-4" />
      {pending ? '登入中…' : '登入'}
    </Button>
  );
}

export function LoginForm({ next }: { next: string }) {
  const [state, formAction] = useFormState(loginByEmployeeNo, null);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">YCS 工時系統</CardTitle>
          <CardDescription>請輸入工號登入</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="next" value={next} />
            <div className="space-y-2">
              <Label htmlFor="employee_no">YCS工號</Label>
              <Input
                id="employee_no"
                name="employee_no"
                placeholder="例如 10101209"
                autoFocus
                autoComplete="off"
                required
              />
            </div>
            {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
            <SubmitButton />
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

