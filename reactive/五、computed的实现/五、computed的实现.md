#### computed 的实现

([代码实现](https://github.com/EatherToo/vue-learn/blob/master/reactive/五、computed的实现/effect.ts))

1. **lazy 的实现**

   对于我们之前实现的 effect 函数，当我们调用时，传递给他的副作用函数也会立即执行。

   但是某些情况下，我们并不需要副作用函数立即执行，这时我们可以通过在`options`中添加个属性来控制

   ```js
   effect(
     () => {
       console.log(obj.a)
     },
     // options
     {
       lazy: true,
     }
   )
   ```

   要实现上面的功能很简单，只要在副作用函数执行之前加个判断就行：如果`options.lazy`为`true`则不执行副作用函数<br>

   但是这样做会产生一个问题：副作用函数没有地方执行了。为了解决这个问题，我们可以把封装好的副作用函数直接返回出来，然后在合适的时机手动调用就行。

   ```js
   export function effect(fn: AnyReturnFunc, options: EffectOptions) {
     const effectFn: EffectFnType = () => {
       // cleanup 函数会从所有保存了当前effectFn的地方删除掉当前的effectFn，effectFn的deps也会清空，双向删除
       cleanup(effectFn)
       effectStack.push(effectFn)
       activeEffect = effectStack[effectStack.length - 1]
       // 开始执行后会触发track函数，依赖又开始重新收集了
       fn()
       effectStack.pop()
       activeEffect = effectStack[effectStack.length - 1]
     }
     effectFn.options = options // 在effectFn中保存options
     // 在effectFn上定义一个属性deps，用来储存依赖列表
     effectFn.deps = []
     // 判断是否需要lazy执行
     if (!options.lazy) {
       effectFn()
     }
     return effectFn
   }

   const effectFn = effect(
     () => {
       console.log(obj.a)
     },
     // options
     {
       lazy: true,
     }
   )
   // 手动执行
   effectFn()
   ```

2. computed 的实现

   - 副作用函数是一个`getter`

     单纯的实现一个`lazy`似乎并没有啥用，但是当副作用函数拥有返回值的时候，这个 lazy 就有点作用了

     比如：

     ```js
     const effectFn = effect(
       () => {
         return obj.a + obj.b
       },
       { lazy: true }
     )

     // 执行effectFn的时候就可以直接拿到obj.a + obj.b的值了
     const sum = effectFn()
     ```

     如上面的代码所示，这不就是`computed`的最初始的实现吗

     对`effect`的代码修改一下，并且在对上面的代码做个封装，就简单的实现了个`computed`

     ```js
     export function effect(fn: AnyReturnFunc, options: EffectOptions) {
       const effectFn: EffectFnType = () => {
         // cleanup 函数会从所有保存了当前effectFn的地方删除掉当前的effectFn，effectFn的deps也会清空，双向删除
         cleanup(effectFn)
         effectStack.push(effectFn)
         activeEffect = effectStack[effectStack.length - 1]
         // 开始执行后会触发track函数，依赖又开始重新收集了
         const res = fn()
         effectStack.pop()
         activeEffect = effectStack[effectStack.length - 1]
         return res
       }
       effectFn.options = options // 在effectFn中保存options
       // 在effectFn上定义一个属性deps，用来储存依赖列表
       effectFn.deps = []
       if (!options.lazy) {
         effectFn()
       }
       return effectFn
     }

     // computed的最简单的实现
     function computed(getter) {
       const effectFn = effect(getter, {
         lazy: true,
       })

       const obj = {
         get value() {
           return effectFn()
         },
       }
       return obj.value
     }

     // 使用示例
     const res = computed(() => obj.a + obj.b)
     // 每一次访问res.value都会计算一次obj.a + obj.b
     console.log(res.value)
     ```

   - 值的缓存

     对于上面 computed 的简单实现来说，还不够优雅，访问`res.value`时，在任何情况下都会重新运算一遍`obj.a+obj.b`。但是只要`obj.a`和`obj.b`的值没有发生变化，就应该一直复用第一次计算的值。

     要做到这一点，我们可以在`computed`函数中加上一个标志变量来标识`getter`所依赖的响应式对象有没有发生改变，在`getter`函数运行之前做一个判断就行。

     ```js
     function computed(getter) {
       // 标识是否需要重新运行getter
       let dirty = true
       let cacheVal
       const effectFn = effect(getter, {
         lazy: true,
         scheduler() {
           // 利用之前实现过的调度器来保证当getter依赖的值发生改变时，访问computed的值可以拿到最新的结果
           dirty = true
         },
       })

       const obj = {
         get value() {
           if (dirty) {
             cacheVal = effectFn()
           }
           return cacheVal
         },
       }
       return obj.value
     }
     ```

   - 自动运行依赖`computed`的副作用函数

     考虑下面这个场景，当 computed 值发生改变时，我们肯定会预期下一行的副作用函数也会重新执行。

     ```js
     const sumRes = computed(() => obj.a + obj.b)
     effect(() => {
       // 当sumRes发生改变时，需要重新打印sumRes的值
       console.log(sumRes.value)
     })
     ```

     但是按照上面的实现，肯定没有这样的效果。因为`computed`中调用的`effect`和依赖`sumRes.value`的`effect`在代码层面上并没有做任何关联操作，所以不会相互影响。要解决这个问题，我们可以在读取`computed`值的时候手动调用一下`track`函数，然后在`getter`的依赖改变的时候，手动调用一下 trigger 函数。这样就可以满足需求了。

     ```js
     export function computed(getter) {
       // 标识是否需要重新运行getter
       let dirty = true
       let cacheVal
       const effectFn = effect(getter, {
         lazy: true,
         scheduler() {
           // 加这个判断时为了防止多个值发生改变导致重复trigger
           if (!dirty) {
             // 利用之前实现过的调度器来保证当getter依赖的值发生改变时，访问computed的值可以拿到最新的结果
             dirty = true
             // 通知所有依赖这个computed的副作用函数重新运行
             trigger(obj, 'value')
           }
         },
       })

       const obj = {
         get value() {
           if (dirty) {
             cacheVal = effectFn()
           }
           track(obj, 'value')
           return cacheVal
         },
       }
       return obj.value
     }
     ```

​
