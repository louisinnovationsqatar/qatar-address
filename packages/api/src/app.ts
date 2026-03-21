import dotenv from 'dotenv';
import { buildServer } from './server.js';

dotenv.config({ path: '../../.env' });

const PORT = parseInt(process.env.PORT || '3100', 10);
const HOST = process.env.HOST || '0.0.0.0';

async function main() {
  const server = await buildServer();

  try {
    await server.listen({ port: PORT, host: HOST });
    server.log.info(`Server listening on ${HOST}:${PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    server.log.info(`Received ${signal}, shutting down gracefully...`);
    await server.close();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main();
