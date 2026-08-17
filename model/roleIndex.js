import fs from 'node:fs'
import path from 'node:path'
import lodash from 'lodash'
import moment from 'moment'
import fetch from 'node-fetch'
import base from './base.js'
import MysInfo from './mys/mysInfo.js'
import gsCfg from './gsCfg.js'
import { Character } from '#miao.models'

// let dsz = '待实装'
const elemAlias = {
  anemo: '风',
  geo: '岩',
  electro: '雷',
  dendro: '草',
  pyro: '火',
  hydro: '水',
  cryo: '冰'
}
export default class RoleIndex extends base {
  constructor(e) {
    super(e)
    this.model = 'roleIndex'
    this.other = gsCfg.getdefSet('role', 'other')
    this.wother = gsCfg.getdefSet('weapon', 'other')
    this.lable = gsCfg.getdefSet('role', 'index')

    this.area = {
      蒙德: 1,
      璃月: 2,
      雪山: 3,
      稻妻: 4,
      渊下宫: 5,
      层岩巨渊: 6,
      层岩地下: 7,
      须弥: 8,
      枫丹: 9,
      沉玉谷: 10,
      来歆山: 11,
      沉玉谷·南陵: 12,
      沉玉谷·上谷: 13,
      旧日之海: 14,
      纳塔: 15,
      远古圣山: 16,
      挪德卡莱: 17,
      风息山: 18,
      空之神殿: 19,
      至冬: 20
    }

    /**
     * 新版探索度卡片：主卡 -> 归属其下的子区域world id
     * 与米游社「世界探索」页面分组一致
     */
    this.worldChildren = {
      1: [3, 18],
      2: [6, 7, 10, 11, 12, 13],
      4: [5],
      9: [14],
      15: [16]
    }

    /** 子区域 -> 主卡 反查表 */
    this.worldParent = {}
    lodash.forEach(this.worldChildren, (children, pid) => {
      for (let cid of children) this.worldParent[cid] = Number(pid)
    })

    /** 各主卡配色，取自米游社页面 */
    this.worldTheme = {
      1: { bg: 'rgb(74, 100, 92)', from: 'rgb(64, 255, 232)', to: 'rgb(38, 124, 153)' },
      2: { bg: 'rgb(124, 99, 76)', from: 'rgb(255, 180, 35)', to: 'rgb(138, 13, 13)' },
      4: { bg: 'rgb(85, 79, 89)', from: 'rgb(204, 128, 255)', to: 'rgb(122, 77, 153)' },
      8: { bg: 'rgb(94, 100, 77)', from: 'rgb(52, 234, 81)', to: 'rgb(26, 145, 82)' },
      9: { bg: 'rgb(68, 82, 111)', from: 'rgb(0, 192, 255)', to: 'rgb(0, 115, 153)' },
      15: { bg: 'rgb(103, 80, 75)', from: 'rgb(255, 80, 64)', to: 'rgb(153, 38, 38)' },
      17: { bg: 'rgb(75, 86, 129)', from: 'rgb(75, 210, 255)', to: 'rgb(38, 124, 153)' },
      19: { bg: 'rgb(68, 82, 111)', from: 'rgb(0, 192, 255)', to: 'rgb(0, 115, 153)' },
      20: { bg: 'rgb(47, 120, 162)', from: 'rgb(25, 86, 150)', to: 'rgb(9, 121, 172)' }
    }

    /** 主卡神像等级名称，默认七天神像 */
    this.statueName = {
      17: '新月神像',
      19: '空之神殿·摹忆中枢'
    }

    this.all_chest = 0
    lodash.forEach(this.lable, (v, i) => {
      if (i.includes('_chest')) this.all_chest += v
    })

    this.areaName = lodash.invert(this.area)

    this.headIndexStyle = `<style> .head_box { background: url(${this.screenData.pluResPath}img/roleIndex/namecard/${lodash.random(1, 8)}.png) #f5f5f5; background-position-x: 30px; background-repeat: no-repeat; border-radius: 15px; font-family: tttgbnumber; padding: 10px 20px; position: relative; background-size: auto 101%; }</style>`
  }

  static async get(e) {
    let roleIndex = new RoleIndex(e)
    return await roleIndex.getIndex()
  }

  async getIndex() {
    let ApiData = {
      index: '',
      spiralAbyss: { schedule_type: 1 },
      character: '',
      basicInfo: ''
    }
    let res = await MysInfo.get(this.e, ApiData)

    if (!res || res[0].retcode !== 0 || res[2].retcode !== 0) return false

    let ret = []
    res.forEach(v => ret.push(v.data))

    /** 截图数据 */
    let data = {
      quality: 100,
      ...this.screenData,
      ...this.dealData(ret)
    }
    // console.log(...this.dealData(ret))
    return data
  }

