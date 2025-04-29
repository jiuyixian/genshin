import plugin from "../../../lib/plugins/plugin.js"
import fs from "node:fs"
import GachaLog from "../model/gachaLog.js"
import ExportLog from "../model/exportLog.js"
import LogCount from "../model/logCount.js"
import common from "../../../lib/common/common.js"
const _path = process.cwd() + "/plugins/genshin"

export class gcLog extends plugin {
  constructor() {
    super({
      name: "抽卡记录",
      dsc: "抽卡记录数据统计",
      event: "message",
      priority: -114514,
      rule: [
        {
          reg: "(.*)authkey=(.*)",
          fnc: "logUrl"
        },
        {
          reg: "^#?(原神|星铁)?(强制)?导入记录(json)?$",
          fnc: "logJson"
        },
        {
          reg: "^#?(原神|星铁)?(全部)?(抽卡|抽奖|角色|武器|集录|常驻|up|新手|光锥|全部)池*(记录|祈愿|分析)$",
          fnc: "getLog"
        },
        {
          reg: "^#?(原神|星铁)?(强制)?导出记录(json)?$",
          fnc: "exportLog"
        },
        {
          reg: "^#?(安卓|苹果|电脑|pc|ios|记录|抽卡)帮助$",
          fnc: "help"
        },
        {
          reg: "^#?(原神|星铁)?(抽卡|抽奖|角色|武器|集录|常驻|up|新手|光锥)池*统计$",
          fnc: "logCount"
        },
        {
          // #设置全量更新抽卡记录
          reg: "^#?设置全量(更新|获取)(抽卡|祈愿)记录\s*(开|关|on|off)?$",
          fnc: "setFetchFullLog"
        },
      ]
    })

    this.androidUrl = "https://b.storyo.cn/archives/gslink"
    Object.defineProperty(this, "button", {
      get() {
        this.prefix = this.e?.isSr ? "*" : "#"
        return segment.button([
          { text: "角色记录", callback: `${this.prefix}角色记录` },
          { text: "角色统计", callback: `${this.prefix}角色统计` },
        ], [
          { text: "武器记录", callback: `${this.prefix}武器记录` },
          { text: "武器统计", callback: `${this.prefix}武器统计` },
        ], [
          { text: "集录记录", callback: `${this.prefix}集录记录` },
          { text: "集录统计", callback: `${this.prefix}集录统计` },
        ], [
          { text: "常驻记录", callback: `${this.prefix}常驻记录` },
          { text: "常驻统计", callback: `${this.prefix}常驻统计` },
        ])
      }
    })
  }

  async init() {
    let file = ["./data/gachaJson", "./data/srJson", "./temp/html/StarRail", "./temp/uigf"]
    for (let i of file) {
      if (!fs.existsSync(i)) {
        fs.mkdirSync(i)
      }
    }
  }

  accept() {
    if (this.e.msg && /^#?(角色|武器)统计$/g.test(this.e.msg)) {
      this.e.msg = this.e.msg.replace("统计", "池统计")
      return true
    }
  }

  /** 抽卡记录链接 */
  async logUrl() {
    let data = await new GachaLog(this.e).logUrl()
    if (!data) return

    await this.renderImg("genshin", `html/gacha/gacha-log`, data)

    if (this.e.isGroup)
      this.e.reply("已收到链接，请撤回", false, { at: true })
  }

  /** #抽卡记录 */
  async getLog() {
    this.e.isAll = !!(this.e.msg.includes("全部"))
    let data = await new GachaLog(this.e).getLogData()
    if (!data) return
    let name = `html/gacha/gacha-log`
    if (this.e.isAll) {
      name = `html/gacha/gacha-all-log`
    }
    this.reply([await this.renderImg("genshin", name, data, { retType: "base64" }), this.button])
  }

  /** 导出记录 */
  exportLog() {
    if (this.e.isGroup && !this.e.msg.includes("强制")) {
      return this.reply("建议私聊导出，若你确认要在此导出，请发送【#强制导出记录】", false, { at: true })
    }

    return new ExportLog(this.e).exportJson()
  }

  logJson() {
    if (this.e.isGroup && !this.e.msg.includes("强制")) {
      return this.reply("建议私聊导入，若你确认要在此导入，请发送【#强制导入记录】", false, { at: true })
    }

    this.setContext("logJsonFile")
    return this.reply("请发送Json文件")
  }

  async logJsonFile() {
    if (!this.e.file) return false

    this.finish("logJsonFile")
    await new ExportLog(this.e).logJson()

    if (this.e.isGroup)
      this.reply("已收到文件，请撤回", false, { at: true })
  }

