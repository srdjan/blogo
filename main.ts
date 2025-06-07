import { App } from "@srdjan/mixon";
import { CONFIG } from "./src/config.ts";
import { logger } from "./src/utils.ts";
import { setupBlogRoutes } from "./src/routes.ts";
import { loggerMiddleware, corsMiddleware, debugMiddleware } from "./src/middleware.ts";

logger.info(`Starting ${CONFIG.blog.title} in ${CONFIG.env} mode...`);
logger.info(`Server will run at ${CONFIG.server.publicUrl}`);

// Create Mixon app instance
const app = App();

// Add middleware
app.use(loggerMiddleware);
app.use(debugMiddleware); // Add debug middleware
app.use(corsMiddleware);

// Setup all blog routes
setupBlogRoutes(app, CONFIG);

// Start the server
logger.info(`Starting server on port ${CONFIG.server.port}...`);
app.listen(CONFIG.server.port);
