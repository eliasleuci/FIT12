import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
    try {
        const products = await prisma.product.findMany({
            include: { category: true }
        });
        return NextResponse.json(products);
    } catch (error) {
        return NextResponse.json({ error: "No se pudieron obtener los productos" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const data = await request.json();
        let categoryId = data.categoryId;

        // Inline category creation
        if (categoryId === "new" && data.newCategoryName) {
            const newCategory = await prisma.category.create({
                data: { name: data.newCategoryName }
            });
            categoryId = newCategory.id;
        }

        const product = await prisma.product.create({
            data: {
                name: data.name,
                categoryId: categoryId,
                unitType: data.unitType,
                buyPrice: 0,
                sellPrice: parseFloat(data.sellPrice),
                stock: 0,
                baseUnit: data.baseUnit,
                conversionFactor: parseFloat(data.conversionFactor || 1.0),
            }
        });
        return NextResponse.json(product);
    } catch (error) {
        console.error("Error creating product:", error);
        return NextResponse.json({ error: "No se pudo crear el producto" }, { status: 500 });
    }
}
