/**
 * 使用说明请看 https://github.com/e1399579/autojs/blob/master/README.md
 * @author jackxu <huangbuyanhuang@gmail.com>
 */
auto(); // 自动打开无障碍服务
var config = files.isFile('set.js') ? require('set.js') : {};
if (typeof config !== 'object') {
  config = {};
}
var options = Object.assign(
  {
    password: '',
    pattern_size: 3
  },
  config
); // 用户配置合并

// 所有操作都是竖屏
const WIDTH = Math.min(device.width, device.height);
const HEIGHT = Math.max(device.width, device.height);
const IS_ROOT =
  files.exists('/sbin/su') ||
  files.exists('/system/xbin/su') ||
  files.exists('/system/bin/su');

setScreenMetrics(WIDTH, HEIGHT);
let localStorage = storages.create('jackxu');
let toastList = { energyArr: [], mineEnergy: [] };
let isRescorll = 0;
start(options);

/**
 * 开始运行
 * @param options
 */
function start(options) {
  // 连续运行处理
  while (!device.isScreenOn()) {
    device.wakeUp();
    sleep(600);
    log('wakeUp');
  }

  var Robot = require('Robot.js');
  var robot = new Robot(options.max_retry_times);
  var antForest = new AntForest(robot, options);
  antForest.saveState();

  if (files.exists('Secure.js')) {
    var Secure = require('Secure.js');
    var secure = new Secure(robot, options.max_retry_times);
    let isLock = false;

    function callback() {
      let iDate = new Date();
      let next_to = iDate.getTime() + 30 * 1000;
      addTimes('', fmtTimeString(next_to));
      toastLog('1分钟后重试');
      exit();
    }

    isLock = secure.openLock(options.password, options.pattern_size, callback);
    log('isLock', isLock);

    // 拉起到前台界面
    antForest.openApp();
  }

  var taskManager = new TaskManager();
  taskManager.init();
  taskManager.listen();
  taskManager.waitFor();

  checkModule();

  // 先打开APP，节省等待时间
  threads.start(function() {
    sleep(500);
    antForest.openApp();
  });

  antForest.launch();
  antForest.work();
  antForest.resumeState();

  // 退出
  exit();
  throw new Error('强制退出');
}

/**
 * 检查必要模块
 */
function checkModule() {
  if (!files.exists('Robot.js')) {
    throw new Error('缺少Robot.js文件，请核对第一条');
  }

  if (
    !files.exists('Secure.js') &&
    context
      .getSystemService(context.KEYGUARD_SERVICE)
      .inKeyguardRestrictedInputMode()
  ) {
    throw new Error('缺少Secure.js文件，请核对第一条');
  }

  threads.start(function() {
    var remember;
    var beginBtn;
    if (
      (remember = id('com.android.systemui:id/remember')
        .checkable(true)
        .findOne(options.timeout))
    ) {
      remember.click();
    }
    if (
      (beginBtn = classNameContains('Button')
        .textContains('立即开始')
        .findOne(options.timeout))
    ) {
      beginBtn.click();
    }
  });
  if (!requestScreenCapture(false)) {
    toastLog('请求截图失败');
    exit();
  }
}

function TaskManager() {
  this.task_no = 0;
  this.time_tag = 'start_time';
  this.wait_time = 15000;

  this.init = function() {
    // engines.myEngine().setTag(this.time_tag, (new Date()).getTime());

    var task_list = this.getTaskList();
    this.task_no = this.findIndex(engines.myEngine(), task_list);
    log(Object.keys(task_list), this.task_no);
  };

  this.getTaskList = function() {
    return engines.all().sort(
      function(e1, e2) {
        return e1.id - e2.id;
      }.bind(this)
    );
  };

  this.findIndex = function(engine, list) {
    var engine_id = engine.id;
    var id_list = list.map(function(o) {
      return o.id;
    });
    return id_list.indexOf(engine_id);
  };

  this.listen = function() {
    // 子线程
    threads.start(function() {
      // 监听音量上键
      events.observeKey();
      events.onceKeyDown('volume_up', function(event) {
        engines.stopAll();
        exit();
      });
    });
  };

  this.waitFor = function() {
    while (1) {
      device.wakeUpIfNeeded();

      var task_no = this.findIndex(engines.myEngine(), this.getTaskList());
      if (task_no > 0) {
        log('任务' + this.task_no + '排队中，前面有' + task_no + '个任务');
        sleep(this.wait_time);
      } else {
        log('任务' + this.task_no + '开始运行');
        break;
      }
    }
  };
}

