import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import chokidar from "chokidar";
import {
  ClassDeclaration,
  MethodDeclaration,
  ObjectLiteralExpression,
  Project,
  SourceFile,
  SyntaxKind
} from "ts-morph";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const modulesDir = path.resolve(rootDir, "src/modules");
const outFile = path.resolve(rootDir, "src/trpc/@generated/app-router.ts");

const toPosix = (value: string) => value.split(path.sep).join("/");

const camelCase = (value: string) =>
  value
    .replace(/^[A-Z]/, (char) => char.toLowerCase())
    .replace(/[-_](\w)/g, (_, char: string) => char.toUpperCase());

const getDecoratorArgObject = (
  decoratorName: string,
  node: MethodDeclaration
): ObjectLiteralExpression | null => {
  const decorator = node.getDecorator(decoratorName);
  if (!decorator) return null;
  const callExpr = decorator.getCallExpression();
  if (!callExpr) return null;
  const [arg] = callExpr.getArguments();
  if (!arg || !arg.isKind(SyntaxKind.ObjectLiteralExpression)) return null;
  return arg;
};

const getRouterAlias = (classDecl: ClassDeclaration) => {
  const decorator = classDecl.getDecorator("Router");
  if (!decorator) return null;
  const callExpr = decorator.getCallExpression();
  if (!callExpr) return null;
  const [arg] = callExpr.getArguments();
  if (!arg || !arg.isKind(SyntaxKind.ObjectLiteralExpression)) return null;
  const aliasProp = arg.getProperty("alias");
  if (!aliasProp || !aliasProp.isKind(SyntaxKind.PropertyAssignment)) return null;
  const initializer = aliasProp.getInitializer();
  if (!initializer) return null;
  if (initializer.isKind(SyntaxKind.StringLiteral)) {
    return initializer.getLiteralText();
  }
  return initializer.getText();
};

const extractIdentifiers = (expression: string): string[] => {
  // Extract base identifiers from expressions like:
  // - TestRequirementListQuerySchema.optional()
  // - z.object({ id: z.string() })
  // - TestRequirementSchema.nullable()
  const identifiers: string[] = [];

  // Match all capital-starting identifiers (likely schemas/types)
  const schemaMatches = expression.matchAll(/\b([A-Z][a-zA-Z0-9]*)\b/g);
  for (const match of schemaMatches) {
    identifiers.push(match[1]);
  }

  // Match all lowercase identifiers that could be exported constants
  const constMatches = expression.matchAll(/\b([a-z][a-zA-Z0-9]*(?:Input|Output|Schema))\b/g);
  for (const match of constMatches) {
    identifiers.push(match[1]);
  }

  // Also check for 'z' from zod
  if (/\bz\b/.test(expression)) {
    identifiers.push('z');
  }

  return Array.from(new Set(identifiers));
};

const collectImports = (
  sourceFile: SourceFile,
  expressionTexts: string[],
  importMap: Map<string, Set<string>>
) => {
  const allIdentifiers = new Set<string>();
  for (const expr of expressionTexts) {
    const identifiers = extractIdentifiers(expr);
    for (const id of identifiers) {
      allIdentifiers.add(id);
    }
  }

  for (const identifier of allIdentifiers) {
    // Check if it's exported from the router file itself
    const exportDecl = sourceFile.getVariableDeclaration(identifier);
    if (exportDecl && exportDecl.isExported()) {
      const declSource = exportDecl.getSourceFile();
      const modulePath = toPosix(
        path
          .relative(path.dirname(outFile), declSource.getFilePath())
          .replace(/\.ts$/, "")
      );
      const spec = modulePath.startsWith(".") ? modulePath : `./${modulePath}`;
      const set = importMap.get(spec) ?? new Set<string>();
      set.add(identifier);
      importMap.set(spec, set);
      continue;
    }

    // Check if it's imported from another module
    for (const importDecl of sourceFile.getImportDeclarations()) {
      const namedImports = importDecl.getNamedImports();
      let importEntry: string | null = null;

      for (const ni of namedImports) {
        const aliasNode = ni.getAliasNode();
        // localName = alias if present, otherwise the original name
        const localName = aliasNode ? aliasNode.getText() : ni.getName();
        if (localName === identifier) {
          // Preserve alias in generated import so the expression text stays valid
          importEntry = aliasNode
            ? `${ni.getName()} as ${aliasNode.getText()}`
            : ni.getName();
          break;
        }
      }

      if (importEntry) {
        const moduleSpec = importDecl.getModuleSpecifierValue();
        const set = importMap.get(moduleSpec) ?? new Set<string>();
        set.add(importEntry);
        importMap.set(moduleSpec, set);
        break;
      }
    }
  }
};

