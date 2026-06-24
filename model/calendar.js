import MysInfo from './mys/mysInfo.js'

const _path = process.cwd().replace(/\\/g, '/')
const miaores = `${_path}/plugins/miao-plugin/resources/stat/imgs/hard`
// 幽境危战 难度图标 (difficulty 1-6)
const HC_DIFF_ICONS = {
  1: `${miaores}/medal_1.png`,
  2: `${miaores}/medal_2.png`,
  3: `${miaores}/medal_3.png`,
  4: `${miaores}/medal_4.png`,
  5: `${miaores}/medal_5.png`,
  6: `${miaores}/medal_6.png`,
}

export default class Calendar {
  static detectGame(e) {
    const msg = e?.msg || ''
    if (e?.game) return e.game
    if (/绝区零|ZZZ|zzz/i.test(msg)) return 'zzz'
    if (e?.isSr || /星铁|星穹铁道/i.test(msg)) return 'sr'
    return 'gs'
  }

  static async get(e) {
    const G = Calendar.detectGame(e)
    const c = new Calendar(G)
    if (G === 'zzz') return c.getZzz(e)
    if (G === 'sr') return c.getSr(e)
    return c.getGs(e)
  }

  constructor(G) { this.G = G }

  async getGs(e) { let r = await MysInfo.get(e, 'act_calendar'); if (!r || r.retcode) return false; return { game: 'gs', ...this.fGs(r.data) } }
  async getSr(e) { let r = await MysInfo.get(e, 'act_calendar'); if (!r || r.retcode) return false; return { game: 'sr', ...this.fSr(r.data) } }
  async getZzz(e) {
    let r = await MysInfo.get(e, { gacha_calendar: {}, activity_calendar: {} })
    if (!r || !Array.isArray(r)) return false
    let [gr, ar] = r
    if (!gr || gr.retcode || !ar || ar.retcode) return false
    return { game: 'zzz', ...this.fZzz(gr.data, ar.data) }
  }

  fGs(d) {
    const n = Date.now()
    return W(d.avatar_card_pool_list?.[0]?.version_name || '',
      (d.avatar_card_pool_list || []).map(b => B(b.pool_name || '', b.version_name || '', dt(b.start_timestamp), dt(b.end_timestamp), n,
        (b.avatars || []).map(a => ({ name: a.name, icon: a.icon, rarity: a.rarity, element: a.element })),
        (b.weapon || []).map(w => ({ name: w.name, icon: w.icon, rarity: typeof w.rarity === 'number' ? w.rarity : 5 })))),
      (d.weapon_card_pool_list || []).map(b => B(b.pool_name || '', b.version_name || '', dt(b.start_timestamp), dt(b.end_timestamp), n,
        (b.avatars || []).map(a => ({ name: a.name, icon: a.icon, rarity: a.rarity, element: a.element })),
        (b.weapon || []).map(w => ({ name: w.name, icon: w.icon, rarity: typeof w.rarity === 'number' ? w.rarity : 5 })))),
      (d.mixed_card_pool_list || []).map(b => B(b.pool_name || '', b.version_name || '', dt(b.start_timestamp), dt(b.end_timestamp), n,
        (b.avatars || []).map(a => ({ name: a.name, icon: a.icon, rarity: a.rarity, element: a.element })),
        (b.weapon || []).map(w => ({ name: w.name, icon: w.icon, rarity: typeof w.rarity === 'number' ? w.rarity : 5 })))),
      [...(d.act_list || []), ...(d.fixed_act_list || [])].map(e => {
        const s = dt(e.start_timestamp, 1), ed = dt(e.end_timestamp, 1)
        return E(e.name, s, ed, n, (e.reward_list || []).filter(r => r.homepage_show).map(r => ({ name: r.name, icon: r.icon, num: r.num })),
          e.tower_detail || null, e.role_combat_detail || null, e.hard_challenge_detail || null)
      })
    )
  }

