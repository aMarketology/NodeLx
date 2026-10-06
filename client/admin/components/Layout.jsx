import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Brand from './Brand';
import { useAuth } from '../AuthContext';

export default function Layout({ children, actions }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  return (
    <div className="admin-shell">
      <header className="topbar">
        <div className="topbar-left">
          <Brand />
        </div>
        <div className="topbar-right">
          {actions}
          <div className="user-chip">
            <span className="user-avatar">{(user?.email || '?').charAt(0).toUpperCase()}</span>
            <span>{user?.email || '…'}</span>
          </div>
          <button className="btn btn-ghost" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </header>
      <main className="admin-main">{children}</main>
    </div>
  );
}