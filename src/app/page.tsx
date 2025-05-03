'use client';

import Navigation from "@/components/Navigation";
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function Home() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
      } else {
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error checking authentication:', error);
      router.push('/login');
    }
  }, [router]);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <>
      <main className="min-h-screen p-4 pt-24 md:p-8 md:pt-28 cursor-default">
        <div className="max-w-screen-xl mx-auto">
          {/* App Title */}
          <div className="text-center mb-8 cursor-default">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
              FASTMoney
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              Finance Management in your Pocket
            </p>
          </div>

          {/* Balance Card */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg mb-6 cursor-pointer-area hover:shadow-xl transition-shadow">
            <p className="text-gray-500 dark:text-gray-400 text-sm">Total Balance</p>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
              Rs. 25,000.00
            </h2>
          </div>
          
          {/* Recent Transactions - Made Smaller */}
          <section className="mt-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 cursor-default">
              Recent Transactions
            </h3>
            <div className="space-y-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow min-h-[250px] flex items-center justify-center cursor-pointer-area hover:shadow-xl transition-shadow">
                <p className="text-gray-500 dark:text-gray-400 text-lg">No transactions yet</p>
              </div>
            </div>
          </section>
        </div>
      </main>
      <Navigation />
    </>
  );
}
