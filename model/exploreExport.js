import fs from 'node:fs'
import path from 'node:path'
import YAML from 'yaml'
import lodash from 'lodash'
import moment from 'moment'
import gsCfg from './gsCfg.js'

/** 邮件黑名单文件（拉黑的QQ不发送邮件） */
const BLACK_FILE = 'plugins/genshin/config/mys.exploreMailBlack.yaml'
const BLACK_DEFAULT = 'plugins/genshin/defSet/mys/exploreMailBlack.yaml'

/** 表格列的默认显示名（可在 mys.set.yaml 中覆盖） */
const DEF_COLS = {
  exploreColWorld: '大区域',
  exploreColArea: '地图区域',
  exploreColMax: '峰值上限',
  exploreColCur: '当前探索',
  exploreColGap: '距离达峰'
}

/** 默认提示语 */
const DEF_NOTICE = '# 注意：可给机器人发送  #关闭邮件发送  、#开启邮件发送  控制是否发送邮件'

/**
 * 探索度表格导出 + 邮件发送
 *
 * 数据来源：RoleIndex.roleExplore() 返回的 worldCards
 * 每行一个区域：大区域 / 地图区域 / 峰值上限 / 当前探索 / 距离达峰
 * 列名可在 mys.set.yaml 中自定义（exploreColXxx）
 *
 * 依赖（需在 Yunzai 根目录安装）：
 *   pnpm add exceljs nodemailer
 * 未安装时会记录日志并跳过，不影响 #探索 出图。
 */
export default class ExploreExport {
  constructor (e) {
    this.e = e
    this._path = process.cwd().replace(/\\/g, '/')
  }

  // ────────────── 黑名单读写 ──────────────

  /** 读取黑名单QQ数组 */
  static readBlack () {
    try {
      let file = path.resolve(process.cwd(), BLACK_FILE)
      if (!fs.existsSync(file)) {
        let def = path.resolve(process.cwd(), BLACK_DEFAULT)
        if (!fs.existsSync(def)) return []
        file = def
      }
      let cfg = YAML.parse(fs.readFileSync(file, 'utf-8')) || {}
      return (cfg.blackQQ || []).map(String)
    } catch (err) {
      logger.error(`[探索导出] 读取邮件黑名单失败：${err?.message || err}`)
      return []
    }
  }

  /** 写入黑名单QQ数组 */
  static saveBlack (list) {
    let file = path.resolve(process.cwd(), BLACK_FILE)
    let dir = path.dirname(file)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    let doc = {
      blackQQ: lodash.uniq(list.map(String))
    }
    let head = '# 探索度表格邮件黑名单\n# 列表内的QQ执行 #探索 时不会收到表格邮件\n# 用户可发送 #关闭邮件发送 / #开启邮件发送 自行增删\n'
    fs.writeFileSync(file, head + YAML.stringify(doc), 'utf-8')
  }

  /** 该QQ是否在黑名单中 */
  static isBlack (qq) {
    if (!qq) return false
    return ExploreExport.readBlack().includes(String(qq))
  }

  /**
   * 拉黑（关闭邮件发送）
   * @return true 本次新增，false 之前已在黑名单
   */
  static addBlack (qq) {
    let list = ExploreExport.readBlack()
    if (list.includes(String(qq))) return false
    list.push(String(qq))
    ExploreExport.saveBlack(list)
    return true
  }

  /**
   * 移出黑名单（开启邮件发送）
   * @return true 本次移除，false 本来就不在黑名单
   */
  static delBlack (qq) {
    let list = ExploreExport.readBlack()
    if (!list.includes(String(qq))) return false
    ExploreExport.saveBlack(lodash.without(list, String(qq)))
    return true
  }

  // ────────────── 配置读取 ──────────────

  /** 表格列显示名 */
  static getCols (cfg) {
    let cols = {}
    for (let [key, def] of Object.entries(DEF_COLS)) {
      cols[key] = String(cfg?.[key] ?? '').trim() || def
    }
    return cols
  }

  /** 提示语，留空则不显示 */
  static getNotice (cfg) {
    return cfg?.exploreMailNotice === '' ? '' : (cfg?.exploreMailNotice ?? DEF_NOTICE)
  }

  /**
   * 收件邮箱：谁触发命令就发给谁 —— 取其QQ号拼 @qq.com
   * 非QQ平台（user_id 不是纯数字QQ号，如QQBot openid / 频道 / TG）
   * 返回 '' —— 解析不出邮箱时不发送
   */
  static getMailTo (e) {
    let qq = String(e?.user_id ?? '').trim()
    if (!/^[1-9]\d{4,11}$/.test(qq)) return ''
    return `${qq}@qq.com`
  }