  dealData(data) {
    let [resIndex, resAbyss, resDetail, basicInfo] = data

    let avatars = resDetail.avatars || []
    let roleArr = avatars

    for (let i in avatars) {
      let rarity = avatars[i].rarity
      let liveNum = avatars[i].actived_constellation_num
      let level = avatars[i].level
      let id = avatars[i].id - 10000000

      if (rarity >= 5) {
        rarity = 5
      }
      // 埃洛伊排到最后
      if (rarity > 5) {
        id = 0
      }
      // 增加神里排序
      if (avatars[i].id == 10000002) {
        id = 50
      }

      if (avatars[i].id == 10000005) {
        avatars[i].name = '空'
        liveNum = 0
        level = 0
      } else if (avatars[i].id == 10000007) {
        avatars[i].name = '荧'
        liveNum = 0
        level = 0
      }
      avatars[i].sortLevel = level
      // id倒序，最新出的角色拍前面
      avatars[i].sort = rarity * 100000 + liveNum * 10000 + level * 100 + id

      avatars[i].weapon.showName = this.wother.sortName[avatars[i].weapon.name] ?? avatars[i].weapon.name

      avatars[i].costumesLogo = ''
      if (avatars[i].costumes && avatars[i].costumes.length >= 1) {
        for (let val of avatars[i].costumes) {
          if (this.other.costumes.includes(val.name)) {
            avatars[i].costumesLogo = 2
            break
          }
        }
      }
    }

    let stats = resIndex.stats || {}

    let percentage = lodash.round(
      ((stats.precious_chest_number +
        stats.luxurious_chest_number +
        stats.exquisite_chest_number +
        stats.common_chest_number +
        stats.magic_chest_number) /
        this.all_chest) *
      100,
      1
    )

    let afterPercentage =
      (percentage < 60
        ? 'D'
        : percentage < 70
          ? 'C'
          : percentage < 80
            ? 'B'
            : percentage < 90
              ? 'A'
              : 'S') + `[${percentage}%]`

    let line = [
      [
        { lable: '成就', num: stats.achievement_number, extra: this.lable.achievement },
        { lable: '角色数', num: stats.avatar_number, extra: this.lable.avatar },
        { lable: '等级', num: resIndex?.role?.level ?? 0, extra: this.lable.level },
        {
          lable: '总宝箱',
          num:
            stats.precious_chest_number +
            stats.luxurious_chest_number +
            stats.exquisite_chest_number +
            stats.common_chest_number +
            stats.magic_chest_number,
          extra: this.all_chest
        },
        {

          lable: '获取率',
          num: afterPercentage,
          color:
            afterPercentage.substr(0, 1) == 'D'
              ? '#12a182'
              : afterPercentage.substr(0, 1) == 'C'
                ? '#2775b6'
                : afterPercentage.substr(0, 1) == 'B'
                  ? '#806d9e'
                  : afterPercentage.substr(0, 1) == 'A'
                    ? '#c04851'
                    : afterPercentage.substr(0, 1) == 'S'
                      ? '#f86b1d'
                      : '',
        }
      ],
      [
        { lable: '华丽宝箱', num: stats.luxurious_chest_number, extra: this.lable.luxurious_chest },
        { lable: '珍贵宝箱', num: stats.precious_chest_number, extra: this.lable.precious_chest },
        { lable: '精致宝箱', num: stats.exquisite_chest_number, extra: this.lable.exquisite_chest },
        { lable: '普通宝箱', num: stats.common_chest_number, extra: this.lable.common_chest }
      ]
    ]

    // 尘歌壶
    let homesLevel = 0
    // let homesItem = 0
    if (resIndex.homes && resIndex.homes.length > 0) {
      homesLevel = resIndex.homes[0].level
      // homesItem = resIndex.homes[0].item_num
    }

    let worldExplorations = lodash.keyBy(resIndex.world_explorations, 'id')

    let explor = []
    let explor2 = []

    let expArr = ['至冬', '挪德卡莱', '纳塔', '枫丹', '须弥', '层岩巨渊']
    let expArr2 = ['渊下宫', '稻妻', '雪山', '璃月', '蒙德']

    for (let val of expArr) {
      let tmp = {
        lable: val,
        num: `${(worldExplorations[this.area[val]]?.exploration_percentage ?? 0) / 10}%`
      }
      explor.push(tmp)
    }

    for (let val of expArr2) {
      let tmp = {
        lable: val,
        num: `${(worldExplorations[this.area[val]]?.exploration_percentage ?? 0) / 10}%`
      }
      explor2.push(tmp)
    }

    explor2.push({ lable: '家园等级', num: homesLevel })

    line.push(explor)
    line.push(explor2)

    if (avatars.length > 0) {
      // 重新排序
      avatars = lodash.chain(avatars).orderBy(['sortLevel'], ['desc'])
      if (this.e.msg.includes('角色')) {
        avatars = avatars.slice(0, 12)
      }
      avatars = avatars.orderBy(['sort'], ['desc']).value()
    }

    // 深渊
    let abyss = this.abyssAll(roleArr, resAbyss)

    return {
      uid: this.e.uid,
      saveId: this.e.uid,
      activeDay: this.dayCount(stats.active_day_number),
      line,
      basicInfo,
      avatars,
      abyss,
      headIndexStyle: this.headIndexStyle
    }
  }

