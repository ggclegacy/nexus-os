"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  Activity,
  Apple,
  Brain,
  CalendarDays,
  CircleDollarSign,
  Command,
  Dumbbell,
  FileLock2,
  HeartPulse,
  Home,
  Menu,
  MessageCircle,
  MoonStar,
  Plus,
  Settings,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";

const navigation = [
  { label: "Command", href: "/", icon: Home, ready: true },
  { label: "Protocol", href: "/protocol", icon: HeartPulse },
  { label: "Fitness", href: "/fitness", icon: Dumbbell },
  { label: "Sleep", href: "/sleep", icon: MoonStar },
  { label: "Nutrition", href: "/nutrition", icon: Apple },
  { label: "Mindset", href: "/mindset", icon: Brain },
  { label: "Finance", href: "/finance", icon: CircleDollarSign },
  { label: "Calendar", href: "/calendar", icon: CalendarDays },
  { label: "Atlas", href: "/atlas", icon: Sparkles },
  { label: "Vault", href: "/vault", icon: FileLock2 },
  { label: "Life", href: "/life", icon: Activity },
  { label: "Settings", href: "/settings", icon: Settings },
];

function NavigationLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <>
      {navigation.map((item) => {
        const Icon = item.icon;
        const active =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-item ${active ? "nav-item--active" : ""}`}
            aria-current={active ? "page" : undefined}
            onClick={onNavigate}
          >
            <Icon aria-hidden="true" />
            <span>{item.label}</span>
            {!item.ready && item.href !== "/atlas" ? (
              <span className="sr-only">Not built yet</span>
            ) : null}
          </Link>
        );
      })}
    </>
  );
}

export function AppShell({
  children,
  onQuickAdd,
}: {
  children: ReactNode;
  onQuickAdd?: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const openQuickAdd = () => {
    if (onQuickAdd) {
      onQuickAdd();
      return;
    }
    window.location.href = "/#quick-actions";
  };

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to today
      </a>

      <aside className="sidebar" aria-label="Primary navigation">
        <Link className="brand" href="/" aria-label="Nexus OS Command">
          <span className="brand__emblem">
            <Image
              src="/nexus-emblem-96.png"
              width={42}
              height={42}
              alt=""
              priority
            />
          </span>
          <span className="brand__copy">
            <span>Nexus</span>
            <small>Private system</small>
          </span>
        </Link>
        <nav className="sidebar__nav">
          <NavigationLinks />
        </nav>
        <div className="sidebar__footer">
          <span className="local-status">
            <ShieldCheck aria-hidden="true" />
            Private local workspace
          </span>
          <Link href="/settings" className="user-entry">
            <UserRound aria-hidden="true" />
            <span>
              Personal profile
              <small>Settings and privacy</small>
            </span>
          </Link>
        </div>
      </aside>

      <header className="topbar">
        <Link className="brand brand--compact" href="/" aria-label="Nexus OS">
          <Image
            src="/nexus-emblem-96.png"
            width={38}
            height={38}
            alt=""
            priority
          />
          <span>Nexus</span>
        </Link>
        <div className="topbar__actions">
          <details className="status-menu">
            <summary aria-label="Open system status">
              <ShieldCheck aria-hidden="true" />
              <span className="status-menu__label">Local</span>
            </summary>
            <div className="status-popover">
              <p className="eyebrow">System status</p>
              <strong>Local workspace is active</strong>
              <p>
                Your Command data is stored in the local development database.
                No external integrations are connected.
              </p>
            </div>
          </details>
          <Button
            variant="tertiary"
            icon={<MessageCircle aria-hidden="true" />}
            onClick={() => {
              window.location.href = "/atlas";
            }}
          >
            Atlas
          </Button>
          <Button
            variant="primary"
            icon={<Plus aria-hidden="true" />}
            onClick={openQuickAdd}
          >
            Quick add
          </Button>
        </div>
      </header>

      <main id="main-content" className="main-content" tabIndex={-1}>
        {children}
      </main>

      <nav className="bottom-nav" aria-label="Mobile navigation">
        <Link
          href="/"
          className="bottom-nav__item"
          aria-current={pathname === "/" ? "page" : undefined}
        >
          <Command aria-hidden="true" />
          <span>Command</span>
        </Link>
        <button className="bottom-nav__item" onClick={openQuickAdd}>
          <span className="bottom-nav__add">
            <Plus aria-hidden="true" />
          </span>
          <span>Add</span>
        </button>
        <Link
          href="/atlas"
          className="bottom-nav__item"
          aria-current={pathname.startsWith("/atlas") ? "page" : undefined}
        >
          <Sparkles aria-hidden="true" />
          <span>Atlas</span>
        </Link>
        <button
          className="bottom-nav__item"
          onClick={() => setMenuOpen(true)}
          aria-haspopup="dialog"
        >
          <Menu aria-hidden="true" />
          <span>More</span>
        </button>
      </nav>

      <Dialog
        open={menuOpen}
        title="Nexus modules"
        description="Command is ready. Other personal domains are prepared for later phases."
        onClose={() => setMenuOpen(false)}
      >
        <nav className="mobile-module-grid" aria-label="All Nexus modules">
          <NavigationLinks onNavigate={() => setMenuOpen(false)} />
        </nav>
      </Dialog>
    </div>
  );
}
