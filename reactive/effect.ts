//  最简单的响应式处理
// 简化场景，打印一个对象的name值，当这个对象的name属性改变了在重新打印一次
const obj = {
  name: '杰克'
}
function printName() {
  console.log(obj.name)
}
printName()

// 对obj的name属性进行set拦截
const objProxy = new Proxy(obj, {
  set(target, key, value) {
    target[key] = value
    if (key === 'name') {
      printName()
    }
    return true
  }
})
// 然后每次通过obj的代理来修改obj对象时，就会自动打印修改后的值
objProxy.name = '汤姆'
objProxy.name = 'Tom'

// 上面的仅仅是对一个name属性进行了set时的拦截，可以手动用if语句判断一下。
// 如果在print函数里面再多打印几个属性的值，if语句就显得太多了。
// 而且假如说print函数是作为一个参数传递到应用中的，里面用了哪些属性是不可知的，所以这里可以用get来拦截属性的读取来达到我们的目的。
// 拆解一下上面的需求就是
// 1. 对一个普通对象进行代理，拦截其get，set操作
// 2. 有读取对象属性的操作时，保存执行该操作的函数
// 3. 对象的属性赋值时，重新执行上面保存过的函数
