import plugin from '../../../lib/plugins/plugin.js'
import Calendar from '../model/calendar.js'
import gsCfg from '../model/gsCfg.js'

gsCfg.cpCfg('mys', 'set')

export class calendar extends plugin {
  constructor() {
    super({
      name: '个人日历',
      dsc: '查看原神/星铁/绝区零活动日历，包括当前卡池和活动一览',
      event: 'message',
      priority: -114514,
      rule: [
        {
          reg: '^#?(原神|星铁|星穹铁道|绝区零|ZZZ|zzz)?(日历|活动日历|任务日历|个人日历)$',
          fnc: 'calendar',
        },
      ],
    })
    this.set = gsCfg.getConfig('mys', 'set')
  }

  async calendar() {
    let result = await Calendar.get(this.e)
    if (!result) return

    let { game, ...data } = result
    data.game = game

    // 游戏名
    const names = { gs: '原神', sr: '星穹铁道', zzz: '绝区零' }
    data.gameName = names[game] || '原神'

    // 按游戏路由模板
    const tpl = 'html/calendar/calendar-' + game

    this.reply([await this.renderImg('genshin', tpl, data, { retType: "base64", scale: 2 })])
  }
}
