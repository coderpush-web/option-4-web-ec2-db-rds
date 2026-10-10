import { getSqlClient } from '@/app/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  let dbStatus = 'unconfigured';
  const client = getSqlClient();

  if (client) {
    try {
      await client`SELECT 1`;
      dbStatus = 'connected';
    } catch (err: any) {
      console.error('Health check DB probe error:', err?.message);
      return Response.json(
        {
          status: 'error',
          database: 'unhealthy',
          error: err?.message,
          uptime: process.uptime(),
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }
  }

  return Response.json(
    {
      status: 'ok',
      database: dbStatus,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  );
}
