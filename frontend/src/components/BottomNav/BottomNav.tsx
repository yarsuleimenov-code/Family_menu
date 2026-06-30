import { BookOpen, CalendarDays, MoreHorizontal, ShoppingCart, Soup } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const items = [
  { to: '/plan', label: 'План', icon: CalendarDays },
  { to: '/shopping', label: 'Покупки', icon: ShoppingCart },
  { to: '/dishes', label: 'Блюда', icon: Soup },
  { to: '/base-products', label: 'Базовые', icon: BookOpen },
  { to: '/history', label: 'История', icon: MoreHorizontal },
];

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Основная навигация">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink key={item.to} to={item.to}>
            <Icon size={20} aria-hidden="true" />
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
