import { startServer } from "./src/server.ts";
import { loadConfig } from "./src/config.ts";
import { match } from "./src/error.ts";

const configResult = await loadConfig();

// Match on the configuration result
await match(configResult, {
  ok: async (config) => {
    console.log(`Starting ${config.blog.title} in ${config.env} mode...`);
    console.log(`Server will run at ${config.server.publicUrl}`);

    // Start the server with config
    await startServer(config.server.port, config);
  },
  error: (error) => {
    console.error("Failed to start server:");
    console.error(error.message);

    if (error.cause) {
      console.error("Cause:", error.cause);
    }

    Deno.exit(1);
  },
});