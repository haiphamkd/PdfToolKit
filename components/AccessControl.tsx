import React, { useState } from 'react';
import { HPLogo } from './HPLogo';

interface AccessControlProps {
  onLogin: (username: string, password: string) => boolean;
}

const AccessControl: React.FC<AccessControlProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const success = onLogin(username, password);
    if (!success) {
      setError('Tên đăng nhập hoặc mật khẩu không hợp lệ.');
    }
  };

  return (
    <div className="min-h-screen bg-primary flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-sm mx-auto text-center">
        <HPLogo className="h-24 w-24 mx-auto text-accent mb-6" />
        <h1 className="text-2xl font-bold text-primary-foreground mb-2">
          Đăng Nhập
        </h1>
        <p className="text-gray-400 mb-8">
          Vui lòng đăng nhập để sử dụng các công cụ PDF.
        </p>
        <div className="bg-secondary/50 p-8 rounded-xl shadow-lg">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="sr-only">
                Tên đăng nhập
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Tên đăng nhập"
                className="w-full px-4 py-3 bg-primary/70 border border-secondary rounded-md text-primary-foreground placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent"
                autoFocus
                required
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Mật khẩu
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mật khẩu"
                className="w-full px-4 py-3 bg-primary/70 border border-secondary rounded-md text-primary-foreground placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent"
                required
              />
            </div>
            {error && (
              <p className="text-sm text-red-500 text-left">{error}</p>
            )}
            <button
              type="submit"
              className="w-full mt-2 px-4 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-accent-foreground bg-accent hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent focus:ring-offset-primary"
            >
              Đăng nhập
            </button>
          </form>
        </div>
         <footer className="text-center mt-12 text-gray-500 text-sm">
            <p>&copy; 2025 Hai Pham - PDF Toolkit.</p>
        </footer>
      </div>
    </div>
  );
};

export default AccessControl;
