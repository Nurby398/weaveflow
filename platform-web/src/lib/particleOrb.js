/* eslint-disable */
/**
 * ParticleOrb 粒子内核（从 particle-orb.html 提取，原样保留算法）
 * ------------------------------------------------------------------
 * 提取自 O:\桌面\平台前端设计\particle-orb.html 的 `ParticleOrb` canvas 类，
 * 改动仅四处：① IIFE 改为 ES module 导出；② 默认配色改为灰黑色系；③ 默认 alpha=true
 * （透明画布，叠在聊天窗口底色上，背景即窗口色）；④ 头部 eslint-disable（移植代码）。
 * 状态机：'speaking'（聚合脉冲）/ 'idle'（散开自转 + 轻微脉冲）/ 'thinking'（轻聚合）。
 */
'use strict'

var TAU = Math.PI * 2
var REDUCED = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v
}

var DEFAULTS = {
  count: 0, // 0 = 依据画布尺寸自动（约 1500~5200）
  palette: ['#16181b', '#1f2125', '#292c30', '#33363b'],
  bg: 'rgba(0,0,0,0)', // 不透明模式下的背景色 / 拖尾基色
  alpha: true, // true = 透明画布（可叠在任意底色上），拖尾改用 alpha 衰减
  trail: 0.4, // 拖尾：每帧衰减比例，0 = 关闭拖尾（数值越大拖尾越短）
  orbScale: 0.235, // 聚合半径 = 短边 × orbScale
  centerX: 0.5, // 内核中心（视图归一化）
  centerY: 0.5,
  spriteSize: 48, // 光斑贴图边长（像素）
  autoSpin: 0.1, // 空闲自转角速度（rad/s）
  pointerTarget: null, // 拖拽/悬停监听的元素，默认 canvas
  reducedMotion: 'auto', // 'auto' | true | false
  state: 'idle', // 初始状态
  onFrame: null, // (stats) => void，约每 250ms 一次
}

