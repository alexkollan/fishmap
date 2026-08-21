import { NavLink } from "react-router-dom";
import { useI18n } from "@/lib/i18n";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-2 text-sm transition-colors ${
    isActive ? "text-ink bg-white/10" : "text-ink-muted hover:text-ink"
  }`;

export function NavBar() {
  const { t } = useI18n();

  const mobileTabs = [
    { to: "/", label: t.nav.today },
    { to: "/map", label: t.nav.map },
    { to: "/forecast", label: t.nav.forecast },
    { to: "/spots", label: t.nav.spots },
    { to: "/settings", label: t.nav.settings },
  ];

  const desktopLinks = [
    { to: "/", label: t.nav.today },
    { to: "/map", label: t.nav.map },
    { to: "/forecast", label: t.nav.forecast },
    { to: "/conditions/wind", label: t.nav.conditions.wind },
    { to: "/conditions/sea", label: t.nav.conditions.sea },
    { to: "/conditions/pressure", label: t.nav.conditions.pressure },
    { to: "/conditions/sky", label: t.nav.conditions.sky },
    { to: "/conditions/sun-moon", label: t.nav.conditions.sunMoon },
    { to: "/windows", label: t.nav.windows },
    { to: "/spots", label: t.nav.spots },
    { to: "/settings", label: t.nav.settings },
  ];

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-10 flex justify-around border-t border-white/10 bg-ground py-1 md:hidden">
        {mobileTabs.map((tab) => (
          <NavLink key={tab.to} to={tab.to} end={tab.to === "/"} className={navLinkClass}>
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <nav className="fixed inset-y-0 left-0 z-10 hidden w-56 flex-col gap-1 border-r border-white/10 bg-ground px-3 py-4 md:flex">
        <span className="mb-2 px-3 text-sm font-semibold text-ink">Ψαρέματα</span>
        {desktopLinks.map((link) => (
          <NavLink key={link.to} to={link.to} end={link.to === "/"} className={navLinkClass}>
            {link.label}
          </NavLink>
        ))}
      </nav>
    </>
  );
}
