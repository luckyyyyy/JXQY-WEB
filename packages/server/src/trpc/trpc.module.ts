import {
  All,
  Controller,
  Inject,
  Injectable,
  Module,
  Req,
  Res,
  type DynamicModule,
  type Provider
} from "@nestjs/common";
// biome-ignore lint/style/useImportType: runtime value needed for NestJS DI metadata
import { ModuleRef } from "@nestjs/core";
import type { Request, Response } from "express";
import type { AnyRouter } from "@trpc/server";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { createAppRouter } from "./router.builder";

export type TrpcCreateContext = (opts: CreateExpressContextOptions) => unknown;

export const TRPC_ROUTER = Symbol("TRPC_ROUTER");
export const TRPC_CONTEXT = Symbol("TRPC_CONTEXT");

export type TrpcModuleOptions = {
  createContext: TrpcCreateContext;
};

@Injectable()
class TrpcRouterFactory {
  constructor(private readonly moduleRef: ModuleRef) {}

  createRouter(): AnyRouter {
    const moduleRef = this.moduleRef;
    return createAppRouter((routerClass) =>
      (moduleRef.get(routerClass, { strict: false }) ??
        new routerClass()) as Record<string, unknown>
    );
  }
}

@Controller("trpc")
class TrpcController {
  private readonly middleware: ReturnType<typeof createExpressMiddleware>;

  constructor(
    @Inject(TRPC_ROUTER) router: AnyRouter,
    @Inject(TRPC_CONTEXT) createContext: TrpcCreateContext
  ) {
    this.middleware = createExpressMiddleware({
      router,
      createContext
    });
  }

  @All("*trpcPath")
  handle(@Req() req: Request, @Res() res: Response) {
    return this.middleware(req, res, () => undefined);
  }
}

@Module({})
export class TrpcModule {
  private readonly _ = 0;

  static forRoot(options: TrpcModuleOptions): DynamicModule {
    const providers: Provider[] = [
      TrpcRouterFactory,
      {
        provide: TRPC_ROUTER,
        useFactory: (factory: TrpcRouterFactory) => factory.createRouter(),
        inject: [TrpcRouterFactory]
      },
      { provide: TRPC_CONTEXT, useValue: options.createContext }
    ];

    return {
      module: TrpcModule,
      controllers: [TrpcController],
      providers,
      exports: [TRPC_ROUTER, TRPC_CONTEXT]
    };
  }
}