  // 处理深渊数据
  abyssAll(roleArr, resAbyss) {
    let abyss = {}

    if (roleArr.length <= 0) {
      return abyss
    }
    if (resAbyss?.total_battle_times <= 0) {
      return abyss
    }
    if (resAbyss?.reveal_rank.length <= 0) {
      return abyss
    }
    // 打了三层才放出来
    if (resAbyss?.floors.length <= 2) {
      return abyss
    }

    let startTime = moment(resAbyss.startTime)
    let time = Number(startTime.month()) + 1 + '月'

    let totalStar = 0
    let star = []
    for (let val of resAbyss.floors) {
      if (val.index < 9) {
        continue
      }
      totalStar += val.star
      star.push(val.star)
    }
    totalStar = totalStar + '（' + star.join('-') + '）'

    let dataName = ['damage', 'take_damage', 'defeat', 'normal_skill', 'energy_skill']
    let data = []
    let tmpRole = []
    for (let val of dataName) {
      if (resAbyss[`${val}_rank`].length <= 0) {
        resAbyss[`${val}_rank`] = [
          {
            value: 0,
            avatar_id: 10000007
          }
        ]
      }
      data[val] = {
        num: resAbyss[`${val}_rank`][0].value,
        name: gsCfg.roleIdToName(resAbyss[`${val}_rank`][0].avatar_id)
      }

      if (data[val].num > 1000) {
        data[val].num = (data[val].num / 10000).toFixed(1)
        data[val].num += ' w'
      }

      if (tmpRole.length < 4 && !tmpRole.includes(resAbyss[`${val}_rank`][0].avatar_id)) {
        tmpRole.push(resAbyss[`${val}_rank`][0].avatar_id)
      }
    }

    let list = []

    let avatar = lodash.keyBy(roleArr, 'id')

    for (let val of resAbyss.reveal_rank) {
      if (avatar[val.avatar_id]) {
        val.life = avatar[val.avatar_id].actived_constellation_num
      } else {
        val.life = 0
      }
      val.name = gsCfg.roleIdToName(val.avatar_id)
      list.push(val)
    }

    return {
      time,
      max_floor: resAbyss.max_floor,
      totalStar,
      list,
      total_battle_times: resAbyss.total_battle_times,
      ...data
    }
  }

  dayCount(num) {
    let daysDifference = Math.floor((new Date() - new Date('2020-09-15')) / (1000 * 60 * 60 * 24)) + 1
    let days = Math.floor(num)
    let msg = '活跃天数：' + days + `/${daysDifference}天`
    return msg
  }

  async roleCard() {
    this.model = 'roleCard'
    let res = await MysInfo.get(this.e, 'index')

    if (!res || res.retcode !== 0) return false

    return this.roleCardData(res.data)
  }

