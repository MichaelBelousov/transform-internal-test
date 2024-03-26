/** @internal */
function internal() {}
/** @internal */
const internalVar = 'before'
/** @internal */
class Internal {}

internal();
console.log(internalVar);
class Bad extends Internal {}
