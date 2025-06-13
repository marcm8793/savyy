import Link from "next/link";
import { Logo } from "./logo";

const links = [
  {
    group: "Product",
    items: [
      {
        title: "Asset Tracking",
        href: "/features/tracking",
      },
      {
        title: "Portfolio Analysis",
        href: "/features/portfolio",
      },
      {
        title: "Goal Planning",
        href: "/features/planning",
      },
    ],
  },
  {
    group: "Company",
    items: [
      {
        title: "About",
        href: "/about",
      },
      {
        title: "Contact",
        href: "/contact",
      },
      {
        title: "Security",
        href: "/security",
      },
    ],
  },
  {
    group: "Resources",
    items: [
      {
        title: "Help Center",
        href: "/help",
      },
      {
        title: "API Documentation",
        href: "/docs",
      },
      {
        title: "Community",
        href: "/community",
      },
    ],
  },
  {
    group: "Legal",
    items: [
      {
        title: "Terms of Service",
        href: "/tos",
      },
      {
        title: "Privacy Policy",
        href: "/privacy-policy",
      },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-border bg-background pt-20">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-12 md:grid-cols-5">
          <div className="md:col-span-2">
            <div className="flex items-center justify-center gap-2 md:justify-start">
              <Link
                href="/"
                aria-label="go home"
                className="flex items-center gap-2"
              >
                <Logo />
              </Link>
            </div>
            <p className="mt-3 text-center text-sm text-muted-foreground md:text-start">
              Master your financial assets with Savyy. Connect all your
              accounts, track your wealth, and get personalized insights to
              optimize your financial future.
            </p>
            <div className="mt-6 flex justify-center space-x-4 md:justify-start">
              <p className="text-sm text-muted-foreground">
                🔒 Powered by{" "}
                <a
                  href="https://tink.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300"
                >
                  Tink&apos;s secure infrastructure
                </a>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 md:col-span-3 md:grid-cols-4">
            {links.map((link) => (
              <div key={link.group} className="space-y-4 text-sm">
                <span className="block font-medium text-foreground">
                  {link.group}
                </span>
                {link.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="block text-muted-foreground duration-150 hover:text-orange-600 dark:hover:text-orange-400"
                  >
                    <span>{item.title}</span>
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-12 flex flex-col items-center justify-center gap-6 border-t border-border py-6 md:flex-row md:items-end md:justify-between">
          <div className="text-sm text-muted-foreground">
            Built with 💙 for your financial success
          </div>
          <span className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Savyy, All rights reserved
          </span>
        </div>
      </div>
    </footer>
  );
}