const generateTypes = () => {
  const project = new Project({
    tsConfigFilePath: path.resolve(rootDir, "tsconfig.json")
  });

  const routers = project.getSourceFiles(`${modulesDir}/**/*.router.ts`);
  const importMap = new Map<string, Set<string>>();
  const routerEntries: string[] = [];

  for (const sourceFile of routers) {
    const classes = sourceFile.getClasses();
    for (const classDecl of classes) {
      if (!classDecl.getDecorator("Router")) continue;
      const alias =
        getRouterAlias(classDecl) ?? camelCase(classDecl.getName() ?? "router");
      const procedures: string[] = [];

      for (const method of classDecl.getMethods()) {
        const queryMeta = getDecoratorArgObject("Query", method);
        const mutationMeta = getDecoratorArgObject("Mutation", method);
        const decorator = queryMeta ? "query" : mutationMeta ? "mutation" : null;
        const meta = queryMeta ?? mutationMeta;
        if (!decorator || !meta) continue;

        const inputProp = meta.getProperty("input");
        const outputProp = meta.getProperty("output");
        const inputValue = inputProp?.isKind(SyntaxKind.PropertyAssignment)
          ? inputProp.getInitializer()?.getText()
          : undefined;
        const outputValue = outputProp?.isKind(SyntaxKind.PropertyAssignment)
          ? outputProp.getInitializer()?.getText()
          : undefined;

        const expressions: string[] = [];
        if (inputValue) expressions.push(inputValue);
        if (outputValue) expressions.push(outputValue);

        collectImports(sourceFile, expressions, importMap);

        const parts: string[] = ["t.procedure"];
        if (inputValue) parts.push(`input(${inputValue})`);
        if (outputValue) parts.push(`output(${outputValue})`);
        parts.push(`${decorator}(async () => \"PLACEHOLDER_DO_NOT_REMOVE\" as any)`);

        procedures.push(`${method.getName()}: ${parts.join(".")}`);
      }

      routerEntries.push(`${alias}: t.router({ ${procedures.join(",\n")} })`);
    }
  }

  const imports = Array.from(importMap.entries())
    .map(([specifier, names]) => {
      const named = Array.from(names).sort().join(", ");
      return `import { ${named} } from \"${specifier}\";`;
    })
    .join("\n");

  const content = `/**
 * THIS FILE IS AUTO-GENERATED. DO NOT EDIT MANUALLY.
 *
 * Generated by scripts/generate-trpc-types.ts
 * Run 'pnpm generate:trpc' to regenerate this file.
 */

import { initTRPC } from \"@trpc/server\";
import type { Context } from \"../context\";
${imports}

const t = initTRPC.context<Context>().create();

const appRouter = t.router({
${routerEntries.join(",\n")}
});

export type AppRouter = typeof appRouter;
`;

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, content);
};

const isWatch = process.argv.includes("--watch");

if (!isWatch) {
  generateTypes();
  process.exit(0);
}

let timeout: NodeJS.Timeout | null = null;
const trigger = () => {
  if (timeout) clearTimeout(timeout);
  timeout = setTimeout(() => {
    generateTypes();
  }, 150);
};

generateTypes();
chokidar
  .watch([modulesDir, path.resolve(rootDir, "src/trpc/decorators.ts")], {
    ignoreInitial: true
  })
  .on("add", trigger)
  .on("change", trigger)
  .on("unlink", trigger);
