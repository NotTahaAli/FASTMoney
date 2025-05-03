'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Navigation from '@/components/Navigation';
import Image from 'next/image';

interface UserProfile {
  username: string;
  email: string;
  profilePicture?: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');

  const fetchUserProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      // Parse JWT token to get user info
      const [, payloadBase64] = token.split('.');
      const payload = JSON.parse(atob(payloadBase64));
      
      setUserProfile({
        username: payload.Username || payload.username || '',
        email: payload.Email || payload.email || '',
        profilePicture: '/default-avatar.png'
      });
    } catch (error) {
      console.error('Error parsing user data:', error);
      router.push('/login');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
    } else {
      fetchUserProfile();
    }
  }, [router]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleUpdateProfile = async () => {
    if (!imageFile) return;

    const formData = new FormData();
    formData.append('profilePicture', imageFile);

    try {
      const response = await fetch('/api/profile/picture', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      if (response.ok) {
        // Refresh user profile
        fetchUserProfile();
      }
    } catch (error) {
      console.error('Error updating profile picture:', error);
    }
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <>
      <main className="min-h-screen p-4 pt-24 md:p-8 md:pt-28">
        <div className="max-w-screen-xl mx-auto">
          {/* Profile Card */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              Profile
            </h1>

            {/* Info Boxes Grid */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              {/* Username Box */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Username
                </label>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {userProfile?.username}
                </p>
              </div>

              {/* Email Box */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Email
                </label>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {userProfile?.email}
                </p>
              </div>
            </div>

            {/* Profile Picture Section */}
            <div className="flex flex-col items-center space-y-4">
              <div className="relative w-32 h-32 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700">
                <Image
                  src={previewUrl || (userProfile?.profilePicture || '/default-avatar.png')}
                  alt="Profile"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="flex flex-col items-center space-y-2">
                <label
                  htmlFor="profile-picture"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700"
                >
                  Change Picture
                </label>
                <input
                  id="profile-picture"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageChange}
                />
                {imageFile && (
                  <button
                    onClick={handleUpdateProfile}
                    className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                  >
                    Save Picture
                  </button>
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
