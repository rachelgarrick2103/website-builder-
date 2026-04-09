export default function NotFoundPage() {
  return (
    <main className="shell flex min-h-[60vh] items-center justify-center">
      <div className="panel max-w-lg p-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">PSC Website Creator</p>
        <h1 className="mt-3 font-display text-5xl uppercase">Page not found</h1>
        <p className="mt-3 text-sm text-neutral-600">
          The page you requested is unavailable or you no longer have access to it.
        </p>
        <a className="btn-primary mt-6" href="/dashboard">
          Return to dashboard
        </a>
      </div>
    </main>
  );
}
