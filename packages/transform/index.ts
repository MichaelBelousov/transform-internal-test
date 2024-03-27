import * as ts from 'typescript';
import type { TransformerExtras, PluginConfig } from 'ts-patch';

function getParentSymbolName(declaration: any) {
  if (declaration.parent && declaration.parent.symbol && !declaration.parent.symbol.escapedName.startsWith('"'))
    return declaration.parent.symbol.escapedName;
  return undefined;
}

const bannedTags = ["internal"];

function checkJsDoc(declaration: any, node: any) {
  if (!declaration || !declaration.jsDoc)
    return undefined;

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

        console.log('NAME', name);
        return true;
      }
    }
  }
}


/** Changes string literal 'before' to 'after' */
export default function (program: ts.Program, pluginConfig: PluginConfig, { ts: tsInstance }: TransformerExtras) {
  return (ctx: ts.TransformationContext) => {
    const { factory } = ctx;
    const typeChecker = program.getTypeChecker();

    return (sourceFile: ts.SourceFile) => {
      function visit(node: ts.Node): ts.Node {
        if (tsInstance.isStringLiteral(node) && (node as any).text === 'before') {
          return factory.createStringLiteral('after');
        }
        if (tsInstance.isCallExpression(node)) {
          const resolved = typeChecker.getResolvedSignature(node as any);
          //checkJsDoc(node, node);
          //console.log(resolved)
          if (resolved) {
            checkJsDoc(resolved.declaration, node);
            // return factory.createCallExpression(node.expression, undefined, node.arguments);
            return factory.createCallExpression(factory.createIdentifier('__INTERNAL_'+(node.expression as any).text), undefined, node.arguments);
          }
        }
        return tsInstance.visitEachChild(node, visit, ctx);
      }
      return tsInstance.visitNode(sourceFile, visit);
    };
  };
}

