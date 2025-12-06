import React from 'react';

// Simple test component to verify SplitView can render
function TestSplitView({ onBack }) {
  return (
    <div style={{ padding: '20px', background: '#f0f0f0', minHeight: '100vh' }}>
      <h1>Split View Editor Test</h1>
      <p>If you see this, the component is loading!</p>
      {onBack && (
        <button onClick={onBack} style={{ padding: '10px 20px', marginTop: '20px' }}>
          ← Back to Home
        </button>
      )}
      <div style={{ marginTop: '20px', background: 'white', padding: '20px', borderRadius: '8px' }}>
        <h2>Debug Info:</h2>
        <p>API URL: http://localhost:3001</p>
        <p>Preview URL: http://localhost:3000</p>
      </div>
    </div>
  );
}

export default TestSplitView;
