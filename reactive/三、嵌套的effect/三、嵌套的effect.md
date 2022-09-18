#### 嵌套的effect

1. effect嵌套的场景
    ```js
      const person1 = reactive({name: 'Tom'})
      const person2 = reactive({name: 'Jack'})

      effect(() => {
        console.log(person1.name)
        effect(() => {
          console.log(person2.name)
        })
      })
    ```
    按照之前的实现，来分析一下上面代码的执行
      1. 假定：外层effect函数对应的effectFn叫做EffectOut，内层effect函数对应的effectFn叫做EffectInner
      2. 外层的effect先执行, activeEffect被赋值为EffectOut
      3. person1的name属性触发了track函数，effectOut就正常的保存到了person1的depsMap中name属性effectSet中了
      4. 内层的effect函数执行，activeEffect被赋值为EffectInner
      5. person2的name属性触发了track函数，effectInner也正常的保存到了person2的depsMap中name属性effectSet中了

    这个流程看起来一点问题都没有，依赖都正常的收集了，但是假如修改一下代码，让person1.name在person2.name之后打印，就会有问题了
    ```js
      effect(() => {
        effect(() => {
          console.log(person2.secondname)
        })
        console.log(person1.firstname)
      })
    ```
    函数执行流程就变了，变成了：
      1. 外层的effect先执行, activeEffect被赋值为EffectOut
      2. 没有person1的属性被读取，person1的track函数不回被触发
      3. 内层的`effect`函数执行，`activeEffect`被赋值为`EffectInner`
      4. person2的secondname属性触发了track函数，effectInner正常的保存到了person2的depsMap中secondname属性effectSet中了
      5. 内层的effect执行完成了，然后person1.firstname触发了person1的track函数
      6. 此时，activeEffect的值时effectInner，然后effectInner就被保存到了属于person1的depsMap中了
      
    在这之后，当person1.firstname发生修改时，effectOut不会被触发，触发的会是effectInner

  2. 解决effect的嵌套问题
    要解决这个activeEffect丢失的问题，我们可以使用一个栈来保存activeEffect:
      1. 每当一个effect函数开始执行的时候，把当前的effectFn推入栈中，再把activeEffect赋值为栈顶的effectFn
      2. 每当一个effect函数结束执行的时候，把栈顶EfeectFn清除，然后重新赋值activeEffect为新的栈顶EffectFn
      3. 这样一来，每次activeEffect都能对应到正确的target和key了
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


