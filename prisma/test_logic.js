const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const http = require('http');

async function testSale() {
    console.log('--- STARTING LOGIC TEST ---');

    // 1. Get initial product state
    const productBefore = await prisma.product.findUnique({ where: { code: 'FS-001' } });
    console.log(`Initial Stock (Nueces): ${productBefore.stock} ${productBefore.baseUnit}`);

    // 2. Perform Sale via API
    const saleData = JSON.stringify({
        type: 'Invoice',
        sellerId: 'seller-1',
        items: [{
            productId: productBefore.id,
            name: 'Nueces',
            price: 12000,
            quantity: 0.5, // 0.5kg
            subtotal: 6000
        }]
    });

    const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/sales',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': saleData.length
        }
    };

    const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', async () => {
            console.log('API Response:', data);

            // 3. Verify stock after sale
            const productAfter = await prisma.product.findUnique({ where: { code: 'FS-001' } });
            console.log(`Final Stock (Nueces): ${productAfter.stock} ${productAfter.baseUnit}`);

            const expectedStock = productBefore.stock - (0.5 * productBefore.conversionFactor);
            if (productAfter.stock === expectedStock) {
                console.log('SUCCESS: Stock deduction logic is CORRECT!');
            } else {
                console.log(`FAILURE: Expected ${expectedStock}, got ${productAfter.stock}`);
            }
            process.exit(0);
        });
    });

    req.on('error', (e) => {
        console.error(`Problem with request: ${e.message}`);
        process.exit(1);
    });

    req.write(saleData);
    req.end();
}

testSale();
