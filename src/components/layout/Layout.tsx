import { Outlet } from "react-router-dom";
import { Header } from "./Header";
import { CommandPalette } from "@/components/search/CommandPalette";

export function Layout() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <CommandPalette />
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-6 py-6 text-xs text-muted-foreground sm:flex-row">
        <p>SystemAtlas — an open-source visual reference for backend engineering.</p>
        <div className="flex items-center gap-4">
          <a href="https://github.com" target="_blank" rel="noreferrer" className="hover:text-foreground">
            GitHub
          </a>
          <a href="/about" className="hover:text-foreground">
            About
          </a>
        </div>
      </div>
    </footer>
  );
}
