import React, { useState } from 'react';
import { User, UserPermissions } from '../types';
import { TrashIcon, XIcon, KeyIcon } from './icons';

interface AdminPanelProps {
  users: User[];
  currentUser: User;
  onAddUser: (newUser: Pick<User, 'username' | 'password'>) => { success: boolean, message: string };
  onDeleteUser: (username: string) => { success: boolean, message: string };
  onChangePassword: (username: string, newPassword: string) => { success: boolean, message: string };
  onUpdatePermissions: (username: string, permissions: UserPermissions) => void;
  onClose: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ users, currentUser, onAddUser, onDeleteUser, onChangePassword, onUpdatePermissions, onClose }) => {
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [passwordChangeTarget, setPasswordChangeTarget] = useState<User | null>(null);
  const [newPasswordForTarget, setNewPasswordForTarget] = useState('');

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    if (!newUsername.trim() || !newPassword.trim()) {
      setError('Tên đăng nhập và mật khẩu không được để trống.');
      return;
    }
    const result = onAddUser({ username: newUsername.trim(), password: newPassword });
    if (result.success) {
      setSuccessMessage(result.message);
      setNewUsername('');
      setNewPassword('');
    } else {
      setError(result.message);
    }
  };
  
  const handleDelete = (username: string) => {
      if (window.confirm(`Bạn có chắc chắn muốn xóa người dùng "${username}" không?`)) {
          setError('');
          setSuccessMessage('');
          const result = onDeleteUser(username);
          if (result.success) {
              setSuccessMessage(result.message);
          } else {
              setError(result.message);
          }
      }
  }

  const handlePasswordChangeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordChangeTarget) return;

    setSuccessMessage('');
    setError('');

    if (newPasswordForTarget.trim() === '') {
        // We can show an error inside the modal in the future, for now, main panel is fine.
        alert('Mật khẩu không được để trống.');
        return;
    }

    const result = onChangePassword(passwordChangeTarget.username, newPasswordForTarget);
    if (result.success) {
        setSuccessMessage(result.message);
        setPasswordChangeTarget(null);
        setNewPasswordForTarget('');
    } else {
        // This will display the error on the main panel.
        setError(result.message);
        setPasswordChangeTarget(null);
        setNewPasswordForTarget('');
    }
  };


  const handlePermissionChange = (username: string, perm: keyof UserPermissions, value: boolean) => {
    const user = users.find(u => u.username === username);
    if (user) {
        const newPermissions = { ...user.permissions, [perm]: value };
        onUpdatePermissions(username, newPermissions);
    }
  }

  const adminsCount = users.filter(u => u.role === 'admin').length;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4" onClick={onClose} aria-modal="true" role="dialog">
      {/* Password Change Modal */}
      {passwordChangeTarget && (
        <div className="fixed inset-0 bg-black/70 z-[60] flex justify-center items-center" onClick={() => setPasswordChangeTarget(null)}>
            <div className="bg-primary rounded-lg shadow-xl w-full max-w-sm p-6 m-4" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-primary-foreground mb-4">
                    Đổi mật khẩu cho "{passwordChangeTarget.username}"
                </h3>
                <form onSubmit={handlePasswordChangeSubmit}>
                    <label htmlFor="new-password-input" className="sr-only">Mật khẩu mới</label>
                    <input
                        id="new-password-input"
                        type="password"
                        value={newPasswordForTarget}
                        onChange={(e) => setNewPasswordForTarget(e.target.value)}
                        placeholder="Nhập mật khẩu mới"
                        className="w-full px-4 py-2 bg-secondary/70 border border-secondary rounded-md text-primary-foreground placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent"
                        autoFocus
                        required
                    />
                    <div className="mt-6 flex justify-end gap-3">
                        <button type="button" onClick={() => setPasswordChangeTarget(null)} className="px-4 py-2 text-sm font-medium text-gray-300 bg-secondary hover:bg-secondary/80 rounded-md transition-colors">
                            Hủy
                        </button>
                        <button type="submit" className="px-4 py-2 text-sm font-medium rounded-md shadow-sm text-accent-foreground bg-accent hover:bg-accent/90 transition-colors">
                            Lưu thay đổi
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

      <div className="bg-secondary rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <header className="flex justify-between items-center p-4 border-b border-primary/50">
          <h2 className="text-xl font-bold text-primary-foreground">Quản lý Người dùng</h2>
          <button onClick={onClose} className="p-1 rounded-full text-gray-400 hover:bg-primary/50 hover:text-white" aria-label="Đóng">
            <XIcon className="w-6 h-6" />
          </button>
        </header>
        
        <main className="p-6 overflow-y-auto flex-1">
          <h3 className="text-lg font-semibold mb-4">Danh sách người dùng hiện tại</h3>
          <div className="space-y-3">
            {users.map(user => (
              <div key={user.username} className="p-3 bg-primary/40 rounded-md">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <p className="font-medium text-primary-foreground">{user.username}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${user.role === 'admin' ? 'bg-accent/80 text-accent-foreground' : 'bg-gray-600 text-gray-200'}`}>
                            {user.role}
                        </span>
                    </div>
                    <div className="flex items-center">
                        <button
                            onClick={() => {
                                setNewPasswordForTarget('');
                                setPasswordChangeTarget(user);
                            }}
                            className="p-2 text-gray-400 hover:text-accent rounded-full"
                            title="Đổi mật khẩu"
                        >
                            <KeyIcon className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => handleDelete(user.username)}
                          disabled={user.username === currentUser.username || (user.role === 'admin' && adminsCount <= 1)}
                          className="p-2 text-gray-400 hover:text-red-500 rounded-full disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-gray-400"
                          title={user.username === currentUser.username ? "Không thể xóa chính bạn" : (user.role === 'admin' && adminsCount <= 1) ? "Không thể xóa quản trị viên cuối cùng" : "Xóa người dùng"}
                        >
                          <TrashIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>
                <div className="mt-3 pt-3 border-t border-primary/80 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 text-sm">
                    <label className="flex items-center space-x-2 cursor-pointer">
                        <input 
                            type="checkbox"
                            checked={user.permissions.canCompressBatch}
                            onChange={(e) => handlePermissionChange(user.username, 'canCompressBatch', e.target.checked)}
                            disabled={user.username === currentUser.username}
                            className="form-checkbox h-4 w-4 rounded bg-primary/70 border-secondary text-accent focus:ring-accent disabled:opacity-50"
                        />
                        <span className={user.username === currentUser.username ? 'text-gray-500' : ''}>Nén PDF</span>
                    </label>
                     <label className="flex items-center space-x-2 cursor-pointer">
                        <input 
                            type="checkbox"
                            checked={user.permissions.canDownloadBatch}
                            onChange={(e) => handlePermissionChange(user.username, 'canDownloadBatch', e.target.checked)}
                            disabled={user.username === currentUser.username}
                            className="form-checkbox h-4 w-4 rounded bg-primary/70 border-secondary text-accent focus:ring-accent disabled:opacity-50"
                        />
                        <span className={user.username === currentUser.username ? 'text-gray-500' : ''}>Tải về</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                        <input 
                            type="checkbox"
                            checked={user.permissions.canMerge}
                            onChange={(e) => handlePermissionChange(user.username, 'canMerge', e.target.checked)}
                            disabled={user.username === currentUser.username}
                            className="form-checkbox h-4 w-4 rounded bg-primary/70 border-secondary text-accent focus:ring-accent disabled:opacity-50"
                        />
                        <span className={user.username === currentUser.username ? 'text-gray-500' : ''}>Gộp PDF</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                        <input 
                            type="checkbox"
                            checked={user.permissions.canExtract}
                            onChange={(e) => handlePermissionChange(user.username, 'canExtract', e.target.checked)}
                            disabled={user.username === currentUser.username}
                            className="form-checkbox h-4 w-4 rounded bg-primary/70 border-secondary text-accent focus:ring-accent disabled:opacity-50"
                        />
                        <span className={user.username === currentUser.username ? 'text-gray-500' : ''}>Trích xuất</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                        <input 
                            type="checkbox"
                            checked={user.permissions.canConvertToPdf}
                            onChange={(e) => handlePermissionChange(user.username, 'canConvertToPdf', e.target.checked)}
                            disabled={user.username === currentUser.username}
                            className="form-checkbox h-4 w-4 rounded bg-primary/70 border-secondary text-accent focus:ring-accent disabled:opacity-50"
                        />
                        <span className={user.username === currentUser.username ? 'text-gray-500' : ''}>Ảnh &gt; PDF</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                        <input 
                            type="checkbox"
                            checked={user.permissions.canEnhanceImage}
                            onChange={(e) => handlePermissionChange(user.username, 'canEnhanceImage', e.target.checked)}
                            disabled={user.username === currentUser.username}
                            className="form-checkbox h-4 w-4 rounded bg-primary/70 border-secondary text-accent focus:ring-accent disabled:opacity-50"
                        />
                        <span className={user.username === currentUser.username ? 'text-gray-500' : ''}>Làm Nét</span>
                    </label>
                </div>
              </div>
            ))}
          </div>
        </main>
        
        <footer className="p-6 border-t border-primary/50 bg-secondary/50 rounded-b-lg">
          <h3 className="text-lg font-semibold mb-4">Thêm người dùng mới</h3>
          <form onSubmit={handleAddUser} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input
                type="text"
                value={newUsername}
                onChange={e => setNewUsername(e.target.value)}
                placeholder="Tên đăng nhập mới"
                className="w-full px-4 py-2 bg-primary/70 border border-secondary rounded-md text-primary-foreground placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent"
                aria-label="Tên đăng nhập mới"
              />
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Mật khẩu mới"
                className="w-full px-4 py-2 bg-primary/70 border border-secondary rounded-md text-primary-foreground placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent"
                aria-label="Mật khẩu mới"
              />
            </div>
            {error && <p className="text-sm text-red-500" role="alert">{error}</p>}
            {successMessage && <p className="text-sm text-green-500" role="status">{successMessage}</p>}
            <button
              type="submit"
              className="w-full sm:w-auto px-6 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-accent-foreground bg-accent hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent focus:ring-offset-secondary"
            >
              Thêm người dùng
            </button>
          </form>
        </footer>
      </div>
    </div>
  );
};

export default AdminPanel;