  fSr(d) {
    const n = Date.now()
    return W(d.cur_game_version || d.avatar_card_pool_list?.[0]?.version || '',
      (d.avatar_card_pool_list || []).map(b => {
        const t = b.time_info || {}
        return B(b.name || '', b.version || '', dt(t.start_ts), dt(t.end_ts), n,
          (b.avatar_list || []).map(a => ({ name: a.item_name, icon: a.icon_url, rarity: +a.rarity || 5, element: a.damage_type_name || '' })),
          (b.equip_list || []).map(w => ({ name: w.item_name, icon: w.item_url, rarity: +w.rarity || 5 })))
      }),
      (d.equip_card_pool_list || []).map(b => {
        const t = b.time_info || {}
        return B(b.name || '', b.version || '', dt(t.start_ts), dt(t.end_ts), n,
          (b.avatar_list || []).map(a => ({ name: a.item_name, icon: a.icon_url, rarity: +a.rarity || 5, element: a.damage_type_name || '' })),
          (b.equip_list || []).map(w => ({ name: w.item_name, icon: w.item_url, rarity: +w.rarity || 5 })))
      }),
      [],
      [...(d.act_list || []).map(e => {
        const t = e.time_info || {}; const s = dt(t.start_ts), ed = dt(t.end_ts)
        const sm = { DoubleRewardActStatusProgress: 1, DoubleRewardActStatusUnopened: 0, OtherActStatusUnopened: 0, OtherActStatusFinish: 2, SignStatusFinish: 2 }
        const Rs = []; const sp = e.special_reward
        if (sp?.item_id && sp.name && sp.num) Rs.push({ name: sp.name, icon: sp.icon, num: sp.num })
        return E(e.name, s, ed, n, Rs, null, null, null, e.show_text || '', e.current_progress, e.total_progress, sm[e.act_status] ?? undefined)
      }), ...(d.challenge_list || []).map(c => {
        const t = c.time_info || {}; const s = dt(t.start_ts), ed = dt(t.end_ts)
        const tn = { ChallengeTypePeak: '异相仲裁', ChallengeTypeChasm: '混沌回忆', ChallengeTypeStory: '虚构叙事', ChallengeTypeBoss: '末日幻影' }[c.challenge_type] || ''
        const Rs = []; const sp = c.special_reward
        if (sp?.item_id && sp.name && sp.num) Rs.push({ name: sp.name, icon: sp.icon, num: sp.num })
        return E(`${tn ? tn + ' · ' : ''}${c.name_mi18n || ''}`, s, ed, n, Rs, null, null, null, c.show_text || '', c.current_progress, c.total_progress)
      })]
    )
  }

  fZzz(gd, ad) {
    const n = Date.now(), R = { S: 5, A: 4 }
    return W(gd.avatar_gacha_schedule_list?.[0]?.version || '',
      (gd.avatar_gacha_schedule_list || []).map(b => B('角色活动调频', b.version || '', dt(b.start_ts), dt(b.end_ts), n,
        (b.avatar_list || []).map(a => ({ name: a.avatar_name, icon: a.icon, rarity: R[a.rarity] || 4, element: zE(a.avatar_element_type) })), [])),
      (gd.weapon_gacha_schedule_list || []).map(b => B('音擎活动调频', b.version || '', dt(b.start_ts), dt(b.end_ts), n, [],
        (b.weapon_list || []).map(w => ({ name: w.talent_title || w.weapon_name || w.name || '音擎', icon: w.icon, rarity: R[w.rarity] || 4 })))),
      [],
      (ad.activity_list || []).map(e => {
        const s = dt(e.start_ts), ed = dt(e.end_ts)
        const sc = { STATE_IN_PROGRESS: 1, STATE_NOT_START: 0 }[e.state]
        const Rs = []
        if (e.monochrome_cnt) Rs.push({ name: '菲林', icon: 'https://act.mihoyo.com/app/mihoyo-zzz-game-record/images/icon-feilin-large.7850ba22.png', num: e.monochrome_cnt })
        return E(e.name, s, ed, n, Rs, null, null, null, '', -1, -1, sc)
      })
    )
  }
}

// ======= 构建器 =======
function W(v, cb, wb, mb, ev) {
  return {
    version: v ? `v${v}` : '', charBanners: cb, weaponBanners: wb, mixedBanners: mb,
    hasMixed: mb.length > 0, allEvents: ev, eventCount: ev.length,
    bannerCount: cb.length + wb.length + mb.length,
    updateTime: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
    miaores: `${_path}/plugins/miao-plugin/resources/stat/imgs/hard`
  }
}

