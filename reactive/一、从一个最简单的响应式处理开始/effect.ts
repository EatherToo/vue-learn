export type Noop = () => void
let activeEffect: Noop | undefined

export function effect(fn: Noop) {
  activeEffect = fn
  fn()
}

// 用来储存不同的响应式对象对应的depsMap, key为一个对象
const targetEffectMap = new WeakMap<any, Map<string | symbol, Set<Noop>>>()

export function track(target: any, key: string | symbol) {
  if (activeEffect) {
    /** 新增的代码 --- start */
    // 取出target对应的depsMap
    let depsMap = targetEffectMap.get(target)
    if (!depsMap) {
      depsMap = new Map()
      targetEffectMap.set(target, depsMap)
    }
    /** 新增的代码 --- end */
    // 取出key对应的effectSet
    let effectSet = depsMap.get(key)
    // 不存在的话新建一个
    if (!effectSet) {
      effectSet = new Set()
      depsMap.set(key, effectSet)
    }
    // 加到set里面
    effectSet.add(activeEffect)
  }
}
export function trigger(target: any, key: string | symbol) {
  /** 新增的代码 --- start */
  const depsMap = targetEffectMap.get(target)
  // 没有就不执行了
  if (!depsMap) return
  /** 新增的代码 --- end */

  // 把副作用函数取出来执行一遍
  const effectSet = depsMap.get(key)
  effectSet && effectSet.forEach((fn) => fn())
}
export function reactive(obj: any) {
  return new Proxy(obj, {
    get(target, key) {
      track(target, key)
      return target[key]
    },
    set(target, key, value) {
      target[key] = value
      trigger(target, key)
      return true
    },
  })
}
