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

            // 2. Restore stock for each item ONLY if enabled
            const rootSettings = await tx.systemSettings.findUnique({ where: { id: "default" } });
            const stockEnabled = rootSettings ? rootSettings.enableStock : true;

            if (stockEnabled) {
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

const MANUAL_STATUSES = ["pagado", "parcial", "debe", "sin_registrar"];

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const data: Record<string, unknown> = {};

        if ("paidCash" in body || "paidTransfer" in body || "paymentNote" in body) {
            const cash = Number(body.paidCash ?? 0);
            const transfer = Number(body.paidTransfer ?? 0);
            if (!Number.isFinite(cash) || !Number.isFinite(transfer) || cash < 0 || transfer < 0) {
                return NextResponse.json({ error: "Montos inválidos" }, { status: 400 });
            }
            data.paidCash = cash;
            data.paidTransfer = transfer;
            data.paymentNote = typeof body.paymentNote === "string" && body.paymentNote.trim() ? body.paymentNote.trim() : null;
            data.paymentUpdatedAt = new Date();
        }

        // null = let the status be derived automatically from the amounts paid
        if ("paymentStatus" in body) {
            if (body.paymentStatus !== null && !MANUAL_STATUSES.includes(body.paymentStatus)) {
                return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
            }
            data.paymentStatus = body.paymentStatus;
        }

        if (Object.keys(data).length === 0) {
            return NextResponse.json({ error: "Nada para actualizar" }, { status: 400 });
        }

        const sale = await prisma.sale.update({
            where: { id },
            data,
            include: { items: { include: { product: { select: { name: true } } } } }
        });

        return NextResponse.json(sale);
    } catch (error: any) {
        console.error("Update Payment Error:", error);
        return NextResponse.json({ error: error.message || "Error al actualizar el pago" }, { status: 500 });
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
