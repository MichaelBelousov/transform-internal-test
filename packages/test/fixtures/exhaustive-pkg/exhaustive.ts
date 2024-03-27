/** @internal */
export function internalFunction() {}

internalFunction();

/** @internal */
export const internalVar = 'internal';

(globalThis as any)._test = internalVar;

/** @internal */
export class InternalClass {}

new InternalClass();

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

new PublicClass().internalMethod();
(globalThis as any)._publicClass_internalProperty = new PublicClass().internalProperty;
new PublicClass().internalProperty = 3;

/** @internal */
export interface InternalInterface {}

const interfaceInst: InternalInterface = {};

/** @internal */
export type InternalType = {}

const typeInst: InternalType = {};

/** @internal */
export enum InternalEnum {}

/** @public */
export enum PublicEnum {
  /** @public */
  publicEnumMember = 1,
  /** @internal */
  internalEnumMember = 2,
}
