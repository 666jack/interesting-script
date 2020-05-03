let localStorage = storages.create('jackxu');
const WIDTH = Math.min(device.width, device.height);
const HEIGHT = Math.max(device.width, device.height);

// ------------------------------ 测试打赏功能 ------------------------------
// cfff5e
// 未成熟 7bc576
//循环找色，找到红色(#ff0000)时停止并报告坐标
// x: 164 y:586
requestScreenCapture();
  var img = captureScreen();
var point = findColor(img, "#7bc576", {
  region: [164, 586, 729, 228],
  threshold: 40
});
if(point){
 toastLog("找到啦:" + point);
}else{
 toast("没找到");
}
// while(true){
//   var img = captureScreen();
//   var point = findColor(img, "#cfff5e");
//   if(point){
//       toastLog("找到红色，坐标为(" + point.x + ", " + point.y + ")");
//       click(point.x, point.y)
//   }
// }
sleep(300)
// toastLog(id('com.alipay.mobile.nebula:id/h5_tv_title').findOnce().text())
// toastLog(clickByTextDesc('浇水', 0))

// ------------------------------ 注释分割线 ------------------------------

// while(1){
//   swipe(520, 1900, 520, 400, 500);
//   sleep(18 * 1000)
// }
// toastLog(
//   clickByTextDesc('同城', 0)
// )
exit();

function dailyEvent() {
  click(44, 158)
  sleep(500)
  clickByTextDesc('去赚钱', 0)
  toastLog('成功进入去赚钱')
  sleep(500)
}

function clickByTextDesc(energyType, paddingY) {
  var clicked = false;
  if (descEndsWith(energyType).exists()) {
    descEndsWith(energyType)
      .find()
      .forEach(function(pos) {
        var posb = pos.bounds();
        if (posb.centerX() < 0 || posb.centerY() - paddingY < 0) {
          return false;
        }
        //toastLog(pos.id());
        var str = pos.id();
        if (str != null) {
          if (str.search('search') == -1) {
            click(posb.centerX(), posb.centerY() - paddingY);
            //toastLog("get it 1");
            clicked = true;
          }
        } else {
          click(posb.centerX(), posb.centerY() - paddingY);
          //toastLog("get it 2");
          clicked = true;
        }
        sleep(100);
      });
  }

  if (textEndsWith(energyType).exists() && clicked == false) {
    textEndsWith(energyType)
      .find()
      .forEach(function(pos) {
        var posb = pos.bounds();
        if (posb.centerX() < 0 || posb.centerY() - paddingY < 0) {
          return false;
        }
        //toastLog(pos.id());
        var str = pos.id();
        if (str != null) {
          if (str.search('search') == -1) {
            click(posb.centerX(), posb.centerY() - paddingY);
            //toastLog("get it 3");
            clicked = true;
          }
        } else {
          click(posb.centerX(), posb.centerY() - paddingY);
          //toastLog("get it 4");
          clicked = true;
        }
        sleep(100);
      });
  }

  return clicked;
}

addTimes('', fmtTimeString(new Date().getTime() + 5 * 1000));
function addTimes(path, date) {
  // 添加定時器||更新定時器
  path = path || './amineTask.js';
  toastLog(path + date);
  let timers = require('./EXT_TIMERS.js');
  let iiid = localStorage.get('ant_task');
  let timedTask = timers.getTimedTask(JSON.parse(iiid).mId);
  log('ssst', iiid, timedTask);
  if (timedTask) {
    // 更新定时任务
    timedTask.setMillis(new Date(date).getTime());
    timers.updateTimedTask(timedTask);
    log('storage', timedTask);
  } else {
    timedTask = timers.addDisposableTask({
      path: files.path(path),
      date: new Date(date).getTime()
    }); // 添加定時任務
  }

  // 保存定时任务到本地
  localStorage.put('ant_task', JSON.stringify(timedTask));
}
/**
 * @desc    格式化成本地时间
 * @param   {时间戳}}    code
 *
 * @return  String 本地时间
 * @throws  {TypeError}
 */
function fmtTimeString(code) {
  let dateString = new Date();
  dateString.setTime(code);
  timeString =
    dateString.toDateString() +
    ' ' +
    dateString.getHours() +
    ':' +
    dateString.getMinutes() +
    ':' +
    dateString.getSeconds();
  return timeString;
}
