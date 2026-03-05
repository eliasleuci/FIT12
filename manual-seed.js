const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('🔄 Iniciando carga del usuario admin en Supabase...');

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

    console.log('✅ Usuario admin creado/verificado correctamente.');
}

main()
    .catch((e) => {
        console.error('❌ Error durante el seeding:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
