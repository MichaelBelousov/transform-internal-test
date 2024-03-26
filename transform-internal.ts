import type * as ts from 'typescript';
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
        if (!bannedTags.includes(tag.tagName.escapedText) || !isCheckedFile(declaration)) {
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

        console.log(name);
        return true;
      }
    }
  }
}


/** Changes string literal 'before' to 'after' */
export default function (program: ts.Program, pluginConfig: PluginConfig, { ts: tsInstance }: TransformerExtras) {
  return (ctx: ts.TransformationContext) => {
    const { factory } = ctx;

    return (sourceFile: ts.SourceFile) => {
      function visit(node: ts.Node): ts.Node {
        if (tsInstance.isStringLiteral(node) && node.text === 'before') {
          return factory.createStringLiteral('after');
        }
        if (tsInstance.isCallExpression(node)) {
          //checkJsDoc(node, node);
          checkJsDoc(node);
        }
        return tsInstance.visitEachChild(node, visit, ctx);
      }
      return tsInstance.visitNode(sourceFile, visit);
    };
  };
}

