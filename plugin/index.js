const { KiviPlugin } = require('@kivibot/core')

const fs = require('fs')
const { version } = require('../package.json')
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
    // 超过50条消息就保存到 message.json ，防止内存溢出
    if(data.length > 50){
      if(fs.existsSync(`${plugin.dataDir}/message.json`)){
        // 将 message.json 内的数组提出来，并解析 json 
        let tempArr = JSON.parse(fs.readFileSync(`${plugin.dataDir}/message.json`, 'utf-8'));
        // 拼接数组，将内容写入文件
        tempArr.concat(data);
        fs.writeFileSync(`${plugin.dataDir}/message.json`, JSON.stringify(tempArr));
        // 清空 data 数组
        data.splice(0, data.length)
      } else {
        fs.writeFileSync(`${plugin.dataDir}/message.json`, JSON.stringify(data));
        data.splice(0, data.length);
      }
    }
  })

  //** 群聊消息反撤回 */
  plugin.on("notice.group.recall", async event => {
    // 判断是不是 enableGroupList 里的群聊且撤回消息的不能是本机器人
    let recall_msg;
    // 先遍历数组 data ，没有的话再遍历 message.json
    let key = false;
    for(let i = 0; i < data.length;i++){
      if(data[i]['message_id'] === mid){
        recall_msg = data[i]['message'];
        key = true;
        break;
      }
    }
    if(!key){
      let fileData = JSON.parse(fs.readFileSync(`${plugin.dataDir}/message.json`, 'utf-8'))
      for(let i = 0; i < fileData.length;i++){
        if(fileData[i]['message_id'] === mid){
          recall_msg = fileData[i]['message'];
          key = true
          break;
        }
      }
    }

    // 捕捉错误
    if(!key) {
      plugin.throwPluginError("没有找到此撤回消息，忽略")
      return;
    };

    // 是否将撤回消息发送至群聊
    if(config.sendToGroup){
      await bot.sendGroupMsg(event.group_id, recall_msg);
    }

    // 撤回的消息是否发给 mainAdmin
    if(config.sendToMainAdmin && event.user_id != bot.uin)
    {
      msg = `群聊: ${event.group_id}\n用户: ${event.user_id}`
      await bot.sendPrivateMsg(plugin.mainAdmin, msg)
      setTimeout(()=>{bot.sendPrivateMsg(plugin.mainAdmin, recall_msg)}, 1000)
    }

  })
})

module.exports = { plugin }