  roleCardData(res) {
    let role = res.role
    if (!role) {
      role = {
        'nickname': this.e.sender.card.replace(this.e.uid, '').trim(),
        'level': 0,
        'game_head_icon': `https://q1.qlogo.cn/g?b=qq&s=0&nk=${this.e.user_id}`
      }
    }
    let stats = res.stats
    let line = [
      [
        { lable: '活跃天数', num: stats.active_day_number },
        { lable: '成就', num: stats.achievement_number },
        { lable: '等级', num: role.level },
        { lable: '角色数', num: stats.avatar_number },
        { lable: '满好感角色数', num: stats.full_fetter_avatar_num },
        {
          lable: '总宝箱',
          num:
            stats.precious_chest_number +
            stats.luxurious_chest_number +
            stats.exquisite_chest_number +
            stats.common_chest_number +
            stats.magic_chest_number
        }
      ],
      [
        { lable: '华丽宝箱', num: stats.luxurious_chest_number },
        { lable: '珍贵宝箱', num: stats.precious_chest_number },
        { lable: '精致宝箱', num: stats.exquisite_chest_number },
        { lable: '普通宝箱', num: stats.common_chest_number },
        { lable: '奇馈宝箱', num: stats.magic_chest_number },
        { lable: '传送点', num: stats.way_point_number }
      ]
    ]

    let explor1 = []
    let explor2 = []

    res.world_explorations = lodash.orderBy(res.world_explorations, ['id'], ['desc'])

    for (let val of res.world_explorations) {
      val.name = this.areaName[val.id] ? this.areaName[val.id] : lodash.truncate(val.name, { length: 6 })

      let tmp = { lable: val.name, num: `${val.exploration_percentage / 10}%` }

      if (explor1.length < 5) {
        explor1.push(tmp)
      } else {
        explor2.push(tmp)
      }
    }

    explor2 = explor2.concat([
      { lable: '月神瞳', num: stats.moonoculus_number },
      { lable: '火神瞳', num: stats.pyroculus_number },
      { lable: '水神瞳', num: stats.hydroculus_number },
      { lable: '草神瞳', num: stats.dendroculus_number },
      { lable: '雷神瞳', num: stats.electroculus_number },
      { lable: '岩神瞳', num: stats.geoculus_number },
      { lable: '风神瞳', num: stats.anemoculus_number }
    ])

    line.push(explor1)
    line.push(explor2.slice(0, 5))

    let avatars = res.avatars
    avatars = avatars.slice(0, 8)

    for (let i in avatars) {
      if (avatars[i].id == 10000005) {
        avatars[i].name = '空'
      }
      if (avatars[i].id == 10000007) {
        avatars[i].name = '荧'
      }
      let char = Character.get(avatars[i].name)
      avatars[i].img = char.imgs?.gacha
      avatars[i].element = elemAlias[char.elem] || '风'
    }

    return {
      saveId: this.e.uid,
      uid: this.e.uid,
      role,
      line,
      avatars,
      bg: lodash.random(1, 3),
      ...this.screenData
    }
  }

  async roleExplore() {
    this.model = 'roleExplore'
    if (this.e?.isSr || this.e?.game === 'sr') {
      this.e.isSr = true
      this.e.game = 'sr'
      let res = await MysInfo.get(this.e, {
        index: '',
        chestInfo: '',
        basicInfo: ''
      })

      if (!res || res[0].retcode !== 0 || res[1].retcode !== 0 || res[2].retcode !== 0) return false

      let srData = res.map(v => v.data)
      
      // 保存探索数据到本地JSON（已注释，避免频繁写入）
      // this.saveExploreData(['index', 'chestInfo', 'basicInfo'], srData)

      return this.roleExploreSrData(srData)
    }

    let ApiData = {
      index: '',
      basicInfo: ''
    }
    let res = await MysInfo.get(this.e, ApiData)

    if (!res || res[0].retcode !== 0) return false

    let ret = []
    res.forEach((v) => ret.push(v.data))

    // 保存探索数据到本地JSON（已注释，避免频繁写入）
    // this.saveExploreData(Object.keys(ApiData), ret)

    return this.roleExploreData(ret)
  }

  /** 接口探索度为千分数，转百分比字符串 */
  explorePercent(num) {
    return lodash.round((Number(num) || 0) / 10, 1)
  }

  /**
   * 获取区域背景图：仅使用本地图片
   * @param {string} regionName - 区域名称
   * @param {string} networkUrl - 接口返回的网络图片URL（已废弃）
   * @return {string} 本地图片路径
   */
  getLocalBgImage(regionName, networkUrl) {
    if (!regionName) return ''
    return `bg/${regionName}.png`
  }

  /**
   * 获取供奉图标：仅使用本地图片
   * @param {string} offeringName - 供奉名称
   * @param {string} networkUrl - 接口返回的网络图片URL（已废弃）
   * @return {string} 本地图片路径
   */
  getLocalOfferingIcon(offeringName, networkUrl) {
    if (!offeringName) return ''

    // 移除"聚所·"前缀，用于文件名匹配
    const cleanName = offeringName.replace(/^聚所·/, '')
    return `offerings/${cleanName}.png`
  }

