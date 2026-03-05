import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
    try {
        const categories = await prisma.category.findMany();
        return NextResponse.json(categories);
    } catch (error) {
        return NextResponse.json({ error: "No se pudieron obtener las categorías" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const data = await request.json();
        const category = await prisma.category.create({
            data: { name: data.name }
        });
        return NextResponse.json(category);
    } catch (error) {
        return NextResponse.json({ error: "No se pudo crear la categoría" }, { status: 500 });
    }
}
