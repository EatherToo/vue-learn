#### 嵌套的 effect

([代码地址](https://github.com/EatherToo/vue-learn/blob/master/reactive/%E4%B8%89%E3%80%81%E5%B5%8C%E5%A5%97%E7%9A%84effect/effect.ts))

1. effect 嵌套的场景

   ```js
   const person1 = reactive({ name: 'Tom' })
   const person2 = reactive({ name: 'Jack' })

   effect(() => {
     console.log(person1.name)
     effect(() => {
       console.log(person2.name)
     })
   })
   ```

   按照之前的实现，来分析一下上面代码的执行

   1. 假定：外层 effect 函数对应的 effectFn 叫做 EffectOut，内层 effect 函数对应的 effectFn 叫做 EffectInner
   2. 外层的 effect 先执行, activeEffect 被赋值为 EffectOut
   3. person1 的 name 属性触发了 track 函数，effectOut 就正常的保存到了 person1 的 depsMap 中 name 属性 effectSet 中了
   4. 内层的 effect 函数执行，activeEffect 被赋值为 EffectInner
   5. person2 的 name 属性触发了 track 函数，effectInner 也正常的保存到了 person2 的 depsMap 中 name 属性 effectSet 中了

   这个流程看起来一点问题都没有，依赖都正常的收集了，但是假如修改一下代码，让 person1.name 在 person2.name 之后打印，就会有问题了

   ```js
   effect(() => {
     effect(() => {
       console.log(person2.secondname)
     })
     console.log(person1.firstname)
   })
   ```

   函数执行流程就变了，变成了：

   1. 外层的 effect 先执行, activeEffect 被赋值为 EffectOut
   2. 没有 person1 的属性被读取，person1 的 track 函数不回被触发
   3. 内层的`effect`函数执行，`activeEffect`被赋值为`EffectInner`
   4. person2 的 secondname 属性触发了 track 函数，effectInner 正常的保存到了 person2 的 depsMap 中 secondname 属性 effectSet 中了
   5. 内层的 effect 执行完成了，然后 person1.firstname 触发了 person1 的 track 函数
   6. 此时，activeEffect 的值时 effectInner，然后 effectInner 就被保存到了属于 person1 的 depsMap 中了

   在这之后，当 person1.firstname 发生修改时，effectOut 不会被触发，触发的会是 effectInner

2. 解决 effect 的嵌套问题
   要解决这个 activeEffect 丢失的问题，我们可以使用一个栈来保存 activeEffect:

   1. 每当一个 effect 函数开始执行的时候，把当前的 effectFn 推入栈中，再把 activeEffect 赋值为栈顶的 effectFn
   2. 每当一个 effect 函数结束执行的时候，把栈顶 EfeectFn 清除，然后重新赋值 activeEffect 为新的栈顶 EffectFn
   3. 这样一来，每次 activeEffect 都能对应到正确的 target 和 key 了

   ```js
   const EffectStack: EffectFnType[] = []
   function effect(fn: Noop) {
     const effectFn: EffectFnType = () => {
       // cleanup 函数会从所用保存了当前effectFn的地方删除掉当前的effectFn，effectFn的deps也会清空，双向删除
       cleanup(effectFn)
       // 当前effectFn推入栈中并赋值给activeEffect
       EffectStack.push(effectFn)
       activeEffect = EffectStack[EffectStack.length - 1]
       // 开始执行后会触发track函数，依赖又开始重新收集了
       fn()
       // effectFn执行结束，如果时嵌套的effect，就拿到上一层的effectFn并赋值给activeEffect
       EffectStack.pop()
       activeEffect = EffectStack[EffectStack.length - 1]
     }
     // 在effectFn上定义一个属性deps，用来储存依赖列表
     effectFn.deps = []
     effectFn()
   }
   ```
