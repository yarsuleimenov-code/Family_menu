import { createBrowserRouter, Navigate } from 'react-router-dom';
import { App } from './App';
import { PlanPage } from '../pages/PlanPage/PlanPage';
import { ShoppingPage } from '../pages/ShoppingPage/ShoppingPage';
import { DishesPage } from '../pages/DishesPage/DishesPage';
import { BaseProductsPage } from '../pages/BaseProductsPage/BaseProductsPage';
import { HistoryPage } from '../pages/HistoryPage/HistoryPage';
import { SettingsPage } from '../pages/SettingsPage/SettingsPage';

const routerBasename = import.meta.env.BASE_URL === '/' ? '/' : import.meta.env.BASE_URL.replace(/\/$/, '');

export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <App />,
      children: [
        { index: true, element: <Navigate to="/plan" replace /> },
        { path: 'plan', element: <PlanPage /> },
        { path: 'shopping', element: <ShoppingPage /> },
        { path: 'dishes', element: <DishesPage /> },
        { path: 'base-products', element: <BaseProductsPage /> },
        { path: 'history', element: <HistoryPage /> },
        { path: 'settings', element: <SettingsPage /> },
      ],
    },
  ],
  { basename: routerBasename },
);
