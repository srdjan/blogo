import { startServer } from "./src/server.ts";
import { CONFIG } from "./src/config.ts";

console.log(`Starting ${CONFIG.blog.title} in ${CONFIG.env} mode...`);
console.log(`Server will run at ${CONFIG.server.publicUrl}`);

// Start the server with hardcoded config
startServer(CONFIG.server.port, CONFIG);
