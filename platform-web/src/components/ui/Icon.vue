<script setup>
/**
 * Icon 图标统一入口
 * ------------------------------------------------------------------
 * 全站图标一律走这里，**页面里不允许再直接 import 图标组件**。
 *
 * 为什么要有这层：
 *   1. 之前全站图标是 Unicode 字符（◍ ◉ ◇ ◎ ⚙ ◔ ◈ ⊕ ☰ …），不同字体下大小/基线/粗细全不一致，
 *      是「界面不精致」的主要来源之一；换成矢量图标库后必须有一个统一入口才能保证尺寸与颜色一致；
 *   2. 语义名（chat / agents / send）与具体图标解耦：将来换图标库、或把某个图标换成更贴切的，
 *      只改这一张表，不用去十几个页面里搜。
 * 颜色一律用 currentColor 继承父级（图标不自己决定颜色），尺寸走 size 属性。
 *
 * 实现底座：Element Plus 的 <el-icon>（图标本体来自 @element-plus/icons-vue）。
 */
import { computed } from 'vue'
import {
  Aim,
  Box,
  ChatDotRound,
  CircleCheck,
  CircleClose,
  Coin,
  Collection,
  Connection,
  DataLine,
  Delete,
  Document,
  Download,
  Edit,
  Expand,
  Files,
  Filter,
  Flag,
  Fold,
  HomeFilled,
  InfoFilled,
  Key,
  Link,
  Loading,
  MagicStick,
  Menu,
  Moon,
  MoreFilled,
  Notebook,
  Odometer,
  Paperclip,
  Plus,
  Promotion,
  Reading,
  Refresh,
  Setting,
  Share,
  Star,
  Sunny,
  Switch as SwitchIcon,
  Timer,
  TrendCharts,
  Upload,
  User,
  UserFilled,
  VideoPause,
  View,
  Warning,
} from '@element-plus/icons-vue'

/** 语义名 → 图标组件（唯一映射表） */
const REGISTRY = {
  /* 导航与身份 */
  /* 品牌标记（brand）已从本表移除：品牌位改用介绍页/登录页那套「深色圆 + 白色旋转椭圆」
     （用户点名要求一致），全仓已无 name="brand" 引用，Cpu 也随之下线。 */
  chat: ChatDotRound,
  agents: MagicStick,
  teams: UserFilled,
  settings: Setting,
  profile: User,
  home: HomeFilled,
  menu: Menu,
  fold: Fold,
  expand: Expand,
  connection: Connection,
  share: Share,

  /* 对话 */
  new: Plus,
  send: Promotion,
  attach: Paperclip,
  stop: VideoPause,
  knowledge: Reading,
  skill: Collection,

  /* 通用动作 */
  plus: Plus,
  delete: Delete,
  edit: Edit,
  refresh: Refresh,
  upload: Upload,
  download: Download,
  copy: Document,
  view: View,
  more: MoreFilled,
  filter: Filter,
  link: Link,
  key: Key,
  star: Star,
  aim: Aim,

  /* 主题切换（明亮 / 深色） */
  sun: Sunny,
  moon: Moon,

  /* 数据与状态 */
  box: Box,
  files: Files,
  document: Document,
  notebook: Notebook,
  data: DataLine,
  trend: TrendCharts,
  gauge: Odometer,
  timer: Timer,
  coin: Coin,
  flag: Flag,
  switch: SwitchIcon,
  check: CircleCheck,
  warning: Warning,
  danger: CircleClose,
  success: CircleCheck,
  info: InfoFilled,
  loading: Loading,
}

const props = defineProps({
  /** 语义名，见上面的 REGISTRY */
  name: { type: String, required: true },
  /** 尺寸（px 或任意 CSS 长度），默认跟随字号 */
  size: { type: [Number, String], default: '' },
  /** 是否旋转（加载态用） */
  spin: { type: Boolean, default: false },
})

const component = computed(() => REGISTRY[props.name] || null)
const style = computed(() => {
  if (props.size === '' || props.size === null) return undefined
  const length = typeof props.size === 'number' ? `${props.size}px` : props.size
  return { width: length, height: length }
})
</script>

<template>
  <el-icon
    v-if="component"
    class="ui-icon"
    :class="{ 'is-spin': spin }"
    :style="style"
    aria-hidden="true"
    focusable="false"
  >
    <component :is="component" />
  </el-icon>
  <!-- 名字写错时不静默什么都不显示，留一个可见的占位便于发现 -->
  <span v-else class="ui-icon ui-icon--missing" :style="style" aria-hidden="true">?</span>
</template>

<style scoped>
.ui-icon {
  display: inline-block;
  flex: none;
  width: 1em;
  height: 1em;
  /* 图标颜色一律继承文本色，不在图标层决定配色 */
  color: inherit;
  vertical-align: -0.125em;
}

/* el-icon 会把子 svg 按 1em（跟随字号）定尺寸，而织流的 Icon 是用 width/height
   显式控制图标盒的（size 传 px 时尤其明显），这里把 svg 拉回「填满图标盒」。
   color/fill 一起钉住：EP 有些父组件会给 svg 直接指定颜色（如 .el-empty__image svg），
   织流的约定是「图标颜色一律继承文本色」，不能被上层组件的 svg 规则改掉。 */
.ui-icon :deep(svg) {
  width: 100%;
  height: 100%;
  color: inherit;
  fill: currentColor;
}

.ui-icon.is-spin {
  animation: ui-icon-spin 900ms linear infinite;
}

.ui-icon--missing {
  text-align: center;
  line-height: 1;
  color: var(--ui-danger-label);
}

@keyframes ui-icon-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .ui-icon.is-spin {
    animation-duration: 2s;
  }
}
</style>
