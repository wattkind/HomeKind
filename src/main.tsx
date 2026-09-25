import React from 'react';
import ReactDOM from 'react-dom/client';

import { App } from './App';
import './styles/tokens.css';
import './styles/base.css';

const root = document.getElementById('root');
if (!root) {
  throw new Error('HomeKind: #root element is missing from index.html');
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
