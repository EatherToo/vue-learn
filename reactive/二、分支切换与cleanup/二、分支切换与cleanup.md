#### 分支切换与cleanup

1. 什么是分支切换
    举一个最简单的例子：
    ```js
      const data = reactive({
        needPrintName: true,
        name: 'Tom'
      })

      effect(() => {
        if (data.needPrintName) {
          console.log(data.name)
        } else {
          console.log('dont need print name')
        }
      })
    ```
    上面的代码执行后，data的needPrintName属性和name属性都会保存一份副作用函数
    ```
      targetEffectMap =>
        ---------------------------------------
        |  key: data                          |
        |  value: depsMap =>                  |
        |      ----------------------------   |
        |      | key: printName           |   |
        |      | value: Set => effectFn   |   |
        |      ----------------------------   |
        |      ----------------------------   |
        |      | key: name                |   |
        |      | value: Set => effectFn   |   |
        |      ----------------------------   |
        ---------------------------------------

    ```
    所以无论是needPrintName属性改变还是name属性改变，都会触发副作用函数的重新执行。
    这样的话就出现了一个问题： 当`needPrintName`属性为`false`的时候，不管`name`属性怎么变化。副作用函数打印的都是`dont need print name`, 根本就不会用到name属性，副作用函数并不是有必要重新执行的。
    所以这里就需要有一个机制，在一个副作用函数重新执行之前清除掉之前保存过的这个副作用函数，再重新进行依赖收集。

2. 实现cleanup函数
    总结一下cleanup函数的作用就是：
    `在一个副作用函数执行之前，把这个副作用函数从依赖里面删除掉`
    但是根据之前的实现，除非把整个targetEffectMap全部都遍历一遍，要不然是没有办法实现的，而遍历整个targetEffectMap无疑是不够优雅的。所以就需要设计一个结构在effect中保存依赖，方便用于进行cleanup操作
    ```js
      // 改造一下effect函数
      function effect(fn) {
        const effectFn = () => {
          // cleanup 函数会从所用保存了当前effectFn的地方删除掉当前的effectFn，effectFn的deps也会清空，双向删除
          cleanup(effectFn)
          activeEffect = effectFn
          // 开始执行后会触发track函数，依赖又开始重新收集了
          fn()
        }
        // 在effectFn上定义一个属性deps，用来储存依赖列表
        effectFn.deps = []
        effectFn()
      }

      function cleanup(effectFn) {
        for (let i = 0; i < effectFn.deps.length; i++) {
          const deps = effectFn.deps[i];
          // 从依赖中删除当前的副作用函数
          deps.delete(effectFn)
        }
        // 副作用函数的依赖数组也清空
        effectFn.deps.length = 0
      }

      // 改造一下track函数
      function track(target, key) {
        if (activeEffect) {
          // 取出target对应的depsMap
          let depsMap = targetEffectMap.get(target)
          if (!depsMap) {
            depsMap = new Map()
            targetEffectMap.set(target, depsMap)
          }
          // 取出key对应的effectSet
          let effectSet = depsMap.get(key)
          // 不存在的话新建一个
          if (!effectSet) {
            effectSet = new Set()
            depsMap.set(key, effectSet)
          }
          // 加到set里面
          effectSet.add(activeEffect)
          // 在effectFn的deps中保存用来存储副作用函数的set
          activeEffect.deps.push(effectSet)
        }
      }

      // 改造一下trigger函数
      function trigger(target, key) {
        const depsMap = targetEffectMap.get(target)
        if (!depsMap) return

        // 把副作用函数取出来执行一遍
        const effectSet = depsMap.get(key)
        // 拷贝一份effect在执行
        const effectSetCopy = new Set(effectSet)
        effectSetCopy.forEach((fn) => fn())
      }

    ```

    `trigger`函数中要拷贝一份`effect`的集合再执行的原因是：
    1. `trigger`函数触发后，`effect`函数开始执行, effect就从effectSet中删除了
    2. `effect`中会用到响应式对象的值，又触发了`track`函数，effect又被加入到effectSet中了
    3. 形成了一个死循环

  