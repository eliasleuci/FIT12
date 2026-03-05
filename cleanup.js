const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('🔄 Iniciando limpieza de base de datos...');

    // Delete in order to respect foreign key constraints
    console.log('🗑️ Borrando ítems de venta...');
    await prisma.saleItem.deleteMany({});

    console.log('🗑️ Borrando ventas...');
    await prisma.sale.deleteMany({});

    console.log('🗑️ Borrando productos...');
    await prisma.product.deleteMany({});

    console.log('🗑️ Borrando categorías...');
    await prisma.category.deleteMany({});

    // We DO NOT delete Users to keep the admin account active.

    console.log('✅ Base de datos limpia y lista para producción.');
}

main()
    .catch((e) => {
        console.error('❌ Error durante la limpieza:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
