import { Outlet } from "react-router-dom";
import { Header } from "./Header";
import { NavBar } from "./NavBar";
import { ConsentBanner } from "./ConsentBanner";

export function AppShell() {
  return (
    <div className="min-h-full">
      <NavBar />
      <div className="pb-16 md:pb-0 md:pl-56">
        <Header />
        <main className="mx-auto max-w-3xl">
          <Outlet />
        </main>
      </div>
      <ConsentBanner />
    </div>
  );
}
