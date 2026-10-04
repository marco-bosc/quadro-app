import './BottomNav.css';

export interface NavItem {
  href: string;
  label: string;
  active: boolean;
}

/** Navigazione principale in basso, solo testo (DESIGN §3). Mostra solo le schermate già esistenti. */
export function BottomNav({ items }: { items: NavItem[] }) {
  return (
    <nav className="bottomnav" aria-label="Navigazione principale">
      <ul>
        {items.map((item) => (
          <li key={item.href}>
            <a href={item.href} aria-current={item.active ? 'page' : undefined}>{item.label}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
