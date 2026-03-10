import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
    try {
        let settings = await prisma.systemSettings.findUnique({
            where: { id: "default" }
        });

        // Initialize defaults if they don't exist
        if (!settings) {
            settings = await prisma.systemSettings.create({
                data: {
                    id: "default",
                    enableStock: true
                }
            });
        }

        return NextResponse.json(settings);
    } catch (error: any) {
        return NextResponse.json({ error: error.message || "Failed to fetch settings" }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const { enableStock } = await request.json();

        // Ensure settings row exists/upsert
        const settings = await prisma.systemSettings.upsert({
            where: { id: "default" },
            update: { enableStock },
            create: { id: "default", enableStock }
        });

        return NextResponse.json(settings);
    } catch (error: any) {
        return NextResponse.json({ error: error.message || "Failed to update settings" }, { status: 500 });
    }
}
