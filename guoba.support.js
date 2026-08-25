import fs from 'node:fs'
import YAML from 'yaml'
import _path from 'node:path'
import _ from 'lodash'

// ── 配置路径 ──
const CONFIG_FILE = 'plugins/genshin/config/mys.pushNews.yaml'
const DEFAULT_CONFIG = 'plugins/genshin/defSet/mys/pushNews.yaml'

// 通用设置（mys.set.yaml）
const SET_FILE = 'plugins/genshin/config/mys.set.yaml'
const SET_DEFAULT = 'plugins/genshin/defSet/mys/set.yaml'

// ── 工具函数 ──
function readConfig() {
  const file = _path.resolve(process.cwd(), CONFIG_FILE)
  if (fs.existsSync(file)) return YAML.parse(fs.readFileSync(file, 'utf-8'))
  const def = _path.resolve(process.cwd(), DEFAULT_CONFIG)
  if (fs.existsSync(def)) return YAML.parse(fs.readFileSync(def, 'utf-8'))
  return {}
}

function saveConfig(cfg) {
  fs.writeFileSync(_path.resolve(process.cwd(), CONFIG_FILE), YAML.stringify(cfg), 'utf-8')
}

/** 读取 mys.set.yaml，无用户配置时回落默认配置 */
function readSet() {
  const file = _path.resolve(process.cwd(), SET_FILE)
  if (fs.existsSync(file)) return YAML.parse(fs.readFileSync(file, 'utf-8')) || {}
  const def = _path.resolve(process.cwd(), SET_DEFAULT)
  if (fs.existsSync(def)) return YAML.parse(fs.readFileSync(def, 'utf-8')) || {}
  return {}
}

/** 写入 mys.set.yaml，用 Document 保留原有注释 */
function saveSet(patch) {
  const file = _path.resolve(process.cwd(), SET_FILE)
  const src = fs.existsSync(file)
    ? fs.readFileSync(file, 'utf-8')
    : fs.readFileSync(_path.resolve(process.cwd(), SET_DEFAULT), 'utf-8')

  const doc = YAML.parseDocument(src)
  for (const [key, val] of Object.entries(patch)) {
    doc.set(key, val)
  }
  fs.writeFileSync(file, String(doc), 'utf-8')
}

/**
 * YAML 格式：{ "QQ号": ["群1", "群2"] }
 * GSubForm 格式：[{ botId: "QQ号", groupId: ["群1", "群2"] }]
 */

/** YAML → GSubForm 数组 */
function toGSubForm(obj) {
  if (!obj || typeof obj !== 'object') return []
  const list = []
  for (const [botId, groups] of Object.entries(obj)) {
    if (Array.isArray(groups)) {
      list.push({ botId, groupId: groups.map(String) })
    }
  }
  return list
}

/** GSubForm 数组 → YAML 对象 */
function fromGSubForm(arr) {
  if (!Array.isArray(arr)) return {}
  const obj = {}
  for (const item of arr) {
    if (item.botId && Array.isArray(item.groupId)) {
      obj[String(item.botId)] = item.groupId.map(String)
    }
  }
  return obj
}

// ── 推送群字段定义（按游戏分组） ──
const GROUPS = [
  ['原神推送', [
    { key: 'gsannounceGroup', label: '公告推送群' },
    { key: 'gsinfoGroup', label: '资讯推送群' },
    { key: 'gsActivityPush', label: '活动到期推送群' },
  ]],
  ['星铁推送', [
    { key: 'srannounceGroup', label: '公告推送群' },
    { key: 'srinfoGroup', label: '资讯推送群' },
    { key: 'srActivityPush', label: '活动到期推送群' },
  ]],
  ['绝区零推送', [
    { key: 'zzzannounceGroup', label: '公告推送群' },
    { key: 'zzzinfoGroup', label: '资讯推送群' },
  ]],
  ['未定事件簿推送', [
    { key: 'wdannounceGroup', label: '公告推送群' },
    { key: 'wdinfoGroup', label: '资讯推送群' },
  ]],
  ['崩坏3推送', [
    { key: 'bbbannounceGroup', label: '公告推送群' },
    { key: 'bbbinfoGroup', label: '资讯推送群' },
  ]],
  ['崩坏学园2推送', [
    { key: 'bbannounceGroup', label: '公告推送群' },
    { key: 'bbinfoGroup', label: '资讯推送群' },
  ]],
]