function hexToRgb(hex) {
  var h = String(hex).trim().replace('#', '')
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
  var n = parseInt(h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function ParticleOrb(canvas, options) {
  if (!canvas) throw new Error('ParticleOrb: 需要传入 canvas 元素')

  this.canvas = canvas
  this.opt = {}
  for (var k in DEFAULTS) if (DEFAULTS.hasOwnProperty(k)) this.opt[k] = DEFAULTS[k]
  for (var k2 in options || {}) if (options[k2] !== undefined) this.opt[k2] = options[k2]

  this.ctx = canvas.getContext('2d', { alpha: !!this.opt.alpha })

  // 运动状态
  this.t = 0
  this.morph = this.opt.state === 'idle' ? 0 : 1 // 0 散开 → 1 聚合
  this.morphTarget = this.morph
  this.energy = 0
  this.energyTarget = 0
  this.burst = 0 // 手动冲击波强度（衰减量）
  this.beat = 0 // 心跳相位
  this.beatRate = 0 // 每秒拍数（由状态决定）
  this.externalEnergy = false
  this.state = this.opt.state
  this.blooms = [] // 脉冲光晕扩散波
  this._bloomIdx = 0
  this._beatPulse = 0

  // 旋转（拖拽 / 自转）
  this.yaw = 0
  this.pitch = -0.12
  this.yawVel = 0
  this.pitchVel = 0
  this.drag = null

  // 指针（用于轻微排斥）
  this.pointer = { x: -1e9, y: -1e9, inside: false }

  this.center = { x: this.opt.centerX, y: this.opt.centerY }
  this.cur = { x: this.center.x, y: this.center.y }

  this.reduced = this.opt.reducedMotion === 'auto' ? !!(REDUCED && REDUCED.matches) : !!this.opt.reducedMotion

  this.paused = false
  this.visible = true
  this.fps = 60
  this._lastStats = 0
  this._raf = 0
  this._last = 0

  this._buildSprites()
  this._buildPalette()
  this.resize()
  this._buildParticles(this.opt.count || this._autoCount())

  this._bind()
  this.setState(this.state, true)

  var self = this
  this._loop = function (now) {
    self._frame(now)
  }
  this._raf = requestAnimationFrame(this._loop)
}

ParticleOrb.PALETTES = {
  ion: ['#5f8ff2', '#7f97f0', '#9b8bef', '#b58cf5'],
  ember: ['#fde68a', '#fca5a5', '#f0abfc', '#a78bfa'],
  mono: ['#e2e8f0', '#94a3b8', '#cbd5e1', '#f8fafc'],
  biological: ['#86efac', '#5eead4', '#a7f3d0', '#7dd3fc'],
}

/* ---------------------------------------------------------------- 构建 */

ParticleOrb.prototype._buildPalette = function () {
  this.rgb = this.opt.palette.map(hexToRgb)
}

ParticleOrb.prototype._buildSprites = function () {
  var S = this.opt.spriteSize
  var n = this.opt.palette.length
  var c = document.createElement('canvas')
  c.width = S * n
  c.height = S
  var g = c.getContext('2d')
  var half = S / 2

  for (var i = 0; i < n; i++) {
    var rgb = hexToRgb(this.opt.palette[i])
    var grd = g.createRadialGradient(half, half, 0, half, half, half)
    var s = i * S
    // 核心收得紧一些：单颗粒子更"实"、更饱和，聚合时叠加不易糊成灰白
    grd.addColorStop(0.0, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',1)')
    grd.addColorStop(0.07, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',0.64)')
    grd.addColorStop(0.22, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',0.07)')
    grd.addColorStop(1.0, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',0)')
    g.save()
    g.translate(s, 0)
    g.fillStyle = grd
    g.fillRect(0, 0, S, S)
    g.restore()
  }
  this.sprites = c
}

ParticleOrb.prototype._autoCount = function () {
  var px = this.w * this.h
  var coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
  var n = clamp(Math.round(px / 280), 1600, 6000)
  return Math.round(coarse ? n * 0.55 : n)
}

ParticleOrb.prototype._buildParticles = function (n) {
  n = Math.max(60, Math.floor(n))
  var i, rnd
  this.P = {
    n: n,
    px: new Float32Array(n),
    py: new Float32Array(n),
    pz: new Float32Array(n),
    vx: new Float32Array(n),
    vy: new Float32Array(n),
    vz: new Float32Array(n),
    hx: new Float32Array(n),
    hy: new Float32Array(n),
    hz: new Float32Array(n),
    // 脉冲波相位（由球面方向决定，脉冲会沿一个方向扫过球体）
    ph: new Float32Array(n),
    wv: new Float32Array(n), // 本帧波形值，渲染复用
    rnd: new Float32Array(n),
    rnd2: new Float32Array(n),
    stiff: new Float32Array(n),
    damp: new Float32Array(n),
    tint: new Uint8Array(n),
    sz: new Float32Array(n),
    br: new Float32Array(n),
  }

  var P = this.P
  var GA = Math.PI * (3 - Math.sqrt(5)) // 黄金角 → 斐波那契球均匀分布
  var T = this.opt.palette.length

  for (i = 0; i < n; i++) {
    rnd = Math.random()
    var y = 1 - (i / Math.max(1, n - 1)) * 2
    var r = Math.sqrt(Math.max(0, 1 - y * y))
    var th = GA * i
    P.hx[i] = Math.cos(th) * r
    P.hy[i] = y
    P.hz[i] = Math.sin(th) * r

    // 脉冲沿 (0.55, 0.35, 0.75) 方向扫过
    P.ph[i] = (P.hx[i] * 0.55 + P.hy[i] * 0.35 + P.hz[i] * 0.75) * 2.6

    P.rnd[i] = rnd
    P.rnd2[i] = Math.random()
    P.stiff[i] = 3.6 + Math.random() * 6.4 // 弹簧刚度（决定聚合速度与回弹）
    P.damp[i] = 1.7 + Math.random() * 1.5 // 阻尼（欠阻尼 → 聚合时轻微过冲）
    // 色相沿纬度整体偏移（下冷上暖），但保留足够抖动，让相邻粒子不同色 → 颗粒感不被抹平
    P.tint[i] = clamp(Math.floor((P.hy[i] * 0.5 + 0.5) * (T - 1) + (Math.random() - 0.5) * 2.4), 0, T - 1)
    // 5% 高亮大颗粒 → 制造景深与"火花"层次
    var spark = Math.random() < 0.05
    P.sz[i] = spark ? 1.6 + Math.random() * 0.9 : 0.55 + Math.random() * 0.8
    P.br[i] = spark ? 1 : 0.55 + Math.random() * 0.45

    // 散开态初始半径
    P.px[i] = P.hx[i] * 2.2
    P.py[i] = P.hy[i] * 2.2
    P.pz[i] = P.hz[i] * 2.2
  }
}

/* ---------------------------------------------------------------- 尺寸 */

ParticleOrb.prototype.resize = function () {
  var dpr = Math.min(globalThis.devicePixelRatio || 1, 2)
  var w = this.canvas.clientWidth || this.canvas.width
  var h = this.canvas.clientHeight || this.canvas.height
  if (!w || !h) {
    w = 1
    h = 1
  }

  this.w = w
  this.h = h
  this.dpr = dpr
  this.canvas.width = Math.round(w * dpr)
  this.canvas.height = Math.round(h * dpr)
  this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  var min = Math.min(w, h)
  this.pxPerUnit = min * this.opt.orbScale // 世界单位 → CSS 像素（persp = 1）
  this.camZ = 6.2 // 相机距离
  this.focal = 5.0 // 焦距
  this.disperScale = 1.5 // 散开半径倍率基线

  // 首帧铺底，避免拖尾从纯黑渐变
  this.ctx.globalCompositeOperation = 'source-over'
  this.ctx.globalAlpha = 1
  this.ctx.fillStyle = this.opt.alpha ? 'rgba(0,0,0,0)' : this.opt.bg
  if (this.opt.alpha) {
    this.ctx.clearRect(0, 0, w, h)
  } else {
    this.ctx.fillRect(0, 0, w, h)
  }
}

/* ---------------------------------------------------------------- 状态 */

ParticleOrb.prototype.setState = function (name, silent) {
  this.state = name
  this.externalEnergy = false
  if (name === 'thinking') {
    this.morphTarget = 1
    this.energyTarget = 0.42
    this.beatRate = 1.15
  } else if (name === 'speaking' || name === 'answering') {
    this.state = 'speaking'
    this.morphTarget = 1
    this.energyTarget = 0.86
    this.beatRate = 3.0
  } else {
    this.state = 'idle'
    this.morphTarget = 0
    // 织流定制：空闲态保留「散开自转 + 轻微脉冲」（原版 energyTarget/beatRate 均为 0，静如死水）
    this.energyTarget = 0.1
    this.beatRate = 0.6
  }
  return this
}

ParticleOrb.prototype.pulse = function (strength) {
  var s = clamp(strength == null ? 0.5 : strength, 0, 1)
  this.burst = clamp(this.burst + s, 0, 1.4)
  this._pushBloom(0.075 + 0.185 * s)
  return this
}

// 生成一圈向外扩散的柔和光晕（不是硬描边，而是一条会变宽、变淡的环带）
// 起点贴近内核表面，才能看出"由内向外推出去"的扩散过程
ParticleOrb.prototype._pushBloom = function (amp) {
  this.blooms.push({
    r: 0.62,
    amp: clamp(amp, 0, 0.5),
    tint: this._bloomIdx++ % this.rgb.length,
  })
  if (this.blooms.length > 5) this.blooms.shift()
  return this
}

ParticleOrb.prototype.setEnergy = function (v) {
  this.energyTarget = clamp(v, 0, 1)
  this.externalEnergy = true
  return this
}

ParticleOrb.prototype.setCenter = function (x, y) {
  this.center.x = clamp(x, 0, 1)
  this.center.y = clamp(y, 0, 1)
  return this
}

ParticleOrb.prototype.setCount = function (n) {
  this._buildParticles(n)
  return this
}

ParticleOrb.prototype.setPalette = function (list) {
  this.opt.palette = list.slice()
  this._buildPalette()
  this._buildSprites()
  return this
}

ParticleOrb.prototype.destroy = function () {
  cancelAnimationFrame(this._raf)
  this._unbind()
}

/* ---------------------------------------------------------------- 输入 */

ParticleOrb.prototype._bind = function () {
  var self = this
  var target = this.opt.pointerTarget || this.canvas

  this._onDown = function (e) {
    if (e.button !== undefined && e.button !== 0) return
    self.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, px: e.clientX, py: e.clientY, t: performance.now() }
    if (target.setPointerCapture) {
      try {
        target.setPointerCapture(e.pointerId)
      } catch (err) {
        /* 忽略 */
      }
    }
    self.pointer.inside = true
    self._pointerPos(e)
  }
  this._onMove = function (e) {
    self._pointerPos(e)
    if (!self.drag || e.pointerId !== self.drag.id) return
    var now = performance.now()
    var dt = Math.max(8, now - self.drag.t) / 1000
    var dx = e.clientX - self.drag.px
    var dy = e.clientY - self.drag.py
    self.drag.px = e.clientX
    self.drag.py = e.clientY
    self.drag.t = now

    self.yaw += dx * 0.0075
    self.pitch = clamp(self.pitch - dy * 0.006, -1.35, 1.35)

    // 松开后的惯性 = 拖拽末速度
    self.yawVel = self.yawVel * 0.55 + ((dx * 0.0075) / dt) * 0.45
    self.pitchVel = self.pitchVel * 0.55 + ((-dy * 0.006) / dt) * 0.45
  }
  this._onUp = function (e) {
    if (self.drag && e.pointerId !== self.drag.id) return
    self.drag = null
    if (target.releasePointerCapture) {
      try {
        target.releasePointerCapture(e.pointerId)
      } catch (err) {
        /* 忽略 */
      }
    }
  }
  this._onLeave = function () {
    self.pointer.inside = false
    self.pointer.x = -1e9
  }

  target.addEventListener('pointerdown', this._onDown)
  target.addEventListener('pointermove', this._onMove)
  target.addEventListener('pointerup', this._onUp)
  target.addEventListener('pointercancel', this._onUp)
  target.addEventListener('pointerleave', this._onLeave)

  this._onResize = function () {
    self.resize()
  }
  globalThis.addEventListener('resize', this._onResize)

  if (typeof ResizeObserver === 'function') {
    this._ro = new ResizeObserver(this._onResize)
    this._ro.observe(this.canvas)
  }

  // 离屏停止渲染
  if (typeof IntersectionObserver === 'function') {
    this._io = new IntersectionObserver(function (entries) {
      self.visible = entries[0].isIntersecting
    })
    this._io.observe(this.canvas)
  }
  this._onVis = function () {
    self.paused = !!document.hidden
  }
  document.addEventListener('visibilitychange', this._onVis)
}

ParticleOrb.prototype._unbind = function () {
  var target = this.opt.pointerTarget || this.canvas
  target.removeEventListener('pointerdown', this._onDown)
  target.removeEventListener('pointermove', this._onMove)
  target.removeEventListener('pointerup', this._onUp)
  target.removeEventListener('pointercancel', this._onUp)
  target.removeEventListener('pointerleave', this._onLeave)
  globalThis.removeEventListener('resize', this._onResize)
  document.removeEventListener('visibilitychange', this._onVis)
  if (this._ro) this._ro.disconnect()
  if (this._io) this._io.disconnect()
}

ParticleOrb.prototype._pointerPos = function (e) {
  var r = this.canvas.getBoundingClientRect()
  var x = e.clientX - r.left
  var y = e.clientY - r.top
  if (x < -40 || y < -40 || x > r.width + 40 || y > r.height + 40) {
    this.pointer.inside = false
    return
  }
  this.pointer.inside = true
  this.pointer.x = x
  this.pointer.y = y
}

/* ---------------------------------------------------------------- 帧循环 */

ParticleOrb.prototype._frame = function (now) {
  this._raf = requestAnimationFrame(this._loop)
  if (this.paused || !this.visible) {
    this._last = now
    return
  }

  var dt = this._last ? clamp((now - this._last) / 1000, 0.0005, 0.05) : 0.016
  this._last = now
  this.t += dt

  this._update(dt)
  this._render()

  // 帧率统计
  this.fps = this.fps * 0.9 + (1 / dt) * 0.1
  if (this.opt.onFrame && now - this._lastStats > 250) {
    this._lastStats = now
    this.opt.onFrame({
      fps: Math.round(this.fps),
      count: this.P.n,
      state: this.state,
      morph: this.morph,
      energy: this.energy,
    })
  }
}

ParticleOrb.prototype._update = function (dt) {
  var P = this.P
  var n = P.n
  var i

  // —— 聚合 / 散开过渡（进场 4.6/s，离场 6.8/s：离场快于进场）
  var mr = this.morphTarget > this.morph ? 4.6 : 6.8
  this.morph += (this.morphTarget - this.morph) * (1 - Math.exp(-mr * dt))
  if (Math.abs(this.morphTarget - this.morph) < 0.0015) this.morph = this.morphTarget
  var m = this.morph

  // —— 能量与冲击波衰减
  if (!this.externalEnergy) {
    this.energy += (this.energyTarget - this.energy) * (1 - Math.exp(-3.2 * dt))
  } else {
    this.energy += (this.energyTarget - this.energy) * (1 - Math.exp(-6.0 * dt))
  }
  this.burst *= Math.exp(-2.6 * dt)

  // —— 心跳：脉冲的节拍源
  this.beat += dt * this.beatRate
  if (this.beat >= TAU) {
    this.beat -= TAU
    // 每次脉冲起拍 → 向外推一圈光晕，让扩散跟节拍对齐
    if (this.energy > 0.28 && this.morph > 0.4) this._pushBloom(0.034 + 0.078 * this.energy)
  }
  var beatPulse = this.state === 'idle' ? 0 : Math.pow(Math.max(0, Math.sin(this.beat)), 1.6)
  this._beatPulse = beatPulse

  var amp = (this.reduced ? 0.4 : 1) * (0.035 + 0.105 * this.energy * beatPulse + 0.3 * this.burst)
  var wFreq = this.reduced ? 2.2 : 5.0

  // —— 中心平滑过渡
  var cr = 3.0
  this.cur.x += (this.center.x - this.cur.x) * (1 - Math.exp(-cr * dt))
  this.cur.y += (this.center.y - this.cur.y) * (1 - Math.exp(-cr * dt))

  // —— 旋转
  if (!this.drag) {
    // 松手后：角速度衰减回自转速度，并积分出旋转
    var spin = this.reduced ? 0 : this.opt.autoSpin
    var k = 1 - Math.exp(-1.5 * dt)
    this.yawVel += (spin - this.yawVel) * k
    this.pitchVel += (0 - this.pitchVel) * k
    this.yaw += this.yawVel * dt
    this.pitch += this.pitchVel * dt
  } else {
    // 拖拽中：yaw/pitch 已由指针位移直接给定，此处只保留角速度供松手后继承惯性
    this.yawVel *= Math.exp(-3.0 * dt)
    this.pitchVel *= Math.exp(-3.0 * dt)
  }
  if (this.pitch > 1.35) this.pitch = 1.35
  if (this.pitch < -1.35) this.pitch = -1.35
  var cy = Math.cos(this.yaw),
    sy = Math.sin(this.yaw)
  var cx = Math.cos(this.pitch),
    sx = Math.sin(this.pitch)

  // —— 指针排斥（先算出屏幕偏移 → 逆旋转回世界方向）
  var ptr = this.pointer
  var repelActive = !this.reduced && ptr.inside && !this.drag
  var pRx = 0,
    pRy = 0,
    pRz = 0,
    pRad = 0
  if (repelActive) {
    pRx = ptr.x - this.cur.x * this.w
    pRy = ptr.y - this.cur.y * this.h
    pRad = Math.min(this.w, this.h) * 0.19
    var l = Math.sqrt(pRx * pRx + pRy * pRy)
    if (l > pRad * 1.6) repelActive = false
  }

  // —— 逐粒子积分
  var R = 1 // 世界单位半径
  var dispBase = this.disperScale
  var wArr = P.wv

  for (i = 0; i < n; i++) {
    var hx = P.hx[i],
      hy = P.hy[i],
      hz = P.hz[i]
    var w = Math.sin(this.t * wFreq - P.ph[i])
    wArr[i] = w

    // 聚合目标：球面 × 脉冲半径
    var aggR = R * (1 + amp * w + 0.022 * Math.sin(this.t * 1.6))

    // 散开目标：围绕 Y 轴按各自速率公转（即"自转"），半径随机分布成云
    var ang = this.t * (0.06 + P.rnd2[i] * 0.3) + P.rnd[i] * TAU
    var ca = Math.cos(ang),
      sa = Math.sin(ang)
    var dR = R * (dispBase + P.rnd[i] * 0.68) * (1 + 0.015 * Math.sin(this.t * 1.1))

    var tx = hx * aggR * m + (hx * ca + hz * sa) * dR * (1 - m)
    var ty = hy * aggR * m + hy * dR * (1 - m)
    var tz = hz * aggR * m + (-hx * sa + hz * ca) * dR * (1 - m)

    var kk = P.stiff[i]
    var dmp = Math.exp(-P.damp[i] * dt)
    var vx = P.vx[i],
      vy = P.vy[i],
      vz = P.vz[i],
      px = P.px[i],
      py = P.py[i],
      pz = P.pz[i]

    vx = (vx + (tx - px) * kk * dt) * dmp
    vy = (vy + (ty - py) * kk * dt) * dmp
    vz = (vz + (tz - pz) * kk * dt) * dmp

    if (repelActive) {
      // 该粒子在视图空间的投影位置
      var x1 = px * cy + pz * sy
      var z1 = -px * sy + pz * cy
      var y2 = py * cx - z1 * sx
      var pvx = this.cur.x * this.w + x1 * this.pxPerUnit
      var pvy = this.cur.y * this.h + y2 * this.pxPerUnit
      var dxs = pvx - ptr.x,
        dys = pvy - ptr.y
      var ds = Math.sqrt(dxs * dxs + dys * dys)
      if (ds < pRad) {
        var f = 1 - ds / pRad
        f *= f
        // 屏幕方向 → 逆旋转回世界方向（屏幕偏移 z 分量为 0）
        var wdx = (-dxs / (ds || 1)) * f,
          wdy = (-dys / (ds || 1)) * f
        var iy = wdy * cx
        var iz1 = -wdy * sx
        var ix = wdx * cy - iz1 * sy
        var iz = wdx * sy + iz1 * cy
        var F = 16 * f
        vx += ix * F * dt
        vy += iy * F * dt
        vz += iz * F * dt
      }
    }

    P.px[i] = px + vx * dt
    P.py[i] = py + vy * dt
    P.pz[i] = pz + vz * dt
    P.vx[i] = vx
    P.vy[i] = vy
    P.vz[i] = vz
  }

  // —— 光晕扩散：半径向外推进，同时变宽变淡
  // 推进放慢 + 衰减放慢，让环带有足够时间"走出去"，而不是一闪即散
  for (i = this.blooms.length - 1; i >= 0; i--) {
    var bloom = this.blooms[i]
    bloom.r += (0.58 + 1.3 * bloom.amp) * dt
    bloom.amp *= Math.exp(-1.9 * dt)
    if (bloom.amp < 0.005) this.blooms.splice(i, 1)
  }
}

ParticleOrb.prototype._render = function () {
  var ctx = this.ctx
  var P = this.P
  var n = P.n
  var w = this.w,
    h = this.h
  var cxp = this.cur.x * w,
    cyp = this.cur.y * h

  // —— 拖尾：亮区残留形成光轨
  ctx.globalCompositeOperation = 'source-over'
  if (this.opt.alpha) {
    ctx.globalCompositeOperation = 'destination-out'
    ctx.fillStyle = 'rgba(0,0,0,' + this.opt.trail + ')'
    ctx.globalAlpha = 1
    ctx.fillRect(0, 0, w, h)
  } else {
    ctx.globalAlpha = this.opt.trail
    ctx.fillStyle = this.opt.bg
    ctx.fillRect(0, 0, w, h)
    ctx.globalAlpha = 1
  }

  ctx.globalCompositeOperation = 'lighter'

  // —— 内核辉光：亮度与半径都跟着脉冲"呼吸"，脉冲越强，光晕铺得越远越亮
  // 注意：叠加混合 + 拖尾会让每帧数值累积约 (1 / trail) 倍，因此这里的 alpha 必须很小
  var wave = this.energy * this._beatPulse + this.burst // 本帧脉冲强度
  var c1 = this.rgb[0]
  var c2 = this.rgb[Math.min(2, this.rgb.length - 1)]
  var c2s = c2[0] + ',' + c2[1] + ',' + c2[2]
  var glowR = this.pxPerUnit * (1.18 + 0.22 * this.energy + 0.3 * wave)
  var glowA = 0.088 + 0.062 * this.energy + 0.07 * wave
  if (this.morph > 0.15) {
    var g = ctx.createRadialGradient(cxp, cyp, 0, cxp, cyp, glowR)
    g.addColorStop(0, 'rgba(' + c1[0] + ',' + c1[1] + ',' + c1[2] + ',' + glowA.toFixed(4) + ')')
    g.addColorStop(0.3, 'rgba(' + c2s + ',' + (glowA * 0.38).toFixed(4) + ')')
    g.addColorStop(1, 'rgba(' + c2s + ',0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(cxp, cyp, glowR, 0, TAU)
    ctx.fill()
  }

  // —— 光晕扩散波：一圈向外推进的柔和环带，越远越宽、越淡
  for (var bi = 0; bi < this.blooms.length; bi++) {
    var bloom = this.blooms[bi]
    // 环带收窄，读起来是"一圈扩散的环"，而不是一团原地不动的雾气
    var rOut = bloom.r * this.pxPerUnit * 1.18
    if (rOut < 3) continue
    var rIn = Math.max(1, bloom.r * this.pxPerUnit * 0.82)
    var bc = this.rgb[bloom.tint % this.rgb.length]
    var bcs = bc[0] + ',' + bc[1] + ',' + bc[2]
    var bgrad = ctx.createRadialGradient(cxp, cyp, rIn, cxp, cyp, rOut)
    bgrad.addColorStop(0, 'rgba(' + bcs + ',0)')
    bgrad.addColorStop(0.45, 'rgba(' + bcs + ',' + bloom.amp.toFixed(4) + ')')
    bgrad.addColorStop(1, 'rgba(' + bcs + ',0)')
    ctx.fillStyle = bgrad
    ctx.beginPath()
    ctx.arc(cxp, cyp, rOut, 0, TAU)
    ctx.fill()
  }

  // —— 粒子
  var cy = Math.cos(this.yaw),
    sy = Math.sin(this.yaw)
  var cx = Math.cos(this.pitch),
    sx = Math.sin(this.pitch)
  var camZ = this.camZ,
    focal = this.focal,
    k = this.pxPerUnit
  var S = this.opt.spriteSize
  var sprites = this.sprites
  var morph = this.morph
  var energy = this.energy
  var glowK = 0.16 + 0.84 * energy * morph
  // 散开态粒子互不重叠 → 可以更亮；聚合态会大量叠加 → 必须更弱，否则内核过曝成白团
  // 蓝紫色系亮度低于青绿，系数需相应提高，否则整体发灰发闷
  var aCoeff = 0.32 - 0.262 * morph
  var wArr = P.wv

  for (var i = 0; i < n; i++) {
    var px = P.px[i],
      py = P.py[i],
      pz = P.pz[i]

    // 旋转（Y 轴 yaw → X 轴 pitch）
    var x1 = px * cy + pz * sy
    var z1 = -px * sy + pz * cy
    var y2 = py * cx - z1 * sx
    var z2 = py * sx + z1 * cx

    // 透视投影
    var denom = camZ - z2
    if (denom < 0.6) denom = 0.6
    var persp = focal / denom

    var sxp = cxp + x1 * persp * k
    var syp = cyp + y2 * persp * k

    // 视口裁剪
    var ds = (P.sz[i] * persp * 7.0 + 4) * this.dpr
    if (sxp < -ds || syp < -ds || sxp > w + ds || syp > h + ds) continue

    // 景深：靠近相机更大更亮
    var depth = clamp((persp - 0.5) * 1.5, 0.22, 1.12)
    var glow = P.br[i] + glowK * (0.5 + 0.5 * wArr[i])
    var a = clamp(aCoeff * glow * depth, 0, 0.55)

    ctx.globalAlpha = a
    var tint = P.tint[i]
    ctx.drawImage(sprites, tint * S, 0, S, S, sxp - ds / 2, syp - ds / 2, ds, ds)
  }

  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
}

export default ParticleOrb
