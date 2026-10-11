import React from 'react';
import ReactDOM from 'react-dom/client';

import { App } from './App';
import { isNative } from './platform/runtime';
import './styles/tokens.css';
import './styles/base.css';

// Ask the web view to treat the local database as persistent. Chromium (Android) may
// otherwise evict IndexedDB under storage pressure; the records live nowhere else.
if (isNative && typeof navigator.storage?.persist === 'function') {
  void navigator.storage.persist();
}

const root = document.getElementById('root');
if (!root) {
  throw new Error('HomeKind: #root element is missing from index.html');
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