// ── 收集所有推送群的 field key ──
const GROUP_KEYS = _.flatMap(GROUPS, ([, items]) => items.map(f => f.key))

// ── mys.set.yaml 中的探索相关字段 ──
// Switch 项：前端布尔 ↔ YAML 0/1
const SET_BOOL_KEYS = [
  'exploreStyle',
  'exploreShowOfferings',
  'exploreShowAreas',
  'exploreShowBosses',
  'exploreSendEmail',
  'exploreSmtpSecure',
]
// 文本/数字项：原样读写
const SET_RAW_KEYS = [
  'exploreSmtpHost',
  'exploreSmtpPort',
  'exploreSmtpUser',
  'exploreSmtpPass',
  'exploreColWorld',
  'exploreColArea',
  'exploreColMax',
  'exploreColCur',
  'exploreColGap',
  'exploreMailNotice',
]

// ── 推送群子表单模板（GSubForm + GSelectGroup，复用于所有14个字段）──
const GROUP_SUBFORM_SCHEMA = {
  component: 'GSubForm',
  componentProps: {
    multiple: true,
    schemas: [
      {
        field: 'botId',
        label: '推送账号',
        component: 'Input',
        required: true,
        componentProps: {
          placeholder: '请输入机器人/QQ账号ID',
        },
      },
      {
        field: 'groupId',
        label: '推送群',
        helpMessage: '选择该账号需要推送到哪些群',
        component: 'GSelectGroup',
        componentProps: {
          placeholder: '点击选择群聊',
        },
      },
    ],
  },
}

