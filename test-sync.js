const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testSync() {
    console.log('🧪 Iniciando Test de Sincronización en Supabase...');

    try {
        // 1. Crear Categoría de Prueba
        const category = await prisma.category.create({
            data: { name: 'Test Sync' }
        });
        console.log('✅ Categoría de prueba creada.');

        // 2. Crear Producto de Prueba
        const product = await prisma.product.create({
            data: {
                name: 'Producto Test Sync',
                code: 'SYNC-001',
                categoryId: category.id,
                unitType: 'unit',
                buyPrice: 1000,
                sellPrice: 1500,
                stock: 10,
                baseUnit: 'u',
                conversionFactor: 1
            }
        });
        console.log('✅ Producto de prueba creado (Stock inicial: 10).');

        // 3. Simular Venta (2 unidades)
        const sale = await prisma.sale.create({
            data: {
                type: 'Remito',
                total: 3000,
                subtotal: 3000,
                sellerId: 'seller-1',
                items: {
                    create: {
                        productId: product.id,
                        quantity: 2,
                        price: 1500,
                        subtotal: 3000
                    }
                }
            },
            include: { items: true }
        });
        console.log('✅ Venta registrada (2 unidades a $1500 c/u).');

        // 4. Actualizar Stock del Producto
        await prisma.product.update({
            where: { id: product.id },
            data: { stock: { decrement: 2 } }
        });
        console.log('✅ Stock actualizado en la base de datos.');

        // 5. Verificar Integridad
        const updatedProduct = await prisma.product.findUnique({ where: { id: product.id } });
        console.log(`📊 Stock final en BD: ${updatedProduct.stock} (Esperado: 8)`);

        if (updatedProduct.stock === 8) {
            console.log('✨ ¡ÉXITO! La sincronización de datos es correcta.');
        } else {
            console.error('❌ ERROR: El stock no coincide.');
        }

        // 6. Limpieza de Test
        await prisma.saleItem.deleteMany({ where: { productId: product.id } });
        await prisma.sale.delete({ where: { id: sale.id } });
        await prisma.product.delete({ where: { id: product.id } });
        await prisma.category.delete({ where: { id: category.id } });
        console.log('🗑️ Datos de prueba eliminados.');

    } catch (error) {
        console.error('❌ Error durante el test:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testSync();
