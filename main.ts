import { startServer } from "./src/server.ts";
import { CONFIG } from "./src/config.ts";
import { logger } from "./src/utils.ts";

logger.info(`Starting ${CONFIG.blog.title} in ${CONFIG.env} mode...`);
logger.info(`Server will run at ${CONFIG.server.publicUrl}`);

// Start the server with configuration
startServer(CONFIG.server.port, CONFIG);
