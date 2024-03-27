/// setup /////////////////////////////////////////////////

export let _testLocal: any;

/// free functions ////////////////////////////////////////

/** @internal */
export function internalFunctionDecl() {}
/** @internal */
export const internalArrowFunction = () => {};
/** @internal */
export const internalFunctionExpr = function(){};

internalFunctionDecl();
internalArrowFunction();
internalFunctionExpr();

/// free variables ////////////////////////////////////////

/** @internal */
export const internalConst = 'internal const';
export var internalVar = 'internal var';
export let internalLet = 'internal let';

_testLocal = internalConst;
_testLocal = internalVar;
_testLocal = internalLet;

/// classes ////////////////////////////////////////////////

/** @internal */
export class InternalClass {}
/** @public */
export class PublicClass {
  /** @internal */
  public internalMethod() {}
  /** @internal */
  public get internalProperty() { return 2; }
  /** @internal */
  public set internalProperty(_: number) {}
  /** @internal constructor */
  public constructor() {}
}

// technically a lint rule should complain that this is not marked as internal
class DerivedClass extends InternalClass {}
new InternalClass();
new PublicClass().internalMethod();
_testLocal = new PublicClass().internalProperty;
new PublicClass().internalProperty = _testLocal;

/// types //////////////////////////////////////////////////

// TODO: need to recommend a lint rule that detects if this reaches the package level exports
/** @internal */
export interface InternalInterface {}
/** @internal */
export type InternalType = {}

// technically a lint rule should disallow (public) exporting variables of internal type
export const interfaceInst: InternalInterface = {};
export const typeInst: InternalType = {};

/// enums //////////////////////////////////////////////////

/** @internal */
export enum InternalEnum {
  value = 0,
}

/** @public */
export enum PublicEnum {
  /** @public */
  publicEnumMember = 1,
  /** @internal */
  internalEnumMember = 2,
}

_testLocal = InternalEnum.value;
_testLocal = PublicEnum.publicEnumMember;
_testLocal = PublicEnum.internalEnumMember;
