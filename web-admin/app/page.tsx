'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
export default function RootPage() {
  const router = useRouter();
  useEffect(() => {
    if (localStorage.getItem('token')) router.push('/dashboard');
    else router.push('/login');
  }, [router]);
  return <div className="min-h-screen flex items-center justify-center bg-gray-50">Loading...</div>;
}
