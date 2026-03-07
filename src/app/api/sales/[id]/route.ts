import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // Use a transaction to restore stock and delete sale atomically
        await prisma.$transaction(async (tx: any) => {
            // 1. Find the sale with its items and product info
            const sale = await tx.sale.findUnique({
                where: { id },
                include: {
                    items: {
                        include: { product: true }
                    }
                }
            });

            if (!sale) throw new Error("Venta no encontrada");

            // 2. Restore stock for each item
            for (const item of sale.items) {
                const stockToRestore = item.quantity * (item.product.conversionFactor || 1);
                await tx.product.update({
                    where: { id: item.productId },
                    data: {
                        stock: {
                            increment: stockToRestore
                        }
                    }
                });
            }

            // 3. Delete SaleItems first (FK constraint)
            await tx.saleItem.deleteMany({ where: { saleId: id } });

            // 4. Delete the Sale
            await tx.sale.delete({ where: { id } });
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Delete Sale Error:", error);
        return NextResponse.json({ error: error.message || "Error al eliminar la venta" }, { status: 500 });
    }
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const sale = await prisma.sale.findUnique({
            where: { id },
            include: { items: { include: { product: true } } }
        });
        if (!sale) return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 });
        return NextResponse.json(sale);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
