import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const startDateParam = searchParams.get("startDate");
        const endDateParam = searchParams.get("endDate");

        let dateFilter = {};
        if (startDateParam || endDateParam) {
            const start = startDateParam ? new Date(startDateParam) : null;
            if (start) start.setUTCHours(0, 0, 0, 0);

            const end = endDateParam ? new Date(endDateParam) : null;
            if (end) end.setUTCHours(23, 59, 59, 999);

            dateFilter = {
                createdAt: {
                    ...(start ? { gte: start } : {}),
                    ...(end ? { lte: end } : {}),
                }
            };
        }

        const sales = await prisma.sale.findMany({
            where: dateFilter,
            include: {
                items: {
                    include: { product: { select: { name: true } } }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 50
        });

        return NextResponse.json(sales);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}



export async function POST(request: Request) {
    try {
        const { type, items, sellerId, customerName, customerPhone, customerAddress } = await request.json();

        // Calculate totals
        const subtotal = items.reduce((acc: number, item: any) => acc + item.subtotal, 0);
        const tax = 0; // Optional tax logic here
        const total = subtotal + tax;

        // Use a transaction to ensure all-or-nothing stock deduction
        const result = await prisma.$transaction(async (tx: any) => {

            // 1. Create the Sale
            const sale = await tx.sale.create({
                data: {
                    type,
                    subtotal,
                    total,
                    tax,
                    sellerId,
                    customerName,
                    customerPhone,
                    customerAddress,
                    items: {
                        create: items.map((item: any) => ({
                            productId: item.productId,
                            quantity: parseFloat(item.quantity),
                            price: parseFloat(item.price),
                            subtotal: parseFloat(item.subtotal),
                        }))
                    }
                },
                include: { items: true }
            });

            // 2. Update Stock for each item
            for (const item of items) {
                const product = await tx.product.findUnique({ where: { id: item.productId } });
                if (!product) throw new Error(`Producto ${item.productId} no encontrado`);

                // Fractional logic: quantity is sold in unitType, but stock is in baseUnit
                // If sold in Kg but controlled in G, conversionFactor is 1000.
                // stockToRemove = soldQuantity * conversionFactor
                const stockToRemove = parseFloat(item.quantity) * (product.conversionFactor || 1);

                await tx.product.update({
                    where: { id: item.productId },
                    data: {
                        stock: {
                            decrement: stockToRemove
                        }
                    }
                });
            }

            return sale;
        });

        return NextResponse.json(result);
    } catch (error: any) {
        console.error("Sale Error:", error);
        return NextResponse.json({ error: error.message || "Error al procesar la venta" }, { status: 500 });
    }
}
