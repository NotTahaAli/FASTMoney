'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Navigation from '@/components/Navigation';

interface Friend {
  userId: number;
  username: string;
  createdOn: string;
}

interface FriendRequest {
  userId: number;
  username: string;
  requestedOn: string;
}

export default function FriendsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [newFriendIdentifier, setNewFriendIdentifier] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [friendToUnfriend, setFriendToUnfriend] = useState<Friend | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
    } else {
      fetchFriends();
      fetchFriendRequests();
    }
  }, [router]);

  const fetchFriends = async () => {
    try {
      const response = await fetch('/api/friends', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setFriends(data);
      }
    } catch (error) {
      console.error('Error fetching friends:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchFriendRequests = async () => {
    try {
      const response = await fetch('/api/friend-requests', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setFriendRequests(data);
      }
    } catch (error) {
      console.error('Error fetching friend requests:', error);
    }
  };

  const sendFriendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage('');

    try {
      const response = await fetch('/api/friend-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ friendIdentifier: newFriendIdentifier })
      });

      if (response.ok) {
        setSuccessMessage('Friend request sent successfully!');
        setNewFriendIdentifier('');
      } else {
        const data = await response.json();
        console.error('Failed to send friend request:', data.error);
      }
    } catch (error) {
      console.error('Failed to send friend request:', error);
    }
  };

  const handleFriendRequest = async (userId: number, action: 'accept' | 'reject') => {
    try {
      const response = await fetch(`/api/friend-requests/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ action })
      });

      if (response.ok) {
        fetchFriendRequests();
        if (action === 'accept') {
          fetchFriends();
        }
      }
    } catch (error) {
      console.error('Error handling friend request:', error);
    }
  };

  const handleUnfriend = async (friend: Friend) => {
    try {
      const response = await fetch(`/api/friends/${friend.userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        setFriends(friends.filter(f => f.userId !== friend.userId));
      }
    } catch (error) {
      console.error('Error unfriending:', error);
    } finally {
      setShowConfirmDialog(false);
      setFriendToUnfriend(null);
    }
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <>
      <main className="min-h-screen p-4 pt-24 md:p-8 md:pt-28">
        <div className="max-w-screen-xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Friends
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              Manage your friends and friend requests
            </p>
          </div>

          {/* Add Friend Form */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg mb-8">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Add New Friend
            </h3>
            <form onSubmit={sendFriendRequest} className="space-y-4">
              {successMessage && (
                <div className="bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-sm p-3 rounded">
                  {successMessage}
                </div>
              )}
              <div className="flex gap-4">
                <input
                  type="text"
                  placeholder="Enter username or email"
                  value={newFriendIdentifier}
                  onChange={(e) => setNewFriendIdentifier(e.target.value)}
                  className="flex-1 px-3 py-2 border rounded-lg dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Send Request
                </button>
              </div>
            </form>
          </div>

          {/* Friend Requests Section */}
          {friendRequests.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg mb-8">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Friend Requests
              </h3>
              <div className="space-y-4">
                {friendRequests.map((request) => (
                  <div key={request.userId} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <span className="text-gray-900 dark:text-white">{request.username}</span>
                    <div className="space-x-2">
                      <button
                        onClick={() => handleFriendRequest(request.userId, 'accept')}
                        className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleFriendRequest(request.userId, 'reject')}
                        className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Friends List */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Your Friends
            </h3>
            <div className="space-y-4">
              {friends.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400">No friends added yet</p>
              ) : (
                friends.map((friend) => (
                  <div key={friend.userId} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg group">
                    <span className="text-gray-900 dark:text-white">{friend.username}</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {/* Handle viewing friend details */}}
                        className="px-3 py-1 text-blue-600 hover:text-blue-700 dark:text-blue-400"
                      >
                        View Details
                      </button>
                      <button
                        onClick={() => {
                          setFriendToUnfriend(friend);
                          setShowConfirmDialog(true);
                        }}
                        className="px-3 py-1 text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400 transition-colors duration-200"
                      >
                        Unfriend
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Confirmation Dialog */}
          {showConfirmDialog && friendToUnfriend && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-sm w-full">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Remove Friend
                </h4>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  Are you sure you want to remove {friendToUnfriend.username} from your friends list?
                </p>
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setShowConfirmDialog(false);
                      setFriendToUnfriend(null);
                    }}
                    className="px-4 py-2 text-gray-600 hover:text-gray-700 dark:text-gray-400"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleUnfriend(friendToUnfriend)}
                    className="px-4 py-2 text-red-600 hover:text-red-700 dark:text-red-400"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
      <Navigation />
    </>
  );
}