  /**
   * 出图时的文字提示：本次是否会发邮件，返回空串表示不提示
   * 供 apps/role.js 在回复图片时一并发送
   */
  static tipText (data, e) {
    try {
      let cfg = gsCfg.getConfig('mys', 'set') || {}
      if (Number(cfg.exploreSendEmail ?? 0) !== 1) return ''
      if (!data?.worldCards?.length) return ''
      if (!cfg.exploreSmtpHost || !cfg.exploreSmtpUser || !cfg.exploreSmtpPass) return ''
      if (ExploreExport.isBlack(e?.user_id)) return ''

      let mailTo = ExploreExport.getMailTo(e)
      if (!mailTo) return ''

      let cols = ExploreExport.getCols(cfg)
      let notice = ExploreExport.getNotice(cfg)
      let lines = [
        `UID ${data.uid || e?.uid || ''} 的探索度表格将发送至 ${mailTo}。`,
        `包含：${cols.exploreColArea} / ${cols.exploreColMax} / ${cols.exploreColCur} / ${cols.exploreColGap}。`
      ]
      if (notice) lines.push(notice)
      return lines.join('\n')
    } catch (err) {
      logger.error(`[探索导出] 生成提示失败：${err?.message || err}`)
      return ''
    }
  }

  // ────────────── 主流程 ──────────────

  /** 入口：出图成功后调用。返回 true 表示邮件已发出 */
  static async trySend (data, e) {
    try {
      return await new ExploreExport(e).run(data)
    } catch (err) {
      logger.error(`[探索导出] 执行异常：${err?.stack || err}`)
      return false
    }
  }

  async run (data) {
    let cfg = gsCfg.getConfig('mys', 'set') || {}

    // 总开关：默认关闭（0）
    if (Number(cfg.exploreSendEmail ?? 0) !== 1) return false

    // 仅原神新版探索有 worldCards 数据
    if (!data?.worldCards?.length) {
      logger.mark('[探索导出] 无 worldCards 数据（可能是旧版样式/星铁），跳过')
      return false
    }

    // 先校验 SMTP 配置，避免配置不全时白生成文件
    if (!cfg.exploreSmtpHost || !cfg.exploreSmtpUser || !cfg.exploreSmtpPass) {
      logger.warn('[探索导出] SMTP 配置不完整（服务器/账号/授权码），跳过。请在锅巴面板「探索度表格邮件」中配置')
      return false
    }

    // 用户自行关闭（在黑名单中）
    let qq = this.e?.user_id
    if (ExploreExport.isBlack(qq)) {
      logger.mark(`[探索导出] QQ${qq} 已关闭邮件发送，跳过`)
      return false
    }

    // 收件人取触发者的QQ邮箱，取不到就不必白生成文件
    if (!ExploreExport.getMailTo(this.e)) {
      logger.warn(`[探索导出] user_id=${qq} 不是QQ号，无法确定收件邮箱，跳过`)
      return false
    }

    let rows = this.buildRows(data.worldCards)
    if (!rows.length) {
      logger.mark('[探索导出] 无可导出的区域数据，跳过')
      return false
    }

    let filePath = await this.genXlsx(rows, data, cfg)
    if (!filePath) return false

    return await this.sendMail(filePath, data, cfg)
  }

  /**
   * 扁平化 worldCards → 表格行
   * 优先使用 areas（细分区域），无细分则用 percents（主/子区域）
   */
  buildRows (worldCards) {
    let rows = []
    for (let card of worldCards) {
      let list = (card.areas && card.areas.length) ? card.areas : (card.percents || [])
      for (let item of list) {
        let cur = Number(item.percent) || 0
        let max = item.maxPercent != null ? Number(item.maxPercent) : null
        // 距离达峰：峰值 - 当前，最小为 0；无峰值数据时留空
        let gap = max != null ? lodash.round(Math.max(max - cur, 0), 1) : null
        rows.push({
          world: card.name,
          area: item.name,
          max: max,
          cur: cur,
          gap: gap
        })
      }
    }
    return rows
  }

