/// declarations ////////////////

/** @internal */
function internal() {}
/** @internal */
const internalVar = 'before'
/** @internal */
class Internal {}

/// local usage (should be transformed) ////////////////
internal();
console.log(internalVar);
class Bad extends Internal {}
