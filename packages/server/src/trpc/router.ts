// Import all modules to register their routers
import "../modules";
import { createAppRouter } from "./router.builder";

export const appRouter = createAppRouter();

export type AppRouter = typeof appRouter;
