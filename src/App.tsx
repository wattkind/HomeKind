import { createHashRouter, Navigate, RouterProvider } from 'react-router-dom';

import { Layout } from './components/Layout';
import { DeviceDetailScreen } from './screens/DeviceDetailScreen';
import { DeviceFormScreen } from './screens/DeviceFormScreen';
import { DeviceListScreen } from './screens/DeviceListScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { WarrantiesScreen } from './screens/WarrantiesScreen';
import { WelcomeScreen } from './screens/WelcomeScreen';
import './styles/app.css';

// Hash routing: the app is served from the Capacitor bundle, which has no server-side routes.
const router = createHashRouter([
  { path: '/welcome', element: <WelcomeScreen /> },
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <DeviceListScreen /> },
      { path: 'devices/new', element: <DeviceFormScreen /> },
      { path: 'devices/:id', element: <DeviceDetailScreen /> },
      { path: 'devices/:id/edit', element: <DeviceFormScreen /> },
      { path: 'warranties', element: <WarrantiesScreen /> },
      { path: 'settings', element: <SettingsScreen /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
