import { useLocation } from 'react-router-dom';

const routeTitles: Record<string, string> = {
  '/': 'Home',
  '/dashboard': 'Dashboard',
  '/products': 'Products',
  '/inventory': 'Inventory',
  '/sales': 'Sales',
  '/customers': 'Customers',
  '/hr-management': 'HR Management',
  '/reports': 'Reports',
  '/invoices': 'Invoices',
  '/alerts': 'Alerts',
  '/settings': 'Settings',
  '/admin': 'Business Administration',
  '/super-admin': 'Super Admin Dashboard',
  '/profile': 'Profile',
};

export const useCurrentPageTitle = () => {
  const location = useLocation();
  const currentPath = location.pathname;
  
  // Handle admin sub-routes
  if (currentPath.startsWith('/admin')) {
    return 'Business Administration';
  }
  if (currentPath.startsWith('/super-admin')) {
    return 'Super Admin Dashboard';
  }
  if (currentPath.startsWith('/users/')) {
    return 'User Profile';
  }
  
  return routeTitles[currentPath] || 'Page';
};

