export function getPublicAppBaseUrl() {
  const value =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL;

  if (!value) {
    return "http://localhost:3000";
  }

  const normalized = value.trim();
  if (!normalized) return "http://localhost:3000";
  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
    return normalized.replace(/\/+$/, "");
  }
  return `https://${normalized.replace(/\/+$/, "")}`;
}

export function getClientAppBaseUrl() {
  if (typeof window !== "undefined") {
    const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (configured) {
      if (configured.startsWith("http://") || configured.startsWith("https://")) {
        return configured.replace(/\/+$/, "");
      }
      return `https://${configured.replace(/\/+$/, "")}`;
    }
    return window.location.origin;
  }
  return getPublicAppBaseUrl();
}

export function publicAppUrl(pathname: string) {
  const base = getClientAppBaseUrl();
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${base}${normalizedPath}`;
}
