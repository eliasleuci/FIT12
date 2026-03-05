import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
    try {
        // Try a simple query to verify the DB connection
        await prisma.$queryRaw`SELECT 1`;
        return NextResponse.json({
            status: '✅ OK',
            database: 'Conectado a Supabase correctamente',
            timestamp: new Date().toISOString(),
            env: process.env.DATABASE_URL ? '✅ DATABASE_URL configurada' : '❌ DATABASE_URL NO encontrada'
        });
    } catch (error: any) {
        return NextResponse.json({
            status: '❌ ERROR',
            database: 'No se pudo conectar a la base de datos',
            error: error?.message || 'Error desconocido',
            env: process.env.DATABASE_URL ? '✅ DATABASE_URL configurada' : '❌ DATABASE_URL NO encontrada',
            timestamp: new Date().toISOString()
        }, { status: 500 });
    }
}
