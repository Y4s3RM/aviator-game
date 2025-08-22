import React, { useState, useEffect } from 'react';
import authService from './services/authService.js';

const UserProfile = ({ isOpen, onClose }) => {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('profile'); // 'profile', 'security', 'leaderboard'
  const [isLoading, setIsLoading] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [leaderboardType, setLeaderboardType] = useState('balance');
  
  // Password change form
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordErrors, setPasswordErrors] = useState({});
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setUser(authService.getUser());
      if (activeTab === 'leaderboard') {
        loadLeaderboard();
      }
    }
  }, [isOpen, activeTab]);

  const loadLeaderboard = async () => {
    try {
      const result = await authService.getLeaderboard(leaderboardType, 10);
      if (result.success) {
        setLeaderboard(result.leaderboard);
      }
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    
    // Validate form
    const errors = {};
    if (!passwordForm.oldPassword) {
      errors.oldPassword = 'Current password is required';
    }
    if (!passwordForm.newPassword || passwordForm.newPassword.length < 6) {
      errors.newPassword = 'New password must be at least 6 characters';
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    if (Object.keys(errors).length > 0) {
      setPasswordErrors(errors);
      return;
    }

    setIsLoading(true);
    setPasswordErrors({});
    setPasswordSuccess(false);

    try {
      const result = await authService.changePassword(
        passwordForm.oldPassword,
        passwordForm.newPassword
      );

      if (result.success) {
        setPasswordSuccess(true);
        setPasswordForm({
          oldPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
      } else {
        setPasswordErrors({ general: result.error });
      }
    } catch (error) {
      setPasswordErrors({ general: 'Failed to change password' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await authService.logout();
    onClose();
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount) => {
    const n = Number.isFinite(Number(amount)) ? Number(amount) : 0;
    return n.toLocaleString() + ' pts';
  };

  const getRankIcon = (index) => {
    switch (index) {
      case 0: return '🥇';
      case 1: return '🥈';
      case 2: return '🥉';
      default: return `#${index + 1}`;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-lg font-bold">{(user?.username?.[0] || 'G').toUpperCase()}</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{user?.username || 'Guest'}</h2>
              {user && (
                <p className="text-sm text-gray-400">Level {user.level} • {user.role}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700">
          {[
            { id: 'profile', label: 'Profile', icon: '👤' },
            { id: 'security', label: 'Security', icon: '🔐' },
            { id: 'leaderboard', label: 'Leaderboard', icon: '🏆' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-800'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {!user && (
            <div className="space-y-4">
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-2">Guest Profile</h3>
                <p className="text-gray-300 text-sm">You are playing in guest mode. Log in or register to save progress and access security settings.</p>
              </div>
            </div>
          )}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              {/* Account Stats */}
              {user && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-400">{formatCurrency(user.balance)}</div>
                  <div className="text-sm text-gray-400">Balance</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-blue-400">{user.gamesPlayed}</div>
                  <div className="text-sm text-gray-400">Games Played</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-yellow-400">{Number(user?.winRate ?? 0).toFixed(1)}%</div>
                  <div className="text-sm text-gray-400">Win Rate</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-purple-400">{user.level}</div>
                  <div className="text-sm text-gray-400">Level</div>
                </div>
              </div>
              )}

              {/* Detailed Stats */}
              {user && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-800 rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-4">💰 Financial Stats</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Total Wagered:</span>
                      <span className="font-medium">{formatCurrency(user.totalWagered)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Total Won:</span>
                      <span className="font-medium text-green-400">{formatCurrency(user.totalWon)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Total Lost:</span>
                      <span className="font-medium text-red-400">{formatCurrency(user.totalLost)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Net Profit:</span>
                      <span className={`font-medium ${user.totalWon - user.totalLost >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatCurrency(user.totalWon - user.totalLost)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-800 rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-4">🎯 Performance</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Biggest Win:</span>
                      <span className="font-medium text-green-400">{formatCurrency(user.biggestWin)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Biggest Loss:</span>
                      <span className="font-medium text-red-400">{formatCurrency(user.biggestLoss)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Experience:</span>
                      <span className="font-medium text-purple-400">{user.experience} XP</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Member Since:</span>
                      <span className="font-medium">{formatDate(user.createdAt)}</span>
                    </div>
                  </div>
                </div>
              </div>
              )}

              {/* Account Info */}
              {user && (
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-4">📧 Account Information</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Email:</span>
                    <span className="font-medium">{user.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Last Login:</span>
                    <span className="font-medium">
                      {user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Never'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Account Status:</span>
                    <span className="font-medium text-green-400">
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>
              )}
            </div>
          )}

          {activeTab === 'security' && user && (
            <div className="space-y-6">
              {/* Change Password */}
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-4">🔐 Change Password</h3>
                
                {passwordSuccess && (
                  <div className="bg-green-600 text-white p-3 rounded-lg mb-4">
                    Password changed successfully!
                  </div>
                )}

                {passwordErrors.general && (
                  <div className="bg-red-600 text-white p-3 rounded-lg mb-4">
                    {passwordErrors.general}
                  </div>
                )}

                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Current Password
                    </label>
                    <input
                      type="password"
                      value={passwordForm.oldPassword}
                      onChange={(e) => setPasswordForm(prev => ({ ...prev, oldPassword: e.target.value }))}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                      disabled={isLoading}
                    />
                    {passwordErrors.oldPassword && (
                      <p className="text-red-400 text-xs mt-1">{passwordErrors.oldPassword}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                      disabled={isLoading}
                    />
                    {passwordErrors.newPassword && (
                      <p className="text-red-400 text-xs mt-1">{passwordErrors.newPassword}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                      disabled={isLoading}
                    />
                    {passwordErrors.confirmPassword && (
                      <p className="text-red-400 text-xs mt-1">{passwordErrors.confirmPassword}</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg"
                  >
                    {isLoading ? 'Changing...' : 'Change Password'}
                  </button>
                </form>
              </div>

              {/* Logout */}
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-4">👋 Account Actions</h3>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
                >
                  Logout
                </button>
              </div>
            </div>
          )}

          {activeTab === 'leaderboard' && (
            <div className="space-y-4">
              {/* Leaderboard Type Selector */}
              <div className="flex space-x-2">
                {[
                  { key: 'balance', label: 'Balance' },
                  { key: 'totalWon', label: 'Total Won' },
                  { key: 'winRate', label: 'Win Rate' },
                  { key: 'level', label: 'Level' }
                ].map(type => (
                  <button
                    key={type.key}
                    onClick={() => {
                      setLeaderboardType(type.key);
                      loadLeaderboard();
                    }}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      leaderboardType === type.key
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>

              {/* Leaderboard List */}
              <div className="bg-gray-800 rounded-lg overflow-hidden">
                <div className="p-4 border-b border-gray-700">
                  <h3 className="text-lg font-semibold">🏆 Top Players</h3>
                </div>
                <div className="divide-y divide-gray-700">
                  {leaderboard.map((player, index) => (
                    <div key={player.id} className="p-4 flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <span className="text-lg">{getRankIcon(index)}</span>
                        <div>
                          <div className="font-medium text-white">{player.username}</div>
                          <div className="text-sm text-gray-400">Level {player.level}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-white">
                          {leaderboardType === 'winRate' 
                            ? `${Number(player[leaderboardType] ?? 0).toFixed(1)}%`
                            : formatCurrency(player[leaderboardType])
                          }
                        </div>
                        <div className="text-sm text-gray-400">
                          {player.gamesPlayed} games
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
