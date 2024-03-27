import * as ts from "typescript";
import type { TransformerExtras, PluginConfig } from "ts-patch";

function getParentSymbolName(declaration: any) {
  if (declaration.parent && declaration.parent.symbol && !declaration.parent.symbol.escapedName.startsWith('"'))
    return declaration.parent.symbol.escapedName;
  return undefined;
}

const bannedTags = ["internal"];

export interface CustomOptions {
  /**
   * The string to prepend to APIs marked as '@internal'
   * @default "__INTERNAL_" {@link defaultOptions}
   */
  internalPrefix: string;
  // FIXME: not generic enough, the "warn" behavior should be a mutually exclusive option
  /**
   * The message to warn with when a consumer of the library uses an '@internal' API directly
   * The string {{name}} will be replaced with the name of the used API.
   * @default "{{name}} is an internal API and may change without notice" {@link defaultOptions}
   */
  messageTemplate: string;
}

export const defaultOptions: Required<CustomOptions> = {
  internalPrefix: "__INTERNAL_",
  messageTemplate: "{{name}} is an internal API and may change without notice",
}

/** Changes string literal 'before' to 'after' */
export default function (
  program: ts.Program,
  pluginConfig: PluginConfig & CustomOptions,
  { ts }: TransformerExtras
) {
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
            .replace(/(?<!\\)\{\{name}}/, `${node.name}`);

          return [
            factory.createFunctionDeclaration(
              node.modifiers,
              undefined,
              node.name ? `${options.internalPrefix}${node.name.text}` : undefined,
              node.typeParameters,
              node.parameters,
              node.type,
              node.body,
            ),
            factory.createFunctionDeclaration(
              node.modifiers,
              undefined,
              node.name ? `${options.internalPrefix}${node.name.text}` : undefined,
              node.typeParameters,
              node.parameters,
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
                )
              ]),
            ),
          ];
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

