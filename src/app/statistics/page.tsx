'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Navigation from '@/components/Navigation';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Line, Pie } from 'react-chartjs-2';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

// Update chart options with specific heights
const lineOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top' as const,
      labels: {
        boxWidth: 12,
        padding: 8
      }
    },
    title: {
      display: true,
      text: 'Monthly Income & Expenses',
      padding: { top: 10, bottom: 10 }
    },
  },
};

const pieOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'right' as const,
      labels: {
        boxWidth: 12,
        padding: 6
      }
    },
    title: {
      display: true,
      text: 'Expense Categories',
      padding: { top: 10, bottom: 10 }
    },
  },
};

// Add these interfaces before the component
interface ChartDataset {
  label?: string;
  data: number[];
  borderColor?: string | string[];
  backgroundColor?: string | string[];
  borderWidth?: number;
}

interface ChartData {
  labels: string[];
  datasets: ChartDataset[];
}

export default function StatisticsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [monthlyData, setMonthlyData] = useState<ChartData | null>(null);
  const [categoryData, setCategoryData] = useState<ChartData | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
    } else {
      fetchStatistics();
    }
  }, [router]);

  const fetchStatistics = async () => {
    try {
      // Fetch monthly data
      const monthlyResponse = await fetch('/api/transactions?groupBy=month', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      // Fetch category data
      const categoryResponse = await fetch('/api/transactions?groupBy=category', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (monthlyResponse.ok && categoryResponse.ok) {
        // For now, using dummy data - replace with actual API response later
        setMonthlyData({
          labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
          datasets: [
            {
              label: 'Income',
              data: [45000, 59000, 80000, 81000, 56000, 75000],
              borderColor: 'rgb(75, 192, 192)',
              backgroundColor: 'rgba(75, 192, 192, 0.5)',
            },
            {
              label: 'Expenses',
              data: [20000, 25000, 35000, 28000, 30000, 32000],
              borderColor: 'rgb(255, 99, 132)',
              backgroundColor: 'rgba(255, 99, 132, 0.5)',
            },
          ],
        });

        setCategoryData({
          labels: ['Food', 'Transport', 'Bills', 'Entertainment', 'Shopping'],
          datasets: [
            {
              data: [12000, 8000, 15000, 5000, 10000],
              backgroundColor: [
                'rgba(255, 99, 132, 0.5)',
                'rgba(54, 162, 235, 0.5)',
                'rgba(255, 206, 86, 0.5)',
                'rgba(75, 192, 192, 0.5)',
                'rgba(153, 102, 255, 0.5)',
              ],
              borderColor: [
                'rgba(255, 99, 132, 1)',
                'rgba(54, 162, 235, 1)',
                'rgba(255, 206, 86, 1)',
                'rgba(75, 192, 192, 1)',
                'rgba(153, 102, 255, 1)',
              ],
              borderWidth: 1,
            },
          ],
        });
      }
    } catch (error) {
      console.error('Error fetching statistics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <>
      <main className="min-h-screen p-4 pt-16 md:p-6 md:pt-20">
        <div className="max-w-screen-xl mx-auto">
          {/* Header */}
          <div className="mb-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Statistics
            </h1>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            {/* Total Income */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg">
              <p className="text-xs text-gray-500 dark:text-gray-400">Total Income</p>
              <h2 className="text-lg font-bold text-green-600 dark:text-green-400">
                Rs. 45,000.00
              </h2>
            </div>

            {/* Total Expenses */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg">
              <p className="text-xs text-gray-500 dark:text-gray-400">Total Expenses</p>
              <h2 className="text-lg font-bold text-red-600 dark:text-red-400">
                Rs. 20,000.00
              </h2>
            </div>

            {/* Net Savings */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg">
              <p className="text-xs text-gray-500 dark:text-gray-400">Net Savings</p>
              <h2 className="text-lg font-bold text-blue-600 dark:text-blue-400">
                Rs. 25,000.00
              </h2>
            </div>
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Monthly Trends Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg">
              <div className="h-[250px]">
                {monthlyData && (
                  <Line options={lineOptions} data={monthlyData} />
                )}
              </div>
            </div>

            {/* Expense Categories Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg">
              <div className="h-[250px]">
                {categoryData && (
                  <Pie options={pieOptions} data={categoryData} />
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
      <Navigation />
    </>
  );
}