/**
 * 蚂蚁森林的各个操作
 * @param robot
 * @param options
 * @constructor
 */
function AntForest(robot, options) {
  this.robot = robot;
  options = options || {};
  var settings = {
    timeout: 2800, // 超时时间：毫秒
    max_retry_times: 10, // 最大失败重试次数
    takeImg: 'take.png', // 收取好友能量用到的图片
    max_swipe_times: 100, // 好友列表最多滑动次数
    min_time: '7:12:00', // 检测时段
    max_time: '7:12:50',
    check_within_time: 2,
    help_img: ''
  };
  this.options = Object.assign(settings, options);
  this.package = 'com.eg.android.AlipayGphone'; // 支付宝包名
  this.state = {};
  this.capture = null;
  this.bounds = [0, 0, WIDTH, 1100];
  this.icon_num = 1;
  this.start_time = new Date().getTime();
  this.detected = 0;

  toastLog('即将收取能量，按音量上键停止');

  this.saveState = function() {
    this.state.isScreenOn = device.isScreenOn();
    this.state.currentPackage = currentPackage(); // 当前运行的程序
    this.state.isRunning = IS_ROOT
      ? parseInt(shell("ps | grep 'AlipayGphone' | wc -l", true).result)
      : 0; // 支付宝是否运行
    this.state.version = context
      .getPackageManager()
      .getPackageInfo(this.package, 0).versionName;
  };

  this.resumeState = function() {
    if (this.state.currentPackage !== this.package) {
      log('回到之前运行的程序');
      sleep(500)
      this.back(); // 回到之前运行的程序
      // sleep(500);
    }

    if (!this.state.isRunning) {
      // log('closeApp');
      // this.back(); // 回到之前运行的程序
      // this.closeApp();
    }

    if (this.state.isScreenOn) {
      // log('KEYCODE_POWER');
      // KeyCode("KEYCODE_POWER");
    }
  };

  this.openApp = function() {
    this.launch(this.package);
  };

  this.closeApp = function() {
    this.robot.kill(this.package);
  };

  this.launch = function() {
    var times = 0;
    do {
      if (this.doLaunch()) {
        return;
      } else {
        times++;
        this.back();
        sleep(1500);
        this.openApp();
      }
    } while (times < this.options.max_retry_times);

    throw new Error('运行失败');
  };

  this.doLaunch = function() {
    // 可能出现的红包弹框，点击取消
    var timeout = this.options.timeout;
    threads.start(function() {
      var cancelBtn;
      if (
        (cancelBtn = id(
          'com.alipay.mobile.accountauthbiz:id/update_cancel_tv'
        ).findOne(timeout))
      ) {
        cancelBtn.click();
      }
      if (
        (cancelBtn = id(
          'com.alipay.android.phone.wallet.sharetoken:id/btn1'
        ).findOne(timeout))
      ) {
        cancelBtn.click();
      }
    });

    log('打开蚂蚁森林');
    app.startActivity({
      action: 'VIEW',
      data: 'alipays://platformapi/startapp?appId=60000002'
    });

    // 等待加载
    if (this.waitForLoading('种树')) {
      log('进入蚂蚁森林成功');
    } else {
      toastLog('进入蚂蚁森林失败');

      launchApp('Auto.js');
      return false;
    }

    return true;
  };

  this.waitForLoading = function(keyword) {
    var timeout = this.options.timeout;
    var waitTime = 200;
    sleep(800);
    timeout -= 2000;
    for (var i = 0; i < timeout; i += waitTime) {
      if (descEndsWith(keyword).exists() || textEndsWith(keyword).exists()) {
        sleep(500);
        return true;
      }

      sleep(waitTime); // 加载中
    }

    return false;
  };

  this.getPower = function() {
    var energy = textEndsWith('g')
      .findOne()
      .text()
      .match(/\d+/)[0];
    return energy ? parseInt(energy) : null;
  };

  this.work = function() {
    events.observeToast();
    events.onToast(function(n) {
      log('Toast内容: ' + n.getText() + ' 包名: ' + n.getPackageName());
      if (n.getPackageName() == 'com.eg.android.AlipayGphone') {
        let desc = n.getText();
        if (desc.match(/后才能收取$/)) {
          let timed = desc.split('后')[0];
          toastList.energyArr.push(timed);
          let seconds = +timed.split(':')[0] * 60 + +timed.split(':')[1]
          if (seconds < 10 && isRescorll === 0) {
            isRescorll++;
          }
        }
        log(n.getText(), desc.match(/后才能收取$/));
      }
    });
    events.on('exit', function() {
      toast('监听已结束');
    });
    sleep(500);
    this.robot.click(WIDTH / 2, 510);

    var timeout = this.options.timeout;
    var startPower = this.getPower();
    log('当前能量：' + startPower);

    // 开始收取
    this.takeIt('mine');
    sleep(1000)
    if(id('com.alipay.mobile.nebula:id/h5_tv_title').findOnce().text() == '蚂蚁森林'){

    }else{
      this.back()
    }
    this.takeRemain(
      this.getRemainList(),
      this.options.min_time,
      this.options.max_time
    );
    sleep(500);
    var power = this.getPower() - startPower;
    if (power >= 0) toastLog('收取了' + power + 'g自己的能量');
    toastList.energyArr.map(ele => {
      let el = ele.split(':');
      let needTime = el[0] * 60 + +el[1];
      log('needTime', needTime);
      if (needTime <= 60) {
        toastList.mineEnergy.push(needTime);
      }
    });
    log('toastList.mineEnergy', toastList.mineEnergy);

    var icon_list = [];
    var icon = images.read(this.options.takeImg);
    if (null === icon) {
      throw new Error('缺少图片文件，请仔细查看使用方法的第一条！！！');
    }
    icon_list = [icon];
    var icon2;
    if (this.options.help_img && (icon2 = images.read(this.options.help_img))) {
      icon_list[1] = icon2;
    }
    this.icon_num = icon_list.length;

    // 跳过当前屏幕
    var y = Math.min(HEIGHT, 1720);
    this.robot.swipe(WIDTH / 2, y, WIDTH / 2, 0);
    sleep(1000);
    log('开始收取好友能量');

    var bottom = 0;
    var total_list = this.takeOthers(icon_list, 500, function() {
      var ele = descEndsWith('种树').exists()
        ? descEndsWith('种树')
        : textEndsWith('种树');
      var rect = ele.findOne().bounds();
      if (rect.bottom === bottom) {
        return true;
      }

      bottom = rect.bottom;
      return false;
    });
    log('total_list', total_list);
    // 统计下次时间
    var minuteList = [];
    var keyword = '查看更多好友';
    var vip = descEndsWith(keyword).exists()
      ? descEndsWith(keyword)
      : textEndsWith(keyword);
      
    if (vip.exists()) {
        log('查看更多好友');
        sleep(1000);
      if (this.robot.clickCenter(vip.findOne(timeout))) {
        // 等待更多列表刷新
        log('进入好友排行榜成功');
        // 跳过第一屏
        var y = Math.min(HEIGHT, 1720);
        this.robot.swipe(WIDTH / 2, y, WIDTH / 2, 0);
        sleep(500);

        var page,
          min_minute,
          add_total_list,
          swipe_sleep = 500;
        for (;;) {
          log('往下翻页');
          page = 0;
          add_total_list = this.takeOthers(
            icon_list,
            swipe_sleep,
            function() {
              /*var selector = desc("没有更多了");
                        if (!selector.exists()) return false;

                        return selector.findOne().visibleToUser();*/
              page++;
              return (
                page > this.options.max_swipe_times ||
                findColorEquals(
                  this.capture,
                  '#30BF6C',
                  WIDTH - 300,
                  0,
                  200,
                  HEIGHT
                ) !== null
              );
            }.bind(this)
          );
          this.addTotal(total_list, add_total_list);

          minuteList = this.statisticsNextTime();
          this.filterMinuteList(minuteList);

          if (!this.executeNextTask()) {
            log('检测自己的能量尚未开始，不执行反复检测');
            break;
          } else {
            log('进行反复检测好友能量'+page);
          }

          if (!minuteList.length) {
            break;
          }
          min_minute = minuteList[0];
          log('当前最小剩余' + min_minute + '分钟');
          if (min_minute > this.options.check_within_time) {
            break;
          }
          swipe_sleep = 300;

          log('往上翻页');
          page = 0;
          add_total_list = this.takeOthers(
            icon_list,
            swipe_sleep,
            function() {
              page++;
              return (
                page > this.options.max_swipe_times ||
                findColorEquals(
                  this.capture,
                  '#EFAE44',
                  0,
                  0,
                  110,
                  HEIGHT / 2
                ) !== null
              );
            }.bind(this),
            'prev'
          );
          this.addTotal(total_list, add_total_list);
        }

        this.back();
        sleep(500);
        // this.waitForLoading('TA收取你');
      } else {
        toastLog('进入好友排行榜失败');
      }
    } else {
      minuteList = this.statisticsNextTime();
      this.filterMinuteList(minuteList);
    }

    swipe(520, 300, 520, 1800, 50);
    sleep(40);
    swipe(520, 300, 520, 1800, 50);
    sleep(40);
    swipe(520, 300, 520, 1800, 50);
    sleep(1600);

    var endPower = this.getPower();

    var added = endPower - startPower;
    added = Math.max(0, added);

    var message = '收取完毕，共' + total_list[0] + '个好友，' + added + 'g能量';
    if (this.icon_num > 1) {
      message += '，帮了' + total_list[1] + '个好友收取';
    }
    toastLog(message);
    sleep(500);
    // 统计部分，可以删除
    minuteList = minuteList.concat(toastList.mineEnergy);
    this.filterMinuteList(minuteList);
    log('minuteList', minuteList);

    var timeList = this.getTimeList(minuteList);
    let date = new Date();
    var today = date.toDateString();
    var tohours = date.getHours();
    var tomin = date.getMinutes();
    var next_hours;
    var next_time;
    var next_min = 0;
    var next_sec = 0;
    if (timeList.length) {
      toastLog('可收取时间：' + timeList.join(', '));

      // 添加tasker任务
      if (this.executeNextTask() || true) {
        next_time = today + ' ' + timeList[0];
        next_hours = timeList[0].split(':')[0];
        next_min = timeList[0].split(':')[1];
        next_sec = timeList[0].split(':')[2];
      } else {
        toastLog('检测自己的能量尚未开始，不发送Tasker任务');
      }
    } else {
      // 没有未收取的记录，延时一个小时再运行 || 超过一小时则以一个钟为准
      let date2 = date;
      let onHours = date2.getTime() + 60 * 60 * 1000;
      next_time = fmtTimeString(onHours);
      next_hours = new Date(next_time).getHours();
    }

    // 情况之一: 零点判断 1,超过零点&未到:则以零点为准->零点; 2,超过零点&有任务->任务; 3,超过零点&没有任务->6:30
    if (tohours < 6 && timeList.length) {
    } else if (tohours > 10 && tohours < 24 && next_hours < 6) {
      // 获取次日零点
      let date3 =
        new Date(today + ' ' + '0:0:0').getTime() + 24 * 60 * 60 * 1000;
      next_time = fmtTimeString(date3);
    } else if (tohours < 6) {
      next_time = today + ' ' + '6:30:00';
    } else if (
      tomin <= 12 &&
      next_hours == 7 &&
      next_min >= 12 &&
      next_sec > 10
    ) {
      next_time = today + ' ' + '7:12:10';
    }
    // this.notifyTasker(next_time);
    if (isRescorll <= 1 && isRescorll !== 0) {
      isRescorll++;
      this.work();
    } else {
      toastLog('下次运行时间：' + next_time);
      next_time && addTimes('./amineTask.js', next_time);
      this.back();
    }
  };

  this.addTotal = function(total_list, add_total_list) {
    for (var i = 0; i < this.icon_num; i++) {
      total_list[i] += add_total_list[i];
    }
  };

  this.statisticsNextTime = function() {
    // 匹配成熟时间
    var minuteList = [];
    var member = descEndsWith('’').exists()
      ? descEndsWith('’')
      : textEndsWith('’');

    member.find().forEach(function(o) {
      minuteList.push(parseInt(o.text()));
    });
    return minuteList;
  };

  this.filterMinuteList = function(minuteList) {
    // 排序
    minuteList.sort(function(m1, m2) {
      return m1 - m2;
    });
    // 去掉重复的
    for (var i = 1, len = minuteList.length; i < len; i++) {
      // 相差1分钟以内认为是同一时间
      if (minuteList[i] - minuteList[i - 1] <= 1) {
        minuteList.splice(i--, 1);
        len--;
      }
    }
  };

  this.getTimeList = function(minuteList) {
    var date = new Date();
    var timeList = [];
    var timestamp = date.getTime() - 40000;
    for (var i = 0, len = minuteList.length; i < len; i++) {
      var minute = minuteList[i];
      var now = timestamp + minute * 60 * 1000;
      date.setTime(now);
      timeList.push(
        date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds()
      );
    }
    return timeList;
  };

  this.executeNextTask = function() {
    if (this.detected) return true;
    var date = new Date();
    var today = date.toDateString();
    var max_time = today + ' ' + this.options.max_time;
    var max_timestamp = Date.parse(max_time);
    var time0700 = Date.parse(today + ' ' + '07:01:30')
    var time0658 = Date.parse(today + ' ' + '06:57:00')
    // start_time: 当前时间, max_timestamp: 个人能量结束, + 6:58~7:01 之间进行能量检测
    return (this.start_time > max_timestamp) || ((time0700 > this.start_time) && (this.start_time > time0658));
  };

  this.notifyTasker = function(time) {
    app.sendBroadcast({
      action: 'net.dinglisch.android.tasker.ActionCodes.RUN_SCRIPT',
      extras: {
        name: '蚂蚁森林',
        time: time
      }
    });
    toastLog('已发送Tasker任务：' + time);
  };

  /**
   * 收取能量 takeIt
   */
  this.takeIt = function(mine) {
    this.takeColor('#cfff5e') // 只点击已成熟
    if(mine){
      this.takeColor('#7bc576', mine) // 点击未成熟
    }
    // return clickByTextDesc('克', 0)
    // var filters = className('android.widget.Button')
    //   .filter(function(o) {
    //     var desc = o.text();
    //     log(desc, desc.match(/^收集能量|^\s?$/))
    //     return null !== desc.match(/^收集能量|^\s?$/);
    //   })
    //   .find();
    // // filters.splice(0, 1) // 如果活动结束可以取消对该数组的操作
    // var num = filters.length;
    // log('找到' + num + '个能量球');
    // sleep(100 * num);
    // this.robot.clickMultiCenter(filters);
  };
  // 根据颜色值匹配能量球
  this.takeColor = function(color, mine) {
    // 152宽, 174高: 能量球 
    let point = true;
    let clickCount = 1;
    while(point){
      let img = captureScreen();
      point = findColor(img, color, {
        region: [164, 586, 729, 228],
        threshold: 2
      });
      if(point && point.x){
          log("找到能量球，坐标为(" + point.x + ", " + point.y + ")");
          click(point.x, point.y)
      }

      point = !mine && point && (clickCount < 15)
      img = null // 取消对 img 的引用,显示解除内存占用
      clickCount++
    } 
    console.log('共点击了', clickCount, '次')
  }
  function clickByTextDesc(energyType, paddingY) {
    var clicked = false;
    var num = 0;
    if (descEndsWith(energyType).exists()) {
      descEndsWith(energyType)
        .find()
        .forEach(function(pos, index) {
          num++;
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
        .forEach(function(pos, index) {
          num++;
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
    log('找到' + num + '个能量球');

    return clicked;
  }

  this.autoBack = function() {
    // 误点了按钮则返回
    sleep(500);
    if (
      id('com.alipay.mobile.ui:id/title_bar_title').exists() ||
      text('通知').exists()
    ) {
      this.back();
      sleep(500);
    }
  };

  /**
   * 获取剩余能量球列表
   */
  this.getRemainList = function() {
    var list = [];
    var filters = className('android.widget.Button')
      .filter(function(o) {
        var desc = o.text();
        return null !== desc.match(/^收集能量|^\s?$/);
      })
      .find();
    filters.forEach(
      function(o) {
        var rect = o.bounds();
        list.push([rect.centerX(), rect.centerY()]);
      }.bind(this)
    );

    return list; // [[x, y], [x, y]]
  };

  this.takeRemain = function(list, min_time, max_time) {
    var len = list.length;
    if (!len) return;

    var date = new Date();
    var today = date.toDateString();
    var min_timestamp = Date.parse(today + ' ' + min_time);
    var max_timestamp = Date.parse(today + ' ' + max_time);
    var now = date.getTime();

    if (min_timestamp <= now && now <= max_timestamp) {
      toastLog('开始检测剩余能量');
      var millisecond = max_timestamp - now;
      var step_time = 0;
      var use_time = step_time + 156 * len;
      for (var i = 0; i <= millisecond; i += use_time) {
        // 如果当前页面不在自己能量页,使用clickByTextDesc方式点击
        var tv_title = id('com.alipay.mobile.nebula:id/h5_tv_title').findOnce().text()
        if(tv_title == '蚂蚁森林'){
          this.robot.clickMulti(list);
        }else{
          back()
          sleep(400)
          clickByTextDesc('克', 0)
        }

        sleep(step_time);
      }
      // this.autoBack();

      this.detected = 1;
      toastLog('检测结束');
    }
  };

  /**
   * 收取好友能量
   * @param icon_list
   * @param isEndFunc
   * @param swipe_sleep
   * @param scroll
   * @returns {Array}
   */
  this.takeOthers = function(icon_list, swipe_sleep, isEndFunc, scroll) {
    // var row = (192 * (HEIGHT / 1920)) | 0;
    var row = (234 * (HEIGHT / 2340)) | 0;
    var total_list = [];
    var take_num = icon_list.length;
    var x1, y1, x2, y2;
    x2 = x1 = WIDTH / 2;
    switch (scroll) {
      case 'next':
      default:
        y1 = HEIGHT - row;
        y2 = row;
        break;
      case 'prev':
        y1 = row * 1.5;
        y2 = HEIGHT - row;
        break;
    }
    for (var i = 0; i < take_num; i++) {
      total_list[i] = 0;
    }
    while (1) {
      for (var i = 0; i < take_num; i++) {
        var icon = icon_list[i];
        total_list[i] += this.takeFromImage(icon);
      }
      var isTrue = isEndFunc();
      if (isTrue) {
        break;
      }

      this.robot.swipe(x1, y1, x2, y2);
      sleep(swipe_sleep); // 等待滑动动画
    }
    return total_list;
  };

  /**
   * 找图收取
   * @param icon
   * @returns {number}
   */
  this.takeFromImage = function(icon) {
    var point;
    var row_height = HEIGHT / 10;
    var options = {
      region: [WIDTH - row_height, row_height],
      threshold: 0.7
    };
    var total = 0;
    var times = 0;
    var x = WIDTH / 2;
    var offset = icon.getHeight() / 2;
    while (times < this.options.max_retry_times) {
      this.capture = captureScreen();
      if (null === this.capture) {
        toastLog('截图失败');
        times++;
        sleep(200);
        continue;
      }
      point = findImage(this.capture, icon, options);
      if (null === point) {
        break;
      }

      var y = point.y + offset;
      this.robot.click(x, y);

      sleep(200)
      // 等待好友的森林
      if (this.waitForLoading('的蚂蚁森林')) {
        title = id('com.alipay.mobile.nebula:id/h5_tv_title').findOnce();
        log('进入' + title.text() + '成功');
        total++;

        var cover;
        log(
          '罩',
          descMatches(/\d{2}:\d{2}:\d{2}/).findOnce(),
          textMatches(/\d{2}:\d{2}:\d{2}/).findOnce()
        );
        if (
          (cover =
            descMatches(/\d{2}:\d{2}:\d{2}/).findOnce() ||
            textMatches(/\d{2}:\d{2}:\d{2}/).findOnce())
        ) {
          toastLog('保护罩还剩' + cover.contentDescription + '，忽略');
          log('保护罩还剩' + cover.contentDescription + '，忽略');
        } else {
          // 收取
          this.takeIt();
        }
      } else {
        toastLog('进入好友森林失败');
      }

      // 返回好友列表
      this.back();
      sleep(1000);
    }

    return total;
  };

  this.back = function() {
    back();
  };
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

function addTimes(path, date) {
  // 添加定時器||更新定時器
  path = path || './amineTask.js';
  let timers = require('./EXT_TIMERS.js');
  let iiid = localStorage.get('ant_task');
  let timedTask = timers.getTimedTask(JSON.parse(iiid).mId);
  // log('ssst', iiid, timedTask);
  if (timedTask) {
    // 更新定时任务
    timedTask.setMillis(new Date(date).getTime());
    timers.updateTimedTask(timedTask);
    // log('storage', timedTask);
  } else {
    timedTask = timers.addDisposableTask({
      path: files.path(path),
      date: new Date(date).getTime()
    }); // 添加定時任務
  }

  // 保存定时任务到本地
  localStorage.put('ant_task', JSON.stringify(timedTask));
}
