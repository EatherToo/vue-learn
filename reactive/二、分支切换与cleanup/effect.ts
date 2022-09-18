type Noop = () => void

type EffectFnType = {
  (): void
  deps: Set<Noop>[]
}
let activeEffect: EffectFnType | undefined

// 用来储存不同的响应式对象对应的depsMap, key为一个对象
const targetEffectMap = new WeakMap<any, Map<string | symbol, Set<Noop>>>()

// 改造一下effect函数
export function effect(fn: Noop) {
  const effectFn: EffectFnType = () => {
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

function cleanup(effectFn: EffectFnType) {
  for (let i = 0; i < effectFn.deps.length; i++) {
    const deps = effectFn.deps[i]
    // 从依赖中删除当前的副作用函数
    deps.delete(effectFn)
  }
  // 副作用函数的依赖数组也清空
  effectFn.deps.length = 0
}

// 改造一下track函数
export function track(target: any, key: string | symbol) {
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
export function trigger(target: any, key: string | symbol) {
  const depsMap = targetEffectMap.get(target)
  if (!depsMap) return

  // 把副作用函数取出来执行一遍
  const effectSet = depsMap.get(key)
  // 拷贝一份effect在执行
  const effectSetCopy = new Set(effectSet)
  effectSetCopy.forEach((fn) => fn())
}
