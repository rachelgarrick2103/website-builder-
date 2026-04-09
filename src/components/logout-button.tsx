"use client";

import { useState } from "react";
import { publicAppUrl } from "@/lib/url";

export function LogoutButton() {
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = publicAppUrl("/login");
    }
  }

  return (
    <button type="button" className="btn-secondary" onClick={logout} disabled={loading}>
      {loading ? "Signing out..." : "Sign out"}
    </button>
  );
}
