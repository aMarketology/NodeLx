import React from 'react';
import { Link } from 'react-router-dom';

export default function Brand({ to = '/admin' }) {
  return (
    <Link to={to} className="brand">
      <span className="brand-dot" />
      <span className="brand-name">
        Node<span>Lx</span>
      </span>
    </Link>
  );
}