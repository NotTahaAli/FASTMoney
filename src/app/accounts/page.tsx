'use client';

import { FormEvent, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '@/components/Navigation';
import Link from 'next/link';

interface AccountSettingsForm {
  username: string;
  email: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export default function AccountSettings() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [activeForm, setActiveForm] = useState<'username' | 'email' | 'password' | null>(null);
  const [formData, setFormData] = useState<AccountSettingsForm>({
    username: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
    } else {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setFormData(prev => ({
          ...prev,
          username: payload.Username || payload.username || '',
          email: payload.Email || payload.email || ''
        }));
        setIsLoading(false);
      } catch (error) {
        console.error('Error parsing token:', error);
        router.push('/login');
      }
    }
  }, [router]);

  const handleSubmit = async (e: FormEvent, type: 'username' | 'email' | 'password') => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    try {
      const endpoint = `/api/auth/${type}`;
      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(
          type === 'password' 
            ? { 
                currentPassword: formData.currentPassword,
                newPassword: formData.newPassword 
              }
            : { [type]: formData[type] }
        ),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to update ${type}`);
      }

      setMessage({ type: 'success', text: `${type} updated successfully` });
      setActiveForm(null);
      
      // Update token if provided
      if (data.token) {
        localStorage.setItem('token', data.token);
      }
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : `Failed to update ${type}` 
      });
    }
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <>
      <main className="min-h-screen p-4 pt-24 md:p-8 md:pt-28">
        <div className="max-w-screen-xl mx-auto">
          <div className="max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              Account Settings
            </h1>

            <div className="space-y-6">
              {/* Username Section */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Username</h2>
                    <p className="text-gray-500 dark:text-gray-400">{formData.username}</p>
                  </div>
                  <button
                    onClick={() => setActiveForm(activeForm === 'username' ? null : 'username')}
                    className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
                  >
                    Change
                  </button>
                </div>
                {activeForm === 'username' && (
                  <form onSubmit={(e) => handleSubmit(e, 'username')} className="space-y-4">
                    <input
                      type="text"
                      value={formData.username}
                      onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg dark:border-gray-700 dark:bg-gray-700 dark:text-white"
                      placeholder="New username"
                      required
                    />
                    <button
                      type="submit"
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Update Username
                    </button>
                  </form>
                )}
              </div>

              {/* Email Section */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Email</h2>
                    <p className="text-gray-500 dark:text-gray-400">{formData.email}</p>
                  </div>
                  <button
                    onClick={() => setActiveForm(activeForm === 'email' ? null : 'email')}
                    className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
                  >
                    Change
                  </button>
                </div>
                {activeForm === 'email' && (
                  <form onSubmit={(e) => handleSubmit(e, 'email')} className="space-y-4">
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg dark:border-gray-700 dark:bg-gray-700 dark:text-white"
                      placeholder="New email"
                      required
                    />
                    <button
                      type="submit"
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Update Email
                    </button>
                  </form>
                )}
              </div>

              {/* Password Section */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Password</h2>
                    <p className="text-gray-500 dark:text-gray-400">••••••••</p>
                  </div>
                  <button
                    onClick={() => setActiveForm(activeForm === 'password' ? null : 'password')}
                    className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
                  >
                    Change
                  </button>
                </div>
                {activeForm === 'password' && (
                  <form onSubmit={(e) => handleSubmit(e, 'password')} className="space-y-4">
                    <input
                      type="password"
                      value={formData.currentPassword}
                      onChange={(e) => setFormData(prev => ({ ...prev, currentPassword: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg dark:border-gray-700 dark:bg-gray-700 dark:text-white"
                      placeholder="Current password"
                      required
                    />
                    <input
                      type="password"
                      value={formData.newPassword}
                      onChange={(e) => setFormData(prev => ({ ...prev, newPassword: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg dark:border-gray-700 dark:bg-gray-700 dark:text-white"
                      placeholder="New password"
                      required
                    />
                    <button
                      type="submit"
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Update Password
                    </button>
                  </form>
                )}
                <div className="mt-4 text-center">
                  <Link
                    href="/forgot-password"
                    className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                  >
                    Forgot your password?
                  </Link>
                </div>
              </div>

              {/* Message Display */}
              {message.text && (
                <div className={`p-4 rounded-lg ${
                  message.type === 'success' 
                    ? 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                }`}>
                  {message.text}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <Navigation />
    </>
  );
}
