import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const startDateParam = searchParams.get("startDate");
        const endDateParam = searchParams.get("endDate");

        let dateFilter = {};
        if (startDateParam || endDateParam) {
            dateFilter = {
                createdAt: {
                    ...(startDateParam ? { gte: new Date(startDateParam) } : {}),
                    ...(endDateParam ? { lte: new Date(endDateParam) } : {}),
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
        const lowStockItems = await prisma.product.findMany({
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
        const lowStockCount = lowStockItems.length;

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
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            date.setHours(0, 0, 0, 0);

            const nextDay = new Date(date);
            nextDay.setDate(nextDay.getDate() + 1);

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
                day: date.toLocaleDateString('es-AR', { weekday: 'short' }),
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