  /**
   * 构建新版探索度世界卡片数据
   * @param worldExplorations index接口的 world_explorations
   * @param maxData 峰值探索度数据 {区域中文名: 峰值}
   * @return 卡片数组，按 id 倒序（与米游社一致）
   */
  worldCardData(worldExplorations, maxData = {}) {
    let worlds = lodash.keyBy(worldExplorations || [], 'id')

    // 主卡：world_type为2的国家，或未被归入其他卡片的顶层区域
    let cardIds = lodash
      .filter(worldExplorations || [], (w) => !this.worldParent[w.id] && !w.parent_id)
      .map((w) => w.id)

    let cards = []
    for (let id of lodash.orderBy(cardIds, [(v) => Number(v)], ['desc'])) {
      let world = worlds[id]
      if (!world) continue

      let theme = this.worldTheme[id] || {}
      let childIds = this.worldChildren[id] || []
      let children = lodash.compact(childIds.map((cid) => worlds[cid]))

      // 探索度进度条：主区域 + 各子区域
      let percents = []
      let mainLable = children.length > 0 ? '主要区域' : world.name
      percents.push({
        name: mainLable,
        percent: this.explorePercent(world.exploration_percentage),
        maxPercent: maxData[world.name] || null
      })
      for (let child of children) {
        // 仅作为容器的区域（自身0%但有下级）不单独占一行
        let hasSub = lodash.some(children, (o) => o.parent_id === child.id)
        if (hasSub && !child.exploration_percentage) continue
        percents.push({
          name: child.name,
          percent: this.explorePercent(child.exploration_percentage),
          maxPercent: maxData[child.name] || null
        })
      }

      // 详细区域探索度：本区域细分区域，末尾追加各子区域
      // 子区域接口无 area_exploration_list，米游社页面同样是把子区域本身接在列表末尾
      let areas = (world.area_exploration_list || []).map((a) => ({
        name: a.name,
        percent: this.explorePercent(a.exploration_percentage),
        maxPercent: maxData[a.name] || null
      }))
      for (let child of children) {
        // 仅作容器的区域（自身0%但有下级）不占一行，与进度条规则一致
        let hasSub = lodash.some(children, (o) => o.parent_id === child.id)
        if (hasSub && !child.exploration_percentage) continue
        areas.push({
          name: child.name,
          percent: this.explorePercent(child.exploration_percentage),
          maxPercent: maxData[child.name] || null
        })
      }

      // 等级行：神像 -> 供奉物 -> 声望
      let statue = this.statueName[id] || '七天神像'
      let levels = []

      // 聚所/特殊供奉：本区域及子区域的所有offerings（数量多时不混入levels）
      let offeringsData = [...(world.offerings || [])]
      for (let child of children) offeringsData.push(...(child.offerings || []))
      offeringsData = lodash.uniqBy(offeringsData, 'name')
      offeringsData = lodash.filter(offeringsData, (o) => o.name !== statue)
      offeringsData = offeringsData.map((o) => ({
        name: o.name,
        level: o.level ?? 0,
        icon: this.getLocalOfferingIcon(o.name, o.icon)
      }))

      // 纳塔部族声望：tribal_list 也作为 offerings 显示
      if (Number(id) === 15 && world.natan_reputation?.tribal_list) {
        const tribalOfferings = world.natan_reputation.tribal_list.map((tribe) => ({
          name: tribe.name,
          level: tribe.level ?? 0,
          icon: `offerings/${tribe.name}.png`
        }))
        offeringsData.push(...tribalOfferings)
      }

      // 区域首领图鉴：本区域及子区域的所有boss
      let bosses = [...(world.boss_list || [])]
      for (let child of children) bosses.push(...(child.boss_list || []))
      bosses = lodash.uniqBy(bosses, 'name')
      bosses = bosses.map((b) => ({
        name: b.name,
        killNum: b.kill_num ?? 0
      }))
      levels.push({
        icon: 'seven-statue-icon.png',
        name: `${statue}等级`,
        value: world.seven_statue_level ?? 0
      })

      // offerings数量<=3时混入levels显示，>3单独展示
      if (offeringsData.length <= 3) {
        for (let offering of offeringsData) {
          levels.push({
            icon: offering.icon,
            name: `${offering.name}等级`,
            value: offering.level
          })
        }
      }

      if (world.level > 0) {
        levels.push({
          icon: 'country-level-icon.png',
          name: '声望等级',
          value: world.level
        })
      }

      cards.push({
        id,
        name: world.name,
        icon: world.icon || '',
        bgImage: this.getLocalBgImage(world.name, world.background_image),
        bg: theme.bg || 'rgb(68, 82, 111)',
        gradient: theme.from
          ? `linear-gradient(103deg, ${theme.from} 50%, ${theme.to} 100%)`
          : '',
        levels,
        percents,
        areas,
        offerings: offeringsData,
        bosses
      })
    }

    return cards
  }

