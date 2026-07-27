import React from 'react';
import ReactDOM from 'react-dom/client';
// Side-effect: capture ?fabricEmbedded=true before SPA navigation
import '@microsoft/rayfin-auth-provider-fabric';
import App from './App';
import './App.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