// ── 构建 schemas 数组 ──
const buildSchemas = () => {
  const schemas = []

  // 推送群配置
  for (const [groupLabel, items] of GROUPS) {
    schemas.push({ component: 'SOFT_GROUP_BEGIN', label: groupLabel })
    for (const item of items) {
      schemas.push({
        field: item.key,
        label: item.label,
        bottomHelpMessage: `配置${item.label}，可添加多个账号，每个账号选择多个群`,
        ...GROUP_SUBFORM_SCHEMA,
      })
    }
  }

  // 通用设置
  schemas.push({ component: 'SOFT_GROUP_BEGIN', label: '通用设置' })

  schemas.push({
    field: 'pushTime',
    label: '推送频率',
    bottomHelpMessage: 'Cron 表达式，控制定时任务执行频率，默认每小时一次',
    component: 'EasyCron',
    componentProps: { placeholder: '0 0/1 * * * ?' },
  })

  schemas.push({
    field: 'maxNum',
    label: '单次最大推送条数',
    bottomHelpMessage: '每次定时任务最多同时推送的条数，默认20',
    component: 'InputNumber',
    required: true,
    componentProps: { min: 1, max: 50, placeholder: '20' },
  })

  // 原神探索
  schemas.push({ component: 'SOFT_GROUP_BEGIN', label: '原神探索' })

  schemas.push({
    field: 'exploreStyle',
    label: '新版探索度样式',
    bottomHelpMessage:
      '开启后 #探索 使用米游社「世界探索」风格的世界卡片展示探索度（含主区域与子区域进度条）；关闭则使用旧版简洁列表。仅影响原神，星铁不受影响',
    component: 'Switch',
  })

  schemas.push({
    field: 'exploreShowOfferings',
    label: '显示聚所/特殊供奉',
    bottomHelpMessage: '开启后在新版探索度卡片中显示「聚所/特殊供奉」区块（如挪德卡莱的8个聚所）。仅在新版样式下生效',
    component: 'Switch',
  })

  schemas.push({
    field: 'exploreShowAreas',
    label: '显示详细区域探索度',
    bottomHelpMessage: '开启后在新版探索度卡片中显示「详细区域探索度」区块（如璃月的碧水原、珉林等细分区域列表）。仅在新版样式下生效',
    component: 'Switch',
  })

  schemas.push({
    field: 'exploreShowBosses',
    label: '显示区域首领图鉴',
    bottomHelpMessage: '开启后在新版探索度卡片中显示「区域首领图鉴」区块（已击杀次数）。仅在新版样式下生效',
    component: 'Switch',
  })

  // 探索度表格邮件
  schemas.push({ component: 'SOFT_GROUP_BEGIN', label: '探索度表格邮件' })

  schemas.push({
    field: 'exploreSendEmail',
    label: '出图后发送表格邮件',
    bottomHelpMessage:
      '开启后 #探索 出图成功时额外生成 xlsx 表格（地图区域 / 峰值上限 / 当前探索 / 距离达峰）并发送到下方邮箱。需先在 Yunzai 根目录执行 pnpm add exceljs nodemailer。仅新版样式的原神探索支持',
    component: 'Switch',
  })

  schemas.push({
    field: 'exploreSmtpHost',
    label: 'SMTP 服务器',
    bottomHelpMessage: '发件邮箱的 SMTP 地址，如 QQ 邮箱为 smtp.qq.com，163 为 smtp.163.com',
    component: 'Input',
    componentProps: { placeholder: 'smtp.qq.com' },
  })

  schemas.push({
    field: 'exploreSmtpPort',
    label: 'SMTP 端口',
    bottomHelpMessage: 'SSL 加密一般为 465，STARTTLS 一般为 587',
    component: 'InputNumber',
    componentProps: { min: 1, max: 65535, placeholder: '465' },
  })

  schemas.push({
    field: 'exploreSmtpSecure',
    label: '使用 SSL',
    bottomHelpMessage: '端口 465 时开启，端口 587 时关闭',
    component: 'Switch',
  })

  schemas.push({
    field: 'exploreSmtpUser',
    label: '发件邮箱账号',
    bottomHelpMessage: '用于发送邮件的邮箱地址，同时作为发件人显示',
    component: 'Input',
    componentProps: { placeholder: 'yourname@qq.com' },
  })

  schemas.push({
    field: 'exploreSmtpPass',
    label: '邮箱授权码',
    bottomHelpMessage: '邮箱的 SMTP 授权码，不是登录密码。QQ/163 邮箱需在设置中单独开启并生成',
    component: 'InputPassword',
    componentProps: { placeholder: '邮箱设置中生成的授权码' },
  })

  schemas.push({
    field: 'exploreMailNotice',
    label: '提示文字',
    bottomHelpMessage:
      '附加在「即将发送邮件」提示与邮件正文末尾的说明文字。留空则不显示',
    component: 'Input',
    componentProps: {
      type: 'textarea',
      rows: 2,
      placeholder: '# 注意：可给机器人发送  #关闭邮件发送  、#开启邮件发送  控制是否发送邮件',
    },
  })

  // 表格列名
  schemas.push({ component: 'SOFT_GROUP_BEGIN', label: '表格列名' })

  schemas.push({
    field: 'exploreColWorld',
    label: '大区域 列名',
    bottomHelpMessage: 'xlsx 表格中第一列（国家/大区域）的表头名称。留空则用默认值「大区域」',
    component: 'Input',
    componentProps: { placeholder: '大区域' },
  })

  schemas.push({
    field: 'exploreColArea',
    label: '地图区域 列名',
    bottomHelpMessage: 'xlsx 表格中子区域名称列的表头。留空则用默认值「地图区域」',
    component: 'Input',
    componentProps: { placeholder: '地图区域' },
  })

  schemas.push({
    field: 'exploreColMax',
    label: '峰值上限 列名',
    bottomHelpMessage: 'xlsx 表格中区域探索度上限列的表头。留空则用默认值「峰值上限」',
    component: 'Input',
    componentProps: { placeholder: '峰值上限' },
  })

  schemas.push({
    field: 'exploreColCur',
    label: '当前探索 列名',
    bottomHelpMessage: 'xlsx 表格中当前探索度列的表头。留空则用默认值「当前探索」',
    component: 'Input',
    componentProps: { placeholder: '当前探索' },
  })

  schemas.push({
    field: 'exploreColGap',
    label: '距离达峰 列名',
    bottomHelpMessage: 'xlsx 表格中差值列的表头，该列为 0 时显示绿色、不为 0 显示红色。留空则用默认值「距离达峰」',
    component: 'Input',
    componentProps: { placeholder: '距离达峰' },
  })

  return schemas
}