  /**
   * 保存探索接口返回的原始数据到插件根目录
   * 路径：plugins/genshin/data/roleExplore/{gs|sr}/{uid}.json
   * @param keys 接口名列表，与 dataList 一一对应
   * @param dataList 接口返回的 data 列表
   */
  saveExploreData(keys, dataList) {
    try {
      let uid = String(this.e?.uid || this.e?.user_id || 'unknown').replace(/[^\w-]/g, '')
      if (!uid) return false

      let game = this.e?.isSr ? 'sr' : 'gs'
      let dir = path.join(this._path, 'plugins/genshin/data/roleExplore', game)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

      let saveData = {
        uid,
        game,
        updateTime: moment().format('YYYY-MM-DD HH:mm:ss'),
        data: lodash.zipObject(keys, dataList)
      }

      let file = path.join(dir, `${uid}.json`)
      fs.writeFileSync(file, JSON.stringify(saveData, '', '\t'))
      logger.mark(`[探索查询][数据保存] uid:${uid} -> ${file}`)
      return true
    } catch (err) {
      logger.error(`[探索查询][数据保存] 保存失败：${err}`)
      return false
    }
  }

  roleExploreSrData(res) {
    let [resIndex, chestInfo, basicInfo] = res
    const stats = resIndex?.stats || {}
    const role = basicInfo?.role || basicInfo || resIndex?.role || {}
    const worldSort = item => String(item.world_id) === '999' ? 250 : Number(item.world_id) || 0
    const worlds = lodash.orderBy(chestInfo?.world_list || [], worldSort, ['desc'])
    const regionMap = {
      prod_gf_cn: '星穹列车',
      prod_qd_cn: '星穹列车B服',
      prod_official_usa: '美服',
      prod_official_euro: '欧服',
      prod_official_asia: '亚服',
      prod_official_cht: '港澳台服'
    }
    const uidPrefix = String(this.e.uid || '').slice(0, -8)
    const uidRegionMap = {
      5: '星穹列车B服',
      6: '美服',
      7: '欧服',
      8: '亚服',
      18: '亚服',
      9: '港澳台服'
    }
    const region = role.region_name || regionMap[role.region] || role.region || uidRegionMap[uidPrefix] || '星穹列车'

    const toNum = val => Number(val || 0)
    const total = worlds.reduce((ret, world) => {
      ret.cur += toNum(world.world_cur)
      ret.max += toNum(world.world_max)
      return ret
    }, { cur: 0, max: 0 })
    const percent = total.max > 0 ? lodash.round(total.cur * 100 / total.max, 1) : 0

    const data = {
      nickname: role.nickname || this.e.sender?.card?.replace(this.e.uid, '').trim() || '开拓者',
      level: role.level || role.role_level || null,
      region,
      game_head_icon: role.game_head_icon || role.avatar_url || role.avatar?.icon || resIndex?.cur_head_icon_url || `${this.screenData.pluResPath}img/role/派遣头像.png`,
      bg_img: `${this.screenData.pluResPath}img/note/bg.png`,
      head: [
        { lable: '已获宝箱', num: total.cur, extra: total.max },
        { lable: '探索进度', num: `${percent}%` },
        { lable: '区域数量', num: worlds.length }
      ]
    }

    const line = [
      [
        { lable: '活跃天数', num: stats.active_days || stats.active_day_number || 0 },
        { lable: '成就', num: stats.achievement_num || stats.achievement_number || 0 },
        { lable: '角色数', num: stats.avatar_num || stats.avatar_number || 0 },
        { lable: '忘却之庭', num: stats.abyss_process || stats.challenge_data?.max_floor || '-' }
      ],
      [
        { lable: '宝箱总数', num: total.cur, extra: total.max },
        { lable: '已完成世界', num: worlds.filter(world => toNum(world.world_max) > 0 && toNum(world.world_cur) >= toNum(world.world_max)).length },
        { lable: '地图区域', num: worlds.reduce((sum, world) => sum + (world.map_entrances?.length || 0), 0) },
        { lable: '未获取', num: Math.max(total.max - total.cur, 0) }
      ]
    ]

    const explor = worlds.map(world => {
      const cur = toNum(world.world_cur)
      const max = toNum(world.world_max)
      const worldPercent = max > 0 ? lodash.round(cur * 100 / max, 1) : 0
      return {
        id: world.world_id,
        name: world.name,
        icon: world.icon,
        bgIcon: world.bg_icon || world.icon,
        cur,
        max,
        percent: worldPercent,
        strategy: world.strategy,
        maps: (world.map_entrances || []).map(item => {
          const mapCur = toNum(item.cur_chest)
          const mapMax = toNum(item.max_chest)
          return {
            id: item.id,
            name: item.name,
            cur: mapCur,
            max: mapMax,
            percent: mapMax > 0 ? lodash.round(mapCur * 100 / mapMax, 1) : 0,
            done: mapMax > 0 && mapCur >= mapMax
          }
        })
      }
    })

    return {
      saveId: this.e.uid,
      uid: this.e.uid,
      data,
      line,
      explor,
      chestTotal: total,
      ...this.screenData
    }
  }