  async help(e) {
    let textMessage1 =
        `最下面有详细方法
【原神】
发送【#扫码登录】，米游社扫码，然后 发送 【#更新抽卡记录】，【#更新小助手抽卡记录】 等待即可

【崩坏：星穹铁道】【下方 提供方法指路，是否使用自己判断】
星铁抽卡记录：不能直接更新记录，需要自己提取

【绝区零】
发送【#扫码登录】，米游社扫码，然后 发送 【%更新抽卡记录】  等待即可

手机软件：
https://www.wyylkjs.top/HoYoGet/
手机端云星铁快捷获取方法:
https://b.storyo.cn/archives/srlink#cloud-android
通用获取方法:
https://feixiaoqiu.com/n/#/xt/gacha_link
电脑获取:
https://github.com/biuuu/star-rail-warp-export
https://github.com/Scighost/Starward
`;
    let textMessage2 = `    
【记录帮助-安卓】
同上      
    
【记录帮助-苹果】
- 苹果手机需要用捉包获取 历史记录页面链接 
- 应用商店搜索抓包工具 Stream ，下载安装
- 打开 Stream ，允许 添加VPN配置 ，安装 CA证书 
- 点左上角 开始捉包 按钮
- 打开游戏-祈愿- 历史记录页面 ，或者点右上角刷新这个页面
- 回到 Stream ,点左上角 停止抓包 按钮停止
- 点右边 抓包历史 按钮，选择最上面一条
- 选择 按域名 ，选择域名为  hk4e-api.mihoyo.com  那一条
- 点最上面一条，选择 请求 ，点击 请求信息 
-  复制请求连接 ，最后 私聊 发送给机器人
    
【记录帮助-电脑】

【快捷】原神    PC端获取方法1：
    1.打开原神祈愿页面→ 历史记录 保持不动
    2.然后按 win + r 键
    3.输入：

powershell iex(irm 'https://gitee.com/storyc/halo-file/raw/master/gsLink-amwz.ps1')

    4.抽卡分析的链接就在剪贴板了，粘贴即可

原神    PC端获取方法2：
    1.在原神PC端按下ESC-->祈愿-->历史记录，成功进入到如下页面（建议多翻几页）
    2.在桌面按下“Win+R”打开运行，输入\n“   powershell  ”  点击确定
    3.在弹出的程序框中再输入代码： 
    
    iex(irm 'https://img.lelaer.com/cn.ps1')   
    
    国际服的代码为
    
     iex(irm  'https://img.lelaer.com/oc.ps1')   

    4.点击确定后，抽卡分析的链接就会自动复制到剪贴板了，按Ctrl+V即可粘贴

【快捷】崩坏：星穹铁道   PC端获取方法1：
    1.打开星穹铁道祈愿页面 ->历史记录，多翻几页
    2.然后按 win + r 键
    3.输入：

    powershell iex(irm 'https://gitee.com/storyc/halo-file/raw/master/srLink-rfqw.ps1')
（没试过国际服）
    4.抽卡分析的链接就在剪贴板了，粘贴即可

崩坏：星穹铁道   PC端获取方法2：
    1.打开星穹铁道祈愿页面 ->历史记录，多翻几页
    2.回到桌面，按win+r键 输入：  powershell
    3.在弹出的命令窗口输入以下命令：

    国服  Invoke-Expression (New-Object Net.WebClient).DownloadString( 'https://xingqiong-oss.oss-cn-hangzhou.aliyuncs.com/pc/down/s_gf.ps1')

    国际服   Invoke-Expression (New-Object Net.WebClient).DownloadString( 'https://xingqiong-oss.oss-cn-hangzhou.aliyuncs.com/pc/down/s_gj.ps1')

    4.复制抽卡分析链接即可

【快捷】绝区零   PC端获取方法1：
    1.打开绝区零调频页面→详情→ 调频记录 保持不动
    2.然后按 win + r 键
    3.输入：

powershell iex(irm 'https://gitee.com/storyc/halo-file/raw/master/zzzLink-bxgb.ps1')

    4.抽卡分析的链接就在剪贴板了，粘贴即可
    `;
    let msg = [];
    msg.push(segment.text(textMessage1));
    msg.push(segment.text(textMessage2));
    if (msg) await this.reply(common.makeForwardMsg(e, msg, `抽卡帮助`));// 文本消息合并
    return true;
}

  async logCount() {
    let data = await new LogCount(this.e).count()
    if (!data) return

    this.reply([await this.renderImg("genshin", `html/gacha/log-count`, data, { retType: "base64" }), this.button])
  }

  async setFetchFullLog() {
    let isOff = this.e.msg.includes("关") || this.e.msg.includes("off")
    await new GachaLog(this.e).setFetchFullLog(!isOff)
  }

}
