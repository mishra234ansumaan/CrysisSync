import { NextResponse } from "next/server";
import { repositoryHealth } from "@/lib/repository";
import { storageConfiguration } from "@/lib/storage";
import { pushConfiguration } from "@/lib/push";

/** Vercel healthcheck with real persistence and integration status. */
export async function GET() {
  try {
    const database = await repositoryHealth();
    return NextResponse.json({
      status: "ok",
      service: "crisissync",
      database,
      storage: storageConfiguration(),
      notifications: pushConfiguration(),
      maps: { tiles: "openstreetmap", routing: "osrm+offline", apiKeyRequired: false },
    });
  } catch (error) {
    console.error("[health]", error);
    return NextResponse.json(
      { status: "unhealthy", service: "crisissync", database: { connected: false } },
      { status: 503 }
    );
  }
}
