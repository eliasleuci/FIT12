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
                code: body.code || null,
                categoryId: targetCategoryId,
                unitType: body.unitType,
                buyPrice: parseFloat(body.buyPrice),
                sellPrice: parseFloat(body.sellPrice),
                stock: parseFloat(body.stock),
                baseUnit: body.baseUnit,
            },
            include: { category: true }
        });

        return NextResponse.json(product);
    } catch (error) {
        console.error('Error updating product:', error);
        return NextResponse.json({ error: 'Error al actualizar el producto' }, { status: 500 });
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
