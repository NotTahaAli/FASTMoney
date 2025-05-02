'use client';

import Navigation from "@/components/Navigation";
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Check if token exists in cookies or localStorage
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
    }
  }, [router]);

  return (
    <>
      <main className="min-h-screen p-4 pt-24 md:p-8 md:pt-28">
        <div className="max-w-screen-xl mx-auto">
          {/* Balance Card */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg mb-6">
            <p className="text-gray-500 dark:text-gray-400 text-sm">Total Balance</p>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
              Rs. 25,000.00
            </h2>
          </div>
          
          {/* Recent Transactions - Placeholder */}
          <section className="mt-8">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Recent Transactions
            </h3>
            <div className="space-y-4">
              {/* We'll add transaction items here later */}
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                <p className="text-gray-900 dark:text-white">No transactions yet</p>
              </div>
            </div>
          </section>
        </div>
      </main>
      <Navigation />
    </>
  );
}
