import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const startDateParam = searchParams.get("startDate");
        const endDateParam = searchParams.get("endDate");

        let dateFilter = {};
        if (startDateParam || endDateParam) {
            const start = startDateParam ? new Date(`${startDateParam}T00:00:00-03:00`) : null;
            const end = endDateParam ? new Date(`${endDateParam}T23:59:59.999-03:00`) : null;

            dateFilter = {
                createdAt: {
                    ...(start ? { gte: start } : {}),
                    ...(end ? { lte: end } : {}),
                }
            };
        }

        // 1. Basic Stats with filter
        const sales = await prisma.sale.findMany({
            where: dateFilter,
            include: {
                items: {
                    include: {
                        product: true
                    }
                }
            }
        });

        const totalRevenue = sales.reduce((acc: number, sale: any) => acc + sale.total, 0);
        const salesCount = sales.length;

        let totalProfit = 0;
        sales.forEach((sale: any) => {
            sale.items.forEach((item: any) => {
                const product = item.product;
                const profitPerUnit = item.price - product.buyPrice;
                totalProfit += item.quantity * profitPerUnit;
            });
        });

        // 2. Low Stock Items
        const rootSettings = await prisma.systemSettings.findUnique({ where: { id: "default" } });
        const stockEnabled = rootSettings ? rootSettings.enableStock : true;

        let lowStockItems: any[] = [];
        let lowStockCount = 0;

        if (stockEnabled) {
            lowStockItems = await prisma.product.findMany({
                where: {
                    stock: {
                        lt: 1000 // Less than 1kg or 1000 units
                    }
                },
                select: {
                    id: true,
                    name: true,
                    stock: true,
                    unitType: true,
                    baseUnit: true,
                    category: {
                        select: { name: true }
                    }
                }
            });
            lowStockCount = lowStockItems.length;
        }

        // 3. Top Products with filter
        const topProductsRaw = await prisma.saleItem.groupBy({
            by: ['productId'],
            where: {
                sale: dateFilter
            },
            _sum: {
                quantity: true,
                subtotal: true
            },
            orderBy: {
                _sum: {
                    subtotal: 'desc'
                }
            },
            take: 5
        });

        const topProducts = await Promise.all(topProductsRaw.map(async (item: any) => {
            const product = await prisma.product.findUnique({
                where: { id: item.productId }
            });
            return {
                name: product?.name,
                quantity: item._sum.quantity,
                revenue: item._sum.subtotal
            };
        }));

        // 4. Daily Sales (Last 7 days)
        const dailyData = [];
        const argNow = new Date(Date.now() - 3 * 3600000); // Argentina is UTC-3
        const year = argNow.getUTCFullYear();
        const month = argNow.getUTCMonth();
        const day = argNow.getUTCDate();
        
        const weekdays = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

        for (let i = 6; i >= 0; i--) {
            // Midnight Argentina time is 03:00:00 UTC
            const date = new Date(Date.UTC(year, month, day - i, 3, 0, 0, 0));
            const nextDay = new Date(Date.UTC(year, month, day - i + 1, 3, 0, 0, 0));

            const daySales = await prisma.sale.findMany({
                where: {
                    createdAt: {
                        gte: date,
                        lt: nextDay
                    }
                }
            });

            const dayTotal = daySales.reduce((acc: number, s: any) => acc + s.total, 0);
            dailyData.push({
                day: weekdays[date.getUTCDay()],
                total: dayTotal
            });
        }

        return NextResponse.json({
            revenue: totalRevenue,
            profit: totalProfit,
            salesCount,
            lowStockCount,
            lowStockItems,
            topProducts,
            dailyData
        });

    } catch (error: any) {
        console.error("Stats API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
