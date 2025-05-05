'use client';

import { FormEvent, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '@/components/Navigation';

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
        if (!payload.userName || !payload.email) {
          throw new Error('Invalid token payload');
        }
        setFormData(prev => ({
          ...prev,
          username: payload.userName,
          email: payload.email
        }));
        setIsLoading(false);
      } catch (error) {
        console.error('Error parsing token:', error);
        // refresh token or redirect to login
        fetch('/api/auth/refresh', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          }
        })
        router.push('/login');
      }
    }
  }, [router]);

  const handleSubmit = async (e: FormEvent, type: 'password') => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    try {
      const endpoint = `/api/auth/${type == 'password' ? 'change-password' : type}`;
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
                </div>
              </div>

              {/* Email Section */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Email</h2>
                    <p className="text-gray-500 dark:text-gray-400">{formData.email}</p>
                  </div>
                </div>
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
