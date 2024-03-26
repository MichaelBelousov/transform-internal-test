function internal() {}
const internalVar = 'dont use me'
class Internal {}

internal();
console.log(internalVar);
class Bad extends Internal {}
