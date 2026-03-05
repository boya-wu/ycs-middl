import { redirect } from 'next/navigation';

/**
 * 根頁面 - 重定向到模組入口首頁
 */
export default function HomePage() {
  redirect('/dashboard');
}
