// @vitest-environment happy-dom
/**
 * ParticleOrbBackground 组件 + particleOrb 状态机测试
 * ------------------------------------------------------------------
 * 粒子内核（particleOrb.js）是移植特效、不在覆盖率内；这里钉住两件产品行为：
 *   1. 组件在任何环境（含无 canvas 2D 上下文的测试环境）都能安全挂载；
 *   2. 状态机映射正确：speaking → 聚合强脉冲；idle → 散开 + 轻微脉冲（织流定制）。
 */
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ParticleOrbBackground from '@/components/ParticleOrbBackground.vue'
import ParticleOrb from '@/lib/particleOrb'

describe('components/ParticleOrbBackground', () => {
  it('渲染 canvas，且无 2D 上下文环境不崩（happy-dom 降级）', () => {
    const wrapper = mount(ParticleOrbBackground, { props: { streaming: false } })
    expect(wrapper.find('canvas').exists()).toBe(true)
  })

  it('streaming 切换不抛（orb 未实例化时静默）', async () => {
    const wrapper = mount(ParticleOrbBackground, { props: { streaming: false } })
    await wrapper.setProps({ streaming: true })
    await wrapper.setProps({ streaming: false })
    expect(wrapper.find('canvas').exists()).toBe(true)
  })
})

describe('lib/particleOrb 状态机', () => {
  function fakeOrb() {
    return { state: '', morphTarget: 0, energyTarget: 0, beatRate: 0, externalEnergy: false }
  }

  it('speaking → 聚合 + 强脉冲', () => {
    const o = fakeOrb()
    ParticleOrb.prototype.setState.call(o, 'speaking')
    expect(o.state).toBe('speaking')
    expect(o.morphTarget).toBe(1)
    expect(o.energyTarget).toBe(0.86)
    expect(o.beatRate).toBe(3.0)
  })

  it('idle → 散开 + 轻微脉冲（织流定制，非死水）', () => {
    const o = fakeOrb()
    ParticleOrb.prototype.setState.call(o, 'idle')
    expect(o.state).toBe('idle')
    expect(o.morphTarget).toBe(0)
    expect(o.energyTarget).toBeGreaterThan(0)
    expect(o.beatRate).toBeGreaterThan(0)
  })
})
