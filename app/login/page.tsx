import { LoginForm } from './login-form';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next =
    typeof params.next === 'string'
      ? params.next
      : Array.isArray(params.next)
        ? params.next[0] ?? '/dashboard/billing'
        : '/dashboard/billing';

  return <LoginForm next={next} />;
}