function B(name, version, st, et, n, A, W) {
  const f5 = A.filter(a => a.rarity === 5), f4 = A.filter(a => a.rarity === 4)
  const w5 = W.filter(w => w.rarity === 5), w4 = W.filter(w => w.rarity === 4)
  const on = et && st && st <= n && et > n, up = st && st > n
  const rInfo = remInfo(st, et, n)
  return { name, version, startTime: fmt(st), endTime: fmt(et), on, up,
    fiveStars: f5, fourStars: f4, fiveWeapons: w5, fourWeapons: w4,
    remaining: rInfo.text,
    remainingDays: rInfo.days,
    remainingUrgent: rInfo.urgent,
    remainingType: rInfo.type,
    remText: rInfo.type === 'ongoing' ? `剩余 ${rInfo.text} 结束` : rInfo.type === 'upcoming' ? `${rInfo.text} 后开启` : '',
    status: on ? '进行中' : up ? '即将开启' : '已结束',
    statusClass: on ? 'ongoing' : up ? 'upcoming' : 'ended',
    hasChars: f5.length + f4.length > 0, hasWeapons: w5.length + w4.length > 0 }
}

function E(name, st, et, n, Rs, tower, rc, hc, showText, cp, tp, actSc) {
  const inRange = et && st && st <= n && et > n
  // actSc: 1=进行中, 0=未开启, 2=已标记完成(如签到完成)
  // actSc=2 时如果时间仍在范围内 → 进行中; 只有时间也过了才 → 已结束
  const on = et && st && (actSc === 1 || actSc === 2 || (actSc == null && inRange)) ? inRange : false
  const up = st && (actSc === 0 || (actSc == null && st > n))
  const drawEnded = !on && !up
  const rInfo = remInfo(st, et, n)
  const hcDetail = hc ? { ...hc, diffIcon: HC_DIFF_ICONS[hc.difficulty] || '' } : null
  return { name, on, up, startTime: fmt(st), endTime: fmt(et), rewards: Rs || [],
    remaining: rInfo.text,
    remainingDays: rInfo.days,
    remainingUrgent: rInfo.urgent,
    remainingType: rInfo.type,
    remText: rInfo.type === 'ongoing' ? `剩余 ${rInfo.text} 结束` : rInfo.type === 'upcoming' ? `${rInfo.text} 后开启` : '',
    status: on ? '进行中' : up ? '即将开启' : drawEnded ? '已结束' : '进行中',
    statusClass: on ? 'ongoing' : up ? 'upcoming' : drawEnded ? 'ended' : 'ongoing',
    towerDetail: tower || null, roleCombatDetail: rc || null, hardChallengeDetail: hcDetail || null,
    showText: showText || '', curProg: cp != null ? cp : -1, totalProg: tp != null ? tp : -1 }
}

// ======= 工具 =======
function dt(v, sZ) { if (!v) return null; const n = +v; return (!n || (sZ && n === 0)) ? null : new Date(n * 1000) }
function fmt(d) { if (!d) return ''; const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}` }
function remInfo(s, e, n) {
  if (!e) return { text: '已结束', ms: 0, days: 0, urgent: false, type: 'ended' }
  const ongoing = !s || s <= n
  const target = ongoing ? e : s
  const ms = target - n
  if (ms <= 0) return { text: '已结束', ms: 0, days: 0, urgent: false, type: 'ended' }
  const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000), m = Math.floor((ms % 3600000) / 60000)
  const p = []
  if (d > 0) p.push(`${d}天`)
  if (h > 0) p.push(`${h}时`)
  if (m > 0 || p.length === 0) p.push(`${m}分`)
  const duration = p.join('')
  const type = ongoing ? 'ongoing' : 'upcoming'
  return { text: duration, ms, days: d, urgent: type === 'ongoing' && d < 5, type }
}
function zE(t) { const m = { 200: 'physical', 201: 'fire', 202: 'ice', 203: 'electro', 204: 'wind', 205: 'ether' }; return m[t] || '' }
