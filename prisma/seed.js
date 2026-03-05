const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // 0. Create Default User
    await prisma.user.upsert({
        where: { id: 'seller-1' },
        update: {},
        create: {
            id: 'seller-1',
            username: 'admin',
            password: 'admin-password',
            role: 'admin'
        }
    });

    // 1. Create Categories (Comentado para producción)
    /*
    const catFrutosSecos = await prisma.category.upsert({
        where: { name: 'Frutos Secos' },
        update: {},
        create: { name: 'Frutos Secos' },
    });

    const catHarinas = await prisma.category.upsert({
        where: { name: 'Harinas' },
        update: {},
        create: { name: 'Harinas' },
    });

    // 2. Create Products
    // Product 1: Sold by Kg, Controlled in G (Fractional)
    await prisma.product.upsert({
        where: { code: 'FS-001' },
        update: {},
        create: {
            name: 'Nueces Mariposa',
            code: 'FS-001',
            categoryId: catFrutosSecos.id,
            unitType: 'kg',
            buyPrice: 8000,
            sellPrice: 12000,
            stock: 5000, // 5kg = 5000g
            baseUnit: 'g',
            conversionFactor: 1000,
        },
    });

    // Product 2: Sold by Unit, Controlled in Unit
    await prisma.product.upsert({
        where: { code: 'HA-001' },
        update: {},
        create: {
            name: 'Harina de Almendras 500g',
            code: 'HA-001',
            categoryId: catHarinas.id,
            unitType: 'unit',
            buyPrice: 3000,
            sellPrice: 4500,
            stock: 20,
            baseUnit: 'unit',
            conversionFactor: 1,
        },
    });
    */

    console.log('Seed exitoso');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
