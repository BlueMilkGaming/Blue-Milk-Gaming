import Link from "next/link";

const PAGES = [
  { label: "Overview", href: "/admin" },
  { label: "Claims", href: "/admin/claims" },
  { label: "Flags", href: "/admin/flags" },
  { label: "Pods", href: "/admin/pods" },
  { label: "Prizes", href: "/admin/prizes" },
];

export function AdminNav({ current }: { current: string }) {
  return (
    <nav className="mt-6 flex flex-wrap gap-x-6 gap-y-1">
      {PAGES.map((p) => (
        <Link
          key={p.href}
          href={p.href}
          aria-current={p.href === current ? "page" : undefined}
          className={
            p.href === current
              ? "font-extrabold text-[var(--paper)] underline decoration-[var(--accent)] decoration-2 underline-offset-8"
              : "font-extrabold text-[color-mix(in_srgb,var(--paper)_80%,transparent)] transition-colors hover:text-[var(--accent)]"
          }
        >
          {p.label}
        </Link>
      ))}
    </nav>
  );
}
