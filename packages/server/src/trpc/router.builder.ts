import type { AnyMiddlewareFunction, AnyProcedure, AnyRouter } from "@trpc/server";
import { initTRPC } from "@trpc/server";
import type { Context } from "./context";
import {
  getCtxMeta,
  getInputMeta,
  getMiddlewaresMeta,
  getProcedureMeta,
  getRouterAlias,
  getRouterRegistry,
} from "./decorators";

const t = initTRPC.context<Context>().create();

type RouterInstance = Record<string, unknown>;
type Resolver = (routerClass: new () => RouterInstance) => RouterInstance;

const applyMiddlewares = (base: typeof t.procedure, middlewares: AnyMiddlewareFunction[]) =>
  middlewares.reduce((acc, mw) => acc.use(mw), base);

const buildHandlerArgs = (
  instance: Record<string, unknown>,
  methodName: string,
  input: unknown,
  ctx: Context
) => {
  const inputMeta = getInputMeta(instance, methodName);
  const ctxMeta = getCtxMeta(instance, methodName);
  const method = instance[methodName];
  const methodLength = typeof method === "function" ? method.length : 0;
  const argCount = Math.max(
    methodLength,
    ...inputMeta.map((meta) => meta.index + 1),
    ctxMeta ? ctxMeta.index + 1 : 0
  );
  const args = Array.from({ length: argCount }).fill(undefined);

  for (const meta of inputMeta) {
    if (meta.key && input && typeof input === "object" && !Array.isArray(input)) {
      args[meta.index] = (input as Record<string, unknown>)[meta.key];
    } else {
      args[meta.index] = input;
    }
  }

  if (ctxMeta) {
    args[ctxMeta.index] = ctx;
  }

  if (inputMeta.length === 0 && argCount > 0 && ctxMeta?.index !== 0) {
    args[0] = input;
  }

  if (!ctxMeta && argCount > 1) {
    args[1] = ctx;
  }

  return args;
};

export const createAppRouter = (resolve?: Resolver): AnyRouter => {
  const routerEntries = getRouterRegistry().map((routerClass) => {
    const alias = getRouterAlias(routerClass);
    const RouterCtor = routerClass as new () => RouterInstance;
    const instance: RouterInstance = resolve ? resolve(RouterCtor) : new RouterCtor();
    const proto = Object.getPrototypeOf(instance);

    const procedures: Record<string, AnyProcedure> = {};
    for (const methodName of Object.getOwnPropertyNames(proto)) {
      if (methodName === "constructor") continue;
      const meta = getProcedureMeta(proto, methodName);
      if (!meta) continue;

      let procedure = t.procedure;
      if (meta.input) procedure = procedure.input(meta.input) as typeof procedure;
      if (meta.output) procedure = procedure.output(meta.output);

      const middlewares = getMiddlewaresMeta(proto, methodName);
      procedure = applyMiddlewares(procedure, middlewares);

      if (meta.kind === "query") {
        procedures[methodName] = procedure.query(
          ({ ctx, input }: { ctx: Context; input: unknown }) => {
            const args = buildHandlerArgs(instance, methodName, input, ctx);
            const method = instance[methodName] as (...args: unknown[]) => unknown;
            return method.apply(instance, args);
          }
        );
      }

      if (meta.kind === "mutation") {
        procedures[methodName] = procedure.mutation(
          ({ ctx, input }: { ctx: Context; input: unknown }) => {
            const args = buildHandlerArgs(instance, methodName, input, ctx);
            const method = instance[methodName] as (...args: unknown[]) => unknown;
            return method.apply(instance, args);
          }
        );
      }
    }

    return [alias, t.router(procedures)] as const;
  });

  return t.router(Object.fromEntries(routerEntries));
};
