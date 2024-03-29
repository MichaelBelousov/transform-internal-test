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
  /**
   * Whether to delete the replacement, meaning the output will not have the internal functions
   * accessible by name at all
   * @default false
   */
  deleteReplacement?: boolean;
  /**
   * JSDoc tags to consider as marking an API as internal.
   * @default ["internal"] {@link defaultOptions}
   */
  internalMarkTags?: string[];
}

export const defaultOptions = {
  internalPrefix: "__INTERNAL_",
  messageTemplate: "{{name}} is an internal API and may change without notice",
  internalMarkTags: ["internal"],
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
    if (!declaration) return false;

    const tags = declaration.getJsDocTags?.()
      ?? (declaration.jsDoc as any[])?.flatMap((j) => j.tags);

    if (!tags) return false;

    return tags.some((tag: any) => options.internalMarkTags.includes(tag.name || tag.tagName?.escapedText));
  }

  return (ctx: ts.TransformationContext) => {
    const { factory: f } = ctx;
    const typeChecker = program.getTypeChecker();

    return (sourceFile: ts.SourceFile) => {
      function visit(node: ts.Node): ts.Node | ts.Node[] | undefined {
        // HACK: `do {} while(false)` so we can break out early to the single exit
        do {
          if (ts.isFunctionDeclaration(node)) {
            assert(node.name, "can you even export an anonymous function, and why are you marking it @internal?");

            const resolved = typeChecker.getSymbolAtLocation(node.name);

            if (!resolved || !checkJsDoc(resolved.valueDeclaration))
              break;

            const message = options.messageTemplate
              .replace(/(?<!\\)\{\{name}}/, `${node.name?.text}`);

            const newName = `${options.internalPrefix}${node.name.text}`;

            const renamed = f.createFunctionDeclaration(
              node.modifiers,
              undefined,
              newName,
              node.typeParameters,
              node.parameters,
              node.type,
              node.body,
            );

            if (pluginConfig.deleteReplacement) {
              return [renamed];
            }

            const replacement = f.createFunctionDeclaration(
              node.modifiers,
              undefined,
              node.name.text,
              node.typeParameters,
              [
                f.createParameterDeclaration(
                  undefined,
                  f.createToken(ts.SyntaxKind.DotDotDotToken),
                  f.createIdentifier("args"),
                  undefined,
                  f.createTypeReferenceNode(
                    // FIXME: assumes typescript is compiling with tslib enabled, should verify earlier
                    f.createIdentifier("Parameters"),
                    [f.createTypeQueryNode(f.createIdentifier(newName))],
                  ),
                  undefined,
                ),
              ],
              node.type,
              pluginConfig.transformType === ".js" 
                ? f.createBlock([
                    f.createExpressionStatement(
                      f.createCallExpression(
                        f.createPropertyAccessExpression(
                          f.createIdentifier("console"),
                          f.createIdentifier("warn"),
                        ),
                        undefined,
                        [
                          // FIXME: better template handling
                          f.createStringLiteral(message)
                        ],
                      )
                    ),
                    f.createReturnStatement(
                      f.createCallExpression(
                        f.createIdentifier(newName),
                        // FIXME: should forward the type parameters here
                        undefined,
                        [f.createSpreadElement(f.createIdentifier('args'))],
                      )
                    ),
                  ], true)
                : undefined,
            );

            return [renamed, replacement];

            // FIXME: note that
            // ```
            // export const { x } = { x: 10 }; is not supported by this
            // ```
            // I'm not sure that is even exportable but am too lazy to check atm
            // FIXME: emit a custom diagnostic?
          } else if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
            const resolved = typeChecker.getSymbolAtLocation(node.name);

            if (!resolved || !checkJsDoc(resolved))
              break;

            const newName = `${options.internalPrefix}${node.name.text}`;

            const message = options.messageTemplate
              .replace(/(?<!\\)\{\{name}}/, `${node.name.text}`);

            const renamed = f.createVariableDeclaration(
              f.createIdentifier(newName),
              undefined,
              node.type,
              node.initializer,
            );

            if (pluginConfig.deleteReplacement) {
              return [renamed];
            }

            const reexport = `
              export const ${node.name.text} = ${node.getFullText()}
            `;

            // this probably doesn't work
            /*
            ts.updateSourceFile(
              node.getSourceFile(),
              reexport,
              {
                span: {
                  start: 0,
                  length: 0,
                },
                newLength: reexport.length,
              },
              true
            );
            */

            f.updateSourceFile(
              node.getSourceFile(),
              [
                f.createVariableStatement(
                  undefined, // FIXME: export
                  f.createVariableDeclarationList(
                    [
                      f.createVariableDeclaration(
                        `exports.${newName}`,
                        undefined,
                        undefined,
                      ),
                    ]
                  )
                ),
                ...node.getSourceFile().statements,
              ]
            );

            const replacement = f.createVariableDeclaration(
              f.createIdentifier(node.name.text),
              undefined,
              // FIXME: this doesn't give a type in the case of a (const) initializer
              node.type,
              options.transformType === ".js"
              ? f.createNewExpression(f.createIdentifier('Proxy'), undefined, [
                  f.createPropertyAccessExpression(
                    f.createIdentifier("exports"),
                    f.createIdentifier(newName),
                  ),
                  // NOTE: I think it will be better to dynamically generate this to support custom user
                  // warning APIs and to be generally terser
                  f.createObjectLiteralExpression(
                    [
                      f.createMethodDeclaration(
                        undefined,
                        undefined,
                        f.createIdentifier('get'),
                        undefined,
                        undefined,
                        [
                          f.createParameterDeclaration(undefined, undefined, f.createIdentifier('obj')),
                          f.createParameterDeclaration(undefined, undefined, f.createIdentifier('key')),
                          f.createParameterDeclaration(undefined, undefined, f.createIdentifier('recv')),
                        ],
                        undefined,
                        f.createBlock(
                          [
                            f.createExpressionStatement(
                              f.createCallExpression(
                                f.createPropertyAccessExpression(f.createIdentifier('console'), f.createIdentifier('warn')),
                                undefined,
                                [f.createStringLiteral(message)]
                              )
                            ),
                            f.createReturnStatement(
                              f.createCallExpression(
                                f.createPropertyAccessExpression(
                                  f.createIdentifier('Reflect'),
                                  f.createIdentifier('get')
                                ),
                                undefined,
                                [
                                  f.createIdentifier('obj'),
                                  f.createIdentifier('key'),
                                  f.createIdentifier('recv')
                                ]
                              )
                            )
                          ],
                          true
                        )
                      ),
                      f.createMethodDeclaration(
                        undefined,
                        undefined,
                        f.createIdentifier('construct'),
                        undefined,
                        undefined,
                        [
                          f.createParameterDeclaration(undefined, undefined, f.createIdentifier('obj')),
                          f.createParameterDeclaration(undefined, undefined, f.createIdentifier('args')),
                          f.createParameterDeclaration(undefined, undefined, f.createIdentifier('newTarget')),
                        ],
                        undefined,
                        f.createBlock(
                          [
                            f.createExpressionStatement(
                              f.createCallExpression(
                                f.createPropertyAccessExpression(f.createIdentifier('console'), f.createIdentifier('warn')),
                                undefined,
                                [f.createStringLiteral(message)]
                              )
                            ),
                            f.createReturnStatement(
                              f.createCallExpression(
                                f.createPropertyAccessExpression(
                                  f.createIdentifier('Reflect'),
                                  f.createIdentifier('construct')
                                ),
                                undefined,
                                [
                                  f.createIdentifier('obj'),
                                  f.createIdentifier('args'),
                                  f.createIdentifier('newTarget')
                                ]
                              )
                            )
                          ],
                          true
                        )
                      ),
                      f.createMethodDeclaration(
                        undefined,
                        undefined,
                        f.createIdentifier('apply'),
                        undefined,
                        undefined,
                        [
                          f.createParameterDeclaration(undefined, undefined, f.createIdentifier('obj')),
                          f.createParameterDeclaration(undefined, undefined, f.createIdentifier('_this')),
                          f.createParameterDeclaration(undefined, undefined, f.createIdentifier('args')),
                        ],
                        undefined,
                        f.createBlock(
                          [
                            f.createExpressionStatement(
                              f.createCallExpression(
                                f.createPropertyAccessExpression(f.createIdentifier('console'), f.createIdentifier('warn')),
                                undefined,
                                [f.createStringLiteral(message)]
                              )
                            ),
                            f.createReturnStatement(
                              f.createCallExpression(
                                f.createPropertyAccessExpression(
                                  f.createIdentifier('Reflect'),
                                  f.createIdentifier('apply')
                                ),
                                undefined,
                                [
                                  f.createIdentifier('obj'),
                                  f.createIdentifier('_this'),
                                  f.createIdentifier('args')
                                ]
                              )
                            )
                          ],
                          true
                        )
                      ),
                    ],
                    false
                  )
                ])
              : undefined
            );

            return [renamed, replacement];

          } else if (ts.isIdentifier(node)) {
            const resolved = typeChecker.getSymbolAtLocation(node);
            if (resolved) {
              if (checkJsDoc(resolved.valueDeclaration))
                return f.createIdentifier(`__INTERNAL_${node.text}`);
            }
          }
        } while (false);

        return ts.visitEachChild(node, visit, ctx);
      }

      return ts.visitNode(sourceFile, visit);
    };
  };
}