const schemas = buildSchemas()

// ── 锅巴支持入口 ──
export function supportGuoba() {
  return {
    pluginInfo: {
      name: 'genshin',
      title: 'Genshin',
      author: '@Yoimiya-Kokomi',
      authorLink: 'https://github.com/yoimiya-kokomi',
      link: 'https://github.com/yoimiya-kokomi/Miao-Yunzai/tree/master/plugins/genshin',
      isV3: true,
      isV2: true,
      description: '米游社公告/资讯推送、日历查询、角色面板、养成计算等综合功能插件',
      icon: 'mdi:sword-cross',
      iconColor: '#7cb9e8',
    },

    configInfo: {
      schemas,

      /** 读取配置 → 前端数据格式 */
      getConfigData() {
        const cfg = readConfig()
        const data = {}

        // 推送群：YAML 对象 → GSubForm 数组
        for (const key of GROUP_KEYS) {
          data[key] = toGSubForm(cfg[key])
        }

        // 通用设置
        data.pushTime = cfg.pushTime || '0 0/1 * * * ?'
        data.maxNum = Number(cfg.maxNum) || 20

        // 原神探索（存在 mys.set.yaml，Switch用布尔值）
        const set = readSet()
        data.exploreStyle = Number(set.exploreStyle ?? 1) === 1
        data.exploreShowOfferings = Number(set.exploreShowOfferings ?? 1) === 1
        data.exploreShowAreas = Number(set.exploreShowAreas ?? 1) === 1
        data.exploreShowBosses = Number(set.exploreShowBosses ?? 1) === 1

        // 探索度表格邮件
        data.exploreSendEmail = Number(set.exploreSendEmail ?? 0) === 1
        data.exploreSmtpHost = set.exploreSmtpHost || ''
        data.exploreSmtpPort = Number(set.exploreSmtpPort ?? 465)
        data.exploreSmtpSecure = Number(set.exploreSmtpSecure ?? 1) === 1
        data.exploreSmtpUser = set.exploreSmtpUser || ''
        data.exploreSmtpPass = set.exploreSmtpPass || ''
        data.exploreMailNotice =
          set.exploreMailNotice ?? '# 注意：可给机器人发送  #关闭邮件发送  、#开启邮件发送  控制是否发送邮件'

        // 表格列名（留空时前端显示默认值）
        data.exploreColWorld = set.exploreColWorld || '大区域'
        data.exploreColArea = set.exploreColArea || '地图区域'
        data.exploreColMax = set.exploreColMax || '峰值上限'
        data.exploreColCur = set.exploreColCur || '当前探索'
        data.exploreColGap = set.exploreColGap || '距离达峰'

        return data
      },

      /** 前端数据 → 写入配置文件 */
      setConfigData(data, { Result }) {
        const cfg = readConfig()

        for (const [keyPath, val] of Object.entries(data)) {
          // 原神探索开关：写入 mys.set.yaml，布尔值转 0/1
          if (SET_BOOL_KEYS.includes(keyPath)) {
            saveSet({ [keyPath]: val ? 1 : 0 })
            continue
          }
          // 原神探索文本/数字项：原样写入 mys.set.yaml
          if (SET_RAW_KEYS.includes(keyPath)) {
            saveSet({ [keyPath]: val ?? '' })
            continue
          }

          // 跳过未知字段
          if (!GROUP_KEYS.includes(keyPath) && !['pushTime', 'maxNum'].includes(keyPath))
            continue

          // 推送群字段：GSubForm 数组 → YAML 对象
          cfg[keyPath] = GROUP_KEYS.includes(keyPath) ? fromGSubForm(val) : val
        }

        saveConfig(cfg)
        return Result.ok({}, '保存成功~')
      },
    },
  }
}
