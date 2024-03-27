/**
 * NOTE: use https://ts-creator.js.org/ to generate long 'factory.create*' code
 * FIXME: turns out we need to provide two plugins, one for .d.ts, and one for .js
 */

import ts from "typescript";
import assert from "assert";
import type { TransformerExtras /*, PluginConfig*/ } from "ts-patch";

function getParentSymbolName(declaration: any) {
  if (declaration.parent && declaration.parent.symbol && !declaration.parent.symbol.escapedName.startsWith('"'))
    return declaration.parent.symbol.escapedName;
  return undefined;
}

const bannedTags = ["internal"];

export interface CustomOptions {
  /**
   * Use this for the "afterDeclarations" portion of the transform
   * unfortunately due to how ts-patch works today, you must specify plugins
   * that transform the js and the .d.ts outputs separately, and we can't even see
   * the non-custom plugin configuration (e.g. can't check that you set afterDeclarations)
   */
  transformType?: ".d.ts" | ".js";
  /**
   * The string to prepend to APIs marked as '@internal'
   * @default "__INTERNAL_" {@link defaultOptions}
   */
  internalPrefix?: string;
  // FIXME: not generic enough, the "warn" behavior should be a mutually exclusive option
  /**
   * The message to warn with when a consumer of the library uses an '@internal' API directly
   * The string {{name}} will be replaced with the name of the used API.
   * @default "{{name}} is an internal API and may change without notice" {@link defaultOptions}
   */
  messageTemplate?: string;
}

export const defaultOptions = {
  internalPrefix: "__INTERNAL_",
  messageTemplate: "{{name}} is an internal API and may change without notice",
} satisfies CustomOptions;

/** Changes string literal 'before' to 'after' */
export default function (
  program: ts.Program,
  // NOTE: documentation says the PluginConfig comes through here, it doesn't
  pluginConfig: CustomOptions,
  { ts }: TransformerExtras,
) {
  /*
  assert(
    pluginConfig.afterDeclarations,
    "This plugin will not function correctly if declaration transformation is not configured"
  );
  */

  assert(
    ([".js", ".d.ts"] as any[]).includes(pluginConfig.transformType),
    // FIXME: link to readme?
    `invalid transform type '${pluginConfig.transformType}', must be '.js' or '.d.ts'`
  );

  const options = { ...defaultOptions, ...pluginConfig };

  function checkJsDoc(declaration: any): boolean {
    if (!declaration || !declaration.jsDoc)
      return false;

    for (const jsDoc of declaration.jsDoc) {
      if (jsDoc.tags) {
        for (const tag of jsDoc.tags) {
          if (!bannedTags.includes(tag.tagName.escapedText)) {
            continue;
          }
          let name;
          if (declaration.kind === ts.SyntaxKind.Constructor)
            name = declaration.parent.symbol.escapedName;
          else {
            name = declaration.symbol.escapedName;
            const parentSymbol = getParentSymbolName(declaration);
            if (parentSymbol)
              name = `${parentSymbol}.${name}`;
          }

          return true;
        }
      }
    }

    return false;
  }

  return (ctx: ts.TransformationContext) => {
    const { factory } = ctx;
    const typeChecker = program.getTypeChecker();

    return (sourceFile: ts.SourceFile) => {
      function visit(node: ts.Node): ts.Node | ts.Node[] | undefined {
        if (ts.isFunctionDeclaration(node)) {
          const message = options.messageTemplate
            .replace(/(?<!\\)\{\{name}}/, `${node.name?.text}`);

          assert(node.name, "can you even export an anonymous function, and why are you marking it @internal?");

          const newName = `${options.internalPrefix}${node.name.text}`;

          const renamed = factory.createFunctionDeclaration(
            node.modifiers,
            undefined,
            newName,
            node.typeParameters,
            node.parameters,
            node.type,
            node.body,
          );

          const thunk = factory.createFunctionDeclaration(
            node.modifiers,
            undefined,
            node.name ? `${node.name.text}` : undefined,
            node.typeParameters,
            [
              factory.createParameterDeclaration(
                undefined,
                factory.createToken(ts.SyntaxKind.DotDotDotToken),
                factory.createIdentifier("args"),
                undefined,
                factory.createTypeReferenceNode(
                  // FIXME: assumes typescript is compiling with tslib enabled, should verify earlier
                  factory.createIdentifier("Parameters"),
                  [factory.createTypeQueryNode(factory.createIdentifier(newName))],
                ),
                undefined,
              ),
            ],
            node.type,
            factory.createBlock([
              factory.createExpressionStatement(
                factory.createCallExpression(
                  factory.createPropertyAccessExpression(
                    factory.createIdentifier("console"),
                    factory.createIdentifier("warn"),
                  ),
                  undefined,
                  [
                    // FIXME: better template handling
                    factory.createStringLiteral(message)
                  ],
                )
              ),
              factory.createReturnStatement(
                factory.createCallExpression(
                  factory.createIdentifier(newName),
                  undefined,
                  [factory.createSpreadElement(factory.createIdentifier('args'))],
                )
              ),
            ], true),
          );

          return [renamed, thunk];

        } else if (ts.isIdentifier(node)) {
          const resolved = typeChecker.getSymbolAtLocation(node);
          if (resolved) {
            if (checkJsDoc(resolved.valueDeclaration))
              return factory.createIdentifier(`__INTERNAL_${node.text}`);
          }
        }

        return ts.visitEachChild(node, visit, ctx);
      }

      return ts.visitNode(sourceFile, visit);
    };
  };
}

