import "reflect-metadata";
import type { AnyMiddlewareFunction } from "@trpc/server";
import type { ZodTypeAny } from "zod";

export type ProcedureKind = "query" | "mutation";

export type ProcedureMeta = {
  kind: ProcedureKind;
  input?: ZodTypeAny;
  output?: ZodTypeAny;
  middlewares?: AnyMiddlewareFunction[];
};

export type InputMeta = { index: number; key?: string };
export type CtxMeta = { index: number };

const ROUTER_META = Symbol("TRPC_ROUTER_META");
const PROCEDURE_META = Symbol("TRPC_PROCEDURE_META");
const MIDDLEWARE_META = Symbol("TRPC_MIDDLEWARE_META");
const INPUT_META = Symbol("TRPC_INPUT_META");
const CTX_META = Symbol("TRPC_CTX_META");

export type RouterClass = new (...args: unknown[]) => object;

const ROUTER_REGISTRY: RouterClass[] = [];

export const getRouterRegistry = () => ROUTER_REGISTRY;

export const getRouterAlias = (target: RouterClass) =>
  (Reflect.getMetadata(ROUTER_META, target) as string | undefined) ??
  target.name;

export const getProcedureMeta = (target: object, key: string | symbol) =>
  Reflect.getMetadata(PROCEDURE_META, target, key) as ProcedureMeta | undefined;

export const getMiddlewaresMeta = (target: object, key: string | symbol) =>
  (Reflect.getMetadata(MIDDLEWARE_META, target, key) as
    | AnyMiddlewareFunction[]
    | undefined) ?? [];

export const getInputMeta = (target: object, key: string | symbol) =>
  (Reflect.getMetadata(INPUT_META, target, key) as InputMeta[] | undefined) ??
  [];

export const getCtxMeta = (target: object, key: string | symbol) =>
  (Reflect.getMetadata(CTX_META, target, key) as CtxMeta | undefined) ??
  undefined;

export const Router = (options?: { alias?: string }) => (target: RouterClass) => {
  if (!ROUTER_REGISTRY.includes(target)) {
    ROUTER_REGISTRY.push(target);
  }
  Reflect.defineMetadata(ROUTER_META, options?.alias ?? target.name, target);
};

export const Query = (options?: { input?: ZodTypeAny; output?: ZodTypeAny }) =>
  (target: object, key: string | symbol) => {
    Reflect.defineMetadata(
      PROCEDURE_META,
      {
        kind: "query",
        input: options?.input,
        output: options?.output
      } satisfies ProcedureMeta,
      target,
      key
    );
  };

export const Mutation = (
  options?: { input?: ZodTypeAny; output?: ZodTypeAny }
) =>
  (target: object, key: string | symbol) => {
    Reflect.defineMetadata(
      PROCEDURE_META,
      {
        kind: "mutation",
        input: options?.input,
        output: options?.output
      } satisfies ProcedureMeta,
      target,
      key
    );
  };

export const UseMiddlewares = (...middlewares: AnyMiddlewareFunction[]) =>
  (target: object, key: string | symbol) => {
    const existing = getMiddlewaresMeta(target, key);
    Reflect.defineMetadata(
      MIDDLEWARE_META,
      [...existing, ...middlewares],
      target,
      key
    );
  };

export const Input = (key?: string) =>
  (target: object, propertyKey: string | symbol, parameterIndex: number) => {
    const existing = getInputMeta(target, propertyKey);
    Reflect.defineMetadata(
      INPUT_META,
      [...existing, { index: parameterIndex, key }],
      target,
      propertyKey
    );
  };

export const Ctx = () =>
  (target: object, propertyKey: string | symbol, parameterIndex: number) => {
    Reflect.defineMetadata(CTX_META, { index: parameterIndex }, target, propertyKey);
  };
