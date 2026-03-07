import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();

        let targetCategoryId = body.categoryId;

        if (targetCategoryId === 'new' && body.newCategoryName) {
            const newCategory = await prisma.category.create({
                data: { name: body.newCategoryName }
            });
            targetCategoryId = newCategory.id;
        }

        const product = await prisma.product.update({
            where: { id },
            data: {
                name: body.name,
                categoryId: targetCategoryId,
                unitType: body.unitType,
                sellPrice: parseFloat(body.sellPrice) || 0,
                buyPrice: parseFloat(body.buyPrice || 0),
                stock: parseFloat(body.stock ?? 0) || 0,
                baseUnit: body.baseUnit,
                conversionFactor: parseFloat(body.conversionFactor || 1.0) || 1.0,
            },
            include: { category: true }
        });

        return NextResponse.json(product);
    } catch (error: any) {
        console.error('Error updating product:', {
            id: (await params).id,
            error: error.message,
            stack: error.stack
        });
        return NextResponse.json({
            error: 'Error al actualizar el producto',
            details: error.message
        }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // First delete associated SaleItems to avoid FK constraint errors
        await prisma.saleItem.deleteMany({
            where: { productId: id }
        });

        await prisma.product.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting product:', error);
        return NextResponse.json({ error: 'Error al eliminar el producto: ' + (error?.message || '') }, { status: 500 });
    }
}
