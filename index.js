const { KiviPlugin,segment } = require('@kivibot/core')

const fs = require('fs')
const { version } = require('./package.json')
const plugin = new KiviPlugin('群消息反撤回', version)

const config = { enableGroupList: [], sendToGroup: true, sendToMainAdmin: true}

plugin.onMounted(async (bot) => {

  plugin.saveConfig(Object.assign(config, plugin.loadConfig()))
  /**
   * 保存符合条件的每一条群聊的消息
   */
  let data = new Array();
  plugin.onGroupMessage((event) => {
    /**
     * mid 该消息的 message_id
     * message 撤回的消息
     */
    mid = event.message_id;
    message = event.message;
    data.push({"message_id": mid, "message": message})
  })
  //** 每隔两分钟清理已经不能撤回的消息 */
  plugin.cron("0 */2 * * * *", () => data.shift())

  //** 群聊消息反撤回 */
  plugin.on("notice.group.recall", async event => {
    // 判断是不是 enableGroupList 里的群聊且撤回消息的不能是本机器人
    let recall_msg;
    // 先遍历数组 data
    for(let i = 0; i < data.length;i++){
      if(data[i]['message_id'] === mid){
        recall_msg = data[i]['message'];
        break;
      }
    }

    // 捕捉错误
    if(recall_msg == undefined || event.user_id == bot.uin) {
      plugin.throwPluginError("没有找到此撤回消息或是机器人撤回的消息，忽略")
      return;
    };

    // 是否将撤回消息发送至群聊
    if (config.sendToGroup) {
      const message = [
        segment.at(event.user_id),
        `撤回了:\n`,
      ]
      message.push.apply(message, recall_msg);
      await bot.sendGroupMsg(event.group_id, message);
    }
    
    // 撤回的消息是否发给 mainAdmin
    if(config.sendToMainAdmin && event.user_id != bot.uin)
    {
      msg = `--群消息反撤回--\n群聊: ${event.group_id}\n用户: ${event.user_id}`
      await bot.sendPrivateMsg(plugin.mainAdmin, msg)
      setTimeout(()=>{bot.sendPrivateMsg(plugin.mainAdmin, recall_msg)}, 1000)
    }

  })
})

module.exports = { plugin }