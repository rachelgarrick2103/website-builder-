import { NextResponse } from "next/server";
import type { User } from "@prisma/client";
import { db } from "@/lib/db";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function getOwnedProject(projectId: string, user: User) {
  return db.project.findFirst({
    where: {
      id: projectId,
      userId: user.id,
    },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
      },
      assets: {
        orderBy: { createdAt: "desc" },
      },
      versions: {
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

export function buildPreviewDocument(html: string, css: string, js: string) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <style>${css}</style>
</head>
<body>
${html}
<script>${js}</script>
</body>
</html>`;
}