  async bgImage() {
    let res = await fetch('https://fastcdn.mihoyo.com/mi18n/hk4e_cn/m20240919hy3a2yr11c/m20240919hy3a2yr11c-zh-cn.json')
    res = await res.json()
    res.header_bg += '?x-oss-process=image/quality,Q_75/format,webp'
    return res.header_bg
  }

  async roleExploreData(res) {
    let [resIndex, basicInfo] = res

    let data = resIndex.role
    if (!data) {
      data = {
        'nickname': this.e.sender.card.replace(this.e.uid, '').trim(),
        'region': '天空岛',
        'level': 0,
        'game_head_icon': `https://q1.qlogo.cn/g?b=qq&s=0&nk=${this.e.user_id}`
      }
    }
    data.bg_img = await this.bgImage()

    let stats = resIndex.stats
    let daysDifference = Math.floor((new Date() - new Date('2020-09-15')) / (1000 * 60 * 60 * 24)) + 1
    data.head = [
      { lable: '活跃天数', num: stats.active_day_number, extra: `${daysDifference}` },
      { lable: '深境螺旋', num: stats.spiral_abyss },
      { lable: '幻想真境剧诗', num: stats?.role_combat?.max_round_id }
    ]
    let percentage = lodash.round(
      ((stats.precious_chest_number +
        stats.luxurious_chest_number +
        stats.exquisite_chest_number +
        stats.common_chest_number +
        stats.magic_chest_number) *
        100) /
      this.all_chest,
      2
    )

    let afterPercentage = percentage < 60 ? 'D' : (percentage < 70 ? 'C' : percentage < 80 ? 'B' : percentage < 90 ? 'A' : 'S') + `[${percentage}%]`
    let line = [
      [
        { lable: '获得角色数', num: stats.avatar_number, extra: this.lable.avatar },
        { lable: '满好感角色数', num: stats.full_fetter_avatar_num },
        { lable: '达成成就数', num: stats.achievement_number, extra: this.lable.achievement },
        { lable: '幽境危战', num: stats?.hard_challenge?.difficulty }
      ],
      [
        { lable: '解锁传送点', num: stats.way_point_number, extra: this.lable.way_point },
        { lable: '解锁秘境', num: stats.domain_number, extra: this.lable.domain },
        {
          lable: '宝箱获取率',
          num: afterPercentage,
          color:
            afterPercentage.substr(0, 1) == 'D'
              ? '#12a182'
              : afterPercentage.substr(0, 1) == 'C'
                ? '#2775b6'
                : afterPercentage.substr(0, 1) == 'B'
                  ? '#806d9e'
                  : afterPercentage.substr(0, 1) == 'A'
                    ? '#c04851'
                    : afterPercentage.substr(0, 1) == 'S'
                      ? '#f86b1d'
                      : ''
        },
        {
          lable: '宝箱总数',
          num:
            stats.precious_chest_number +
            stats.luxurious_chest_number +
            stats.exquisite_chest_number +
            stats.common_chest_number +
            stats.magic_chest_number,
          extra: this.all_chest
        }
      ],
      [
        { lable: '普通宝箱', num: stats.common_chest_number, extra: this.lable.common_chest },
        { lable: '精致宝箱', num: stats.exquisite_chest_number, extra: this.lable.exquisite_chest },
        { lable: '珍贵宝箱', num: stats.precious_chest_number, extra: this.lable.precious_chest },
        { lable: '华丽宝箱', num: stats.luxurious_chest_number, extra: this.lable.luxurious_chest }
      ],
      [
        { lable: '奇馈宝箱', num: stats.magic_chest_number, extra: this.lable.magic_chest },
        { lable: '月神瞳', num: stats.moonoculus_number, extra: this.lable.moonoculus },
        { lable: '风神瞳', num: stats.anemoculus_number, extra: this.lable.anemoculus },
        { lable: '岩神瞳', num: stats.geoculus_number, extra: this.lable.geoculus }
      ],
      [
        { lable: '雷神瞳', num: stats.electroculus_number, extra: this.lable.electroculus },
        { lable: '草神瞳', num: stats.dendroculus_number, extra: this.lable.dendroculus },
        { lable: '水神瞳', num: stats.hydroculus_number, extra: this.lable.hydroculus },
        { lable: '火神瞳', num: stats.pyroculus_number, extra: this.lable.pyroculus }
      ]
    ]
    // 尘歌壶
    if (resIndex.homes && resIndex.homes.length > 0) {
      data.homes = {
        name: resIndex.homes[0].name,
        icon: resIndex.homes[0].icon,
        comfort_name: resIndex.homes[0].comfort_level_name,
        comfort_icon: resIndex.homes[0].comfort_level_icon,
        line: []
      }
      data.homes.line.push(
        { lable: '信任等级', num: resIndex.homes[0].level },
        { lable: '最高仙力', num: resIndex.homes[0].comfort_num },
        { lable: '获得摆设', num: resIndex.homes[0].item_num },
        { lable: '历史访客', num: resIndex.homes[0].visit_num }
      )
    }

    // 探索度显示样式 0-旧版列表 1-新版世界卡片
    // 需在旧逻辑改写 name 之前构建，保留接口原始区域名
    let setConfig = gsCfg.getConfig('mys', 'set') || {}
    let exploreStyle = Number(setConfig.exploreStyle ?? 1)

    // 获取峰值探索度数据（仅新版需要）
    let maxData = {}
    if (exploreStyle === 1) {
      try {
        const maxDataPath = path.join(this._path, 'plugins/genshin/resources/json/exploreMax.json')
        if (fs.existsSync(maxDataPath)) {
          const content = fs.readFileSync(maxDataPath, 'utf-8')
          maxData = JSON.parse(content)
        }
      } catch (error) {
        console.error('[RoleIndex] 读取峰值数据失败:', error.message)
      }
    }

    let worldCards = exploreStyle === 1 ? this.worldCardData(resIndex.world_explorations, maxData) : []

    // 新版探索度的三个可选区块开关
    let exploreShowOfferings = Number(setConfig.exploreShowOfferings ?? 1)
    let exploreShowAreas = Number(setConfig.exploreShowAreas ?? 1)
    let exploreShowBosses = Number(setConfig.exploreShowBosses ?? 1)

    resIndex.world_explorations = lodash.orderBy(resIndex.world_explorations, ['id'], ['desc'])

    let explor = []
    for (let val of resIndex.world_explorations) {
      if ([7, 11, 12, 13].includes(val.id)) continue

      val.name = this.areaName[val.id] ? this.areaName[val.id] : lodash.truncate(val.name, { length: 6 })

      let tmp = {
        name: val.name,
        line: [
          {
            name: val.name,
            text: `${val.exploration_percentage / 10}%`
          }
        ]
      }

      if (val.id == 10) tmp.line = []

      if (['蒙德', '璃月', '稻妻', '须弥', '枫丹', '纳塔', '挪德卡莱'].includes(val.name)) {
        tmp.line.push({ name: '声望', text: `${val.level}级` })
      }

      if ([6, 10].includes(val.id)) {
        let oidArr = [7]
        if (val.id == 10) oidArr = [13, 12, 11]
        for (let oid of oidArr) {
          let underground = lodash.find(resIndex.world_explorations, function (o) {
            return o.id == oid
          })
          if (underground) {
            tmp.line.push({
              name: this.areaName[underground.id],
              text: `${underground.exploration_percentage / 10}%`
            })
          }
        }
      }

      if (['雪山', '稻妻', '层岩巨渊', '须弥', '枫丹', '沉玉谷', '纳塔', '空之神殿'].includes(val.name)) {
        if (val.offerings[0].name.includes('流明石')) {
          val.offerings[0].name = '流明石'
        }
        if (val.offerings[0].name == '桓那兰那的梦之树') {
          val.offerings[0].name = '梦之树'
        }
        if (val.offerings[0].name.includes('露景泉')) {
          val.offerings[0].name = '露景泉'
        }
        if (val.offerings[0].name.includes('煅石之火')) {
          val.offerings[0].name = '煅石之火'
        }
        if (val.offerings[0].name.includes('空之神殿·摹忆中枢')) {
          val.offerings[0].name = '摹忆中枢'
        }

        tmp.line.push({
          name: val.offerings[0].name,
          text: `${val.offerings[0].level}级`
        })
      }

      explor.push(tmp)
    }

    return {
      saveId: this.e.uid,
      uid: this.e.uid,
      activeDay: this.dayCount(stats.active_day_number),
      data,
      line,
      explor,
      basicInfo,
      exploreStyle,
      worldCards,
      exploreShowOfferings,
      exploreShowAreas,
      exploreShowBosses,
      headIndexStyle: this.headIndexStyle,
      ...this.screenData,
      gamename: data?.nickname ?? '',
      avatar: data?.game_head_icon ?? '',
      gameavatar: data?.avatar ?? '',
      gamelevel: data?.level ?? 0,
      gamefwq: data?.region ?? ''
    }
  }
}
