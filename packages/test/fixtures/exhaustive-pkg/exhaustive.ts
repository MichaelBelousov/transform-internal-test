/// setup /////////////////////////////////////////////////

export let testLocal: any;

/// free functions ////////////////////////////////////////

/** @internal */
export function internalFunction() {}

internalFunction();

/// free variables ////////////////////////////////////////

/** @internal */
export const internalConst = 'internal const';
export var internalVar = 'internal var';
export let internalLet = 'internal let';

testLocal = internalConst;
testLocal = internalVar;
testLocal = internalLet;

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
testLocal = new PublicClass().internalProperty;
new PublicClass().internalProperty = testLocal;

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

testLocal = InternalEnum.value;
testLocal = PublicEnum.publicEnumMember;
testLocal = PublicEnum.internalEnumMember;