  /** 生成 xlsx，返回文件路径；exceljs 缺失时返回 '' */
  async genXlsx (rows, data, cfg = {}) {
    let ExcelJS
    try {
      ExcelJS = (await import('exceljs')).default
    } catch (err) {
      logger.error('[探索导出] 未安装 exceljs，无法生成表格。请在 Yunzai 根目录执行：pnpm add exceljs')
      return ''
    }

    let cols = ExploreExport.getCols(cfg)

    let wb = new ExcelJS.Workbook()
    wb.creator = 'Miao-Yunzai genshin'
    wb.created = new Date()
    let ws = wb.addWorksheet('探索度')

    ws.columns = [
      { header: cols.exploreColWorld, key: 'world', width: 16 },
      { header: cols.exploreColArea, key: 'area', width: 22 },
      { header: `${cols.exploreColMax}(%)`, key: 'max', width: 14 },
      { header: `${cols.exploreColCur}(%)`, key: 'cur', width: 14 },
      { header: `${cols.exploreColGap}(%)`, key: 'gap', width: 14 }
    ]

    // 表头样式
    let head = ws.getRow(1)
    head.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD4B98C' } }
    head.alignment = { vertical: 'middle', horizontal: 'center' }

    // 按大区域分组，组间空两行
    let groups = lodash.groupBy(rows, 'world')
    let dataRows = []
    let names = lodash.uniq(rows.map((r) => r.world))
    names.forEach((name, idx) => {
      if (idx > 0) {
        ws.addRow([])
        ws.addRow([])
      }
      for (let r of groups[name]) {
        let row = ws.addRow({
          world: r.world,
          area: r.area,
          max: r.max ?? '-',
          cur: r.cur,
          gap: r.gap ?? '-'
        })
        // 距离达峰：0 绿色（已达峰），非0 红色（仍有差距）
        if (r.gap != null) {
          row.getCell('gap').font = {
            bold: true,
            color: { argb: r.gap <= 0 ? 'FF2E9E4F' : 'FFD03050' }
          }
        }
        dataRows.push(row.number)
      }
    })

    // 全部内容居中 + 仅数据行加边框（空行不加，保持留白）
    ws.eachRow((row) => {
      let isData = row.number === 1 || dataRows.includes(row.number)
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
        if (isData) {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFDDDDDD' } },
            left: { style: 'thin', color: { argb: 'FFDDDDDD' } },
            bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } },
            right: { style: 'thin', color: { argb: 'FFDDDDDD' } }
          }
        }
      })
    })

    // 文件名用 uid，方便后续覆盖更新
    let uid = String(data?.uid || this.e?.uid || 'unknown').replace(/[^\w-]/g, '')
    let dir = path.join(this._path, 'plugins/genshin/data/exploreExport')
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    let file = path.join(dir, `${uid}.xlsx`)

    await wb.xlsx.writeFile(file)
    logger.mark(`[探索导出] 表格已生成：${file}`)
    return file
  }

  /**
   * 通过 SMTP 发送邮件（附件为 xlsx）
   * ── SMTP 配置接口（mys.set.yaml）──
   *   exploreSmtpHost    SMTP 服务器地址，如 smtp.qq.com
   *   exploreSmtpPort    端口，如 465
   *   exploreSmtpSecure  是否 SSL：1 开 / 0 关（465 用 1，587 用 0）
   *   exploreSmtpUser    发件邮箱账号
   *   exploreSmtpPass    发件邮箱授权码（非登录密码）
   *
   * 收件人固定为触发命令的用户自己：QQ号 + @qq.com
   */
  async sendMail (filePath, data, cfg) {
    let nodemailer
    try {
      nodemailer = (await import('nodemailer')).default
    } catch (err) {
      logger.error('[探索导出] 未安装 nodemailer，无法发送邮件。请在 Yunzai 根目录执行：pnpm add nodemailer')
      return false
    }

    let host = cfg.exploreSmtpHost
    let user = cfg.exploreSmtpUser
    let pass = cfg.exploreSmtpPass
    if (!host || !user || !pass) {
      logger.warn('[探索导出] SMTP 配置不完整（服务器/账号/授权码），跳过发送')
      return false
    }

    let port = Number(cfg.exploreSmtpPort ?? 465)
    let secure = Number(cfg.exploreSmtpSecure ?? 1) === 1
    // 收件人：触发命令的用户QQ邮箱
    let mailTo = ExploreExport.getMailTo(this.e)
    if (!mailTo) {
      logger.warn(`[探索导出] user_id=${this.e?.user_id} 不是QQ号，无法确定收件邮箱，跳过发送`)
      return false
    }

    let transporter = nodemailer.createTransport({
      host, port, secure,
      auth: { user, pass }
    })

    let uid = data?.uid || this.e?.uid || ''
    let nickname = data?.gamename || ''
    let dateStr = moment().format('YYYY-MM-DD HH:mm')
    let cols = ExploreExport.getCols(cfg)
    let notice = ExploreExport.getNotice(cfg)

    let text = [
      `UID ${uid} 的探索度表格见附件。`,
      `包含：${cols.exploreColArea} / ${cols.exploreColMax} / ${cols.exploreColCur} / ${cols.exploreColGap}。`
    ]
    if (notice) text.push(notice)
    text.push('', `生成时间：${dateStr}`)

    try {
      await transporter.sendMail({
        from: `"原神探索度" <${user}>`,
        to: mailTo,
        subject: `【原神探索度】${nickname}(${uid}) - ${dateStr}`,
        text: text.join('\n'),
        attachments: [
          { filename: path.basename(filePath), path: filePath }
        ]
      })
      logger.mark(`[探索导出] 邮件已发送 → ${mailTo}`)
      return true
    } catch (err) {
      logger.error(`[探索导出] 邮件发送失败：${err?.message || err}`)
      return false
    }
  }
}
