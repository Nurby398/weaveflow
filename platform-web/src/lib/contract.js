/**
 * 流水线契约校验结果的解析与规范化
 * ------------------------------------------------------------------
 * 后端在契约未通过时回 422，形状固定为：
 *   { error: { code: 'CONTRACT_INVALID', message,
 *              details: { ok, missing, extra, orderIssues, typeIssues, retryAllowed, maxRetries } } }
 * request.js 已把响应体挂在 error.data 上。页面不直接读裸字段，一律经本文件规范化，
 * 这样后端字段增删或换别名时只改一处。
 *
 * ContractOrderIssue 的键名尚未冻结，这里按「实际返回优先、常见别名兜底」取值：
 * 任一键缺失都只让该条显示为「—」，不会让整个面板塌掉。
 * ------------------------------------------------------------------
 */

/** 取第一个有值的键（后端字段名不确定时的兜底链） */
function firstOf(source, keys) {
  for (const key of keys) {
    const value = source[key]
    if (value !== undefined && value !== null && value !== '') return value
  }
  return null
}

/** 任意值 → 展示文本；空值返回空串（由调用方决定占位符） */
function toText(value) {
  if (value === undefined || value === null) return ''
  if (typeof value === 'object') return String(value.name ?? value.field ?? value.value ?? '')
  return String(value)
}

/** 任意值 → 整数序号；取不到返回 null（注意 Number(null) 是 0，必须先挡掉空值） */
function toIndex(value) {
  if (value === undefined || value === null || value === '') return null
  const num = Number(value)
  return Number.isInteger(num) ? num : null
}

function toTextList(value) {
  if (!Array.isArray(value)) return []
  return value.map((item) => toText(item)).filter(Boolean)
}

/** 单条顺序问题：哪个字段、应在第几位、实际在第几位、被谁占了 */
export function normalizeOrderIssue(issue) {
  const raw = issue && typeof issue === 'object' ? issue : { field: issue }
  return {
    field: toText(firstOf(raw, ['field', 'fieldName', 'name', 'key'])),
    // 后端序号若为 0 基，展示时需要 +1；未取到则显示占位符，不猜
    expectedIndex: toIndex(firstOf(raw, ['expectedIndex', 'expectedPosition', 'expected', 'shouldBe'])),
    actualIndex: toIndex(firstOf(raw, ['actualIndex', 'actualPosition', 'actual', 'isAt'])),
    occupiedBy: toText(firstOf(raw, ['occupiedBy', 'takenBy', 'heldBy', 'conflictWith', 'actualField'])),
  }
}

/** 单条类型问题：字段、期望类型、实际类型 */
export function normalizeTypeIssue(issue) {
  const raw = issue && typeof issue === 'object' ? issue : { field: issue }
  return {
    field: toText(firstOf(raw, ['field', 'fieldName', 'name', 'key'])),
    expected: toText(firstOf(raw, ['expected', 'expectedType', 'want'])),
    actual: toText(firstOf(raw, ['actual', 'actualType', 'got', 'received'])),
  }
}

/** details → 面板直接可用的结构（缺失字段全部有安全默认值） */
export function normalizeContractDetails(details) {
  const raw = details && typeof details === 'object' ? details : {}
  const maxRetries = toIndex(raw.maxRetries)
  return {
    ok: raw.ok === true,
    missing: toTextList(raw.missing),
    extra: toTextList(raw.extra),
    orderIssues: Array.isArray(raw.orderIssues) ? raw.orderIssues.map(normalizeOrderIssue) : [],
    typeIssues: Array.isArray(raw.typeIssues) ? raw.typeIssues.map(normalizeTypeIssue) : [],
    valueDrift: Array.isArray(raw.valueDrift) ? raw.valueDrift.map(normalizeValueDrift) : [],
    retryAllowed: raw.retryAllowed === true,
    maxRetries: maxRetries !== null && maxRetries > 0 ? maxRetries : 0,
  }
}

/** 值漂移条目：继承字段被本阶段改错（缺陷 C，后端仅在传 expectedInherited 时返回） */
function normalizeValueDrift(raw) {
  return {
    field: toText(firstOf(raw, ['field', 'key', 'name'])) || '—',
    expected: raw?.expected,
    actual: raw?.actual,
  }
}

/** 值的人话展示：数组/对象转 JSON，标量直出（与后端 describeValueDrift 同义） */
function valueText(value) {
  if (value === undefined || value === null) return String(value)
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

/** 值漂移的人话文案：`字段 应沿用上游 X，实际是 Y` */
export function describeValueDrift(drift) {
  return `${drift.field} 应沿用上游 ${valueText(drift.expected)}，实际是 ${valueText(drift.actual)}`
}

/**
 * 从 422 异常里取出契约失败信息；不是契约失败（网络错误、500、400…）时返回 null。
 * @returns {null | { code, message, ok, missing, extra, orderIssues, typeIssues, retryAllowed, maxRetries }}
 */
export function pickContractFailure(error) {
  const body = error?.data
  const payload = body && typeof body === 'object' && body.error && typeof body.error === 'object' ? body.error : body
  if (!payload || typeof payload !== 'object') return null
  if (payload.code !== 'CONTRACT_INVALID') return null
  return {
    code: payload.code,
    message: toText(payload.message) || '契约校验未通过',
    ...normalizeContractDetails(payload.details),
  }
}

/** 面板是否有内容可列（未通过但四类清单都为空时，仍要显示「未通过」） */
export function hasContractIssues(details) {
  if (!details) return false
  return (
    details.ok !== true ||
    details.missing.length > 0 ||
    details.extra.length > 0 ||
    details.orderIssues.length > 0 ||
    details.typeIssues.length > 0 ||
    details.valueDrift.length > 0
  )
}

/** 重试预算文案：必须在界面上直接说清「还能重试几次」还是「已用尽」 */
export function retryHint(details) {
  if (!details) return '尚未提交校验'
  if (!details.retryAllowed) return '重试预算已用尽'
  return details.maxRetries > 0 ? `还可以重试 ${details.maxRetries} 次` : '还可以重试'
}

/** 序号展示：1 基显示；缺失显示「—」 */
export function formatIndex(index) {
  return Number.isInteger(index) ? `第 ${index} 位` : '第 — 位'
}
