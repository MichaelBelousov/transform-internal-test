import { expect } from "chai";

const consoleWarnings: any[][] = [];
console.warn = (...args) => consoleWarnings.push(args);

import * as ExhaustivePkg from "exhaustive-pkg";

const postImportWarnings = [...consoleWarnings];

describe("exhaustive-pkg", () => {
  beforeEach(() => {
    // reset list
    consoleWarnings.length = 0;
  });

  it("importing package with internal APIs had no warnings from internal usage", () => {
    expect(postImportWarnings).to.have.length(0);
  });

  describe("functions", () => {
    it("function declaration", () => {
      ExhaustivePkg.internalFunctionDecl();
      expect(consoleWarnings).to.have.length(1);
      expect(consoleWarnings[0][0]).to.match(/is an internal API and may change without notice/);
      ExhaustivePkg.__INTERNAL_internalFunctionDecl();
      expect(consoleWarnings).to.have.length(1);
    });

    it("arrow function", () => {
      ExhaustivePkg.internalArrowFunction();
      expect(consoleWarnings).to.have.length(1);
      expect(consoleWarnings[0][0]).to.match(/is an internal API and may change without notice/);
      // FIXME:
      ExhaustivePkg.__INTERNAL_internalArrowFunction();
      expect(consoleWarnings).to.have.length(1);
    });

    it("function expression", () => {
      ExhaustivePkg.internalFunctionExpr();
      expect(consoleWarnings).to.have.length(1);
      expect(consoleWarnings[0][0]).to.match(/is an internal API and may change without notice/);
      // FIXME:
      ExhaustivePkg.__INTERNAL_internalFunctionExpr();
      expect(consoleWarnings).to.have.length(1);
    });
  });

  describe("variables", () => {
    // HACK: currently direct access is not trapped
    // (although it could be in at least commonjs)
    it("var", () => {
      ExhaustivePkg.internalVar.toString();
      expect(consoleWarnings).to.have.length(1);
      expect(consoleWarnings[0][0]).to.match(/is an internal API and may change without notice/);
      ExhaustivePkg.__INTERNAL_internalVar.toString();
      expect(consoleWarnings).to.have.length(1);
    });

    it("let", () => {
      ExhaustivePkg.internalLet.toString();
      expect(consoleWarnings).to.have.length(1);
      expect(consoleWarnings[0][0]).to.match(/is an internal API and may change without notice/);
      // FIXME:
      ExhaustivePkg.__INTERNAL_internalLet.toString();
      expect(consoleWarnings).to.have.length(1);
    });

    it("const", () => {
      ExhaustivePkg.internalConst.toString();
      expect(consoleWarnings).to.have.length(1);
      expect(consoleWarnings[0][0]).to.match(/is an internal API and may change without notice/);
      // FIXME:
      ExhaustivePkg.__INTERNAL_internalConst.toString();
      expect(consoleWarnings).to.have.length(1);
    });
  });

  describe("classes", () => {
  });

  describe("types", () => {
    it("interface", () => {
      const _value: ExhaustivePkg.InternalInterface = undefined as any;
    });

    it("type", () => {
      const _value: ExhaustivePkg.InternalType = undefined as any;
    });
  });
});
