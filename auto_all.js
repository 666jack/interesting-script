unlock();

var WIDTH1 = Math.min(device.width, device.height);
var HEIGHT1 = Math.max(device.width, device.height);
mainEntrence();

//解锁
function unlock() {
  if (!device.isScreenOn()) {
    // 进行解锁屏幕
    require('./gotoScreen');
  }
}

//蚂蚁会员积分
function get_alipay_points() {
  var account = ['om', 'cn', '54', '37', '17'];
  let idx = 0;
  forProgress();
  // ------------------------------ 进入设置->换账号登录->获取结尾的账号->我的 ------------------------------
  //   进入设置
  for (let i = 0; i <= account.length; i++) {
    clickByTextDesc('设置', 0);
    sleep(500);
    clickByTextDesc('换账号登录', 0);
    sleep(500);
    idx = i + 1;
    toastLog(idx);
    if (idx >= account.length) {
      idx = 0;
      sleep(800);
      clickByTextDesc(account[idx], 0);
      break;
    }
    toastLog(i);
    sleep(800);
    clickByTextDesc(account[idx], 0);
    enterMyMainPage();
    sleep(800);
    if (idx > 2) {
      clickByTextDesc('我的', 0);
      continue;
    }
    forProgress();
  }

  clickByTextDesc('首页', 0);
}

/**
 * 从支付宝主页进入蚂蚁森林我的主页
 */
function enterMyMainPage() {
  //五次尝试蚂蚁森林入
  var i = 0;
  swipe(520, 600, 520, 1200, 500);
  sleep(800);
  app.startActivity({
    action: 'VIEW',
    data: 'alipays://platformapi/startapp?appId=60000002'
  });

  //等待进入自己的主页,10次尝试
  sleep(5000);
  back();
  sleep(500);

  app.startActivity({
    action: 'VIEW',
    data: 'alipays://platformapi/startapp?appId=60000002'
  });
  sleep(800);
  i = 0;
  while (
    !textEndsWith('背包').exists() &&
    !descEndsWith('地图').exists() &&
    i <= 10
  ) {
    sleep(1000);
    i++;
  }
  toastLog('第' + i + '次尝试进入自己主页');
  if (i >= 10) {
    toastLog('进入自己能量主页失败');
    return false;
    //exit_till_error();
  }

  swipe(520, 1800, 520, 600, 50);

  sleep(1500)

  //收自己能量
  log(clickByTextDesc('环保证书', 0));
  sleep(800)
  if(id('com.alipay.mobile.nebula:id/h5_tv_title').findOnce().text()!='风萧萧兮的蚂蚁森林'){
    back()
    sleep(400)
    back()
    return
  };
  sleep(800);
  var i = 0;
  while (
    !textEndsWith('的蚂蚁森林').exists() &&
    !descEndsWith('的蚂蚁森林').exists() &&
    i <= 10
  ) {
    sleep(1000);
    i++;
  }
  toastLog('第' + i + '次尝试进入好友主页');
  if (i >= 10) {
    toastLog('进入好友能量主页失败');
    return false;
    //exit_till_error();
  }
  // 1005 x, 1543 y
  click(1005, 1543)
  // clickByTextDesc('浇水', 0);
  sleep(1000);
  click(957, 1928); // 18g
  sleep(800);
  click(WIDTH1 / 2, HEIGHT1 * 0.95); // 浇水1
  toastLog('浇水1');
  sleep(1000);
  // click(WIDTH1 / 2, 1900); // 五福

  // clickByTextDesc('浇水', 0);
  click(1005, 1543)
  sleep(1000);
  click(957, 1928); // 18g
  sleep(300);
  click(WIDTH1 / 2, HEIGHT1 * 0.95); // 浇水1
  toastLog('浇水2');
  sleep(1000);
  // click(WIDTH1 / 2, 1900); // 五福

  // clickByTextDesc('浇水', 0);
  click(1005, 1543)
  sleep(1000);
  click(957, 1928); // 18g
  sleep(300);
  click(WIDTH1 / 2, HEIGHT1 * 0.95); // 浇水1
  toastLog('浇水3');
  sleep(1000);
  back();
  sleep(800);
  back();
  sleep(1000);
  return true;
}

function forProgress() {
  toastLog('进入forprogress');
  clickByTextDesc('我的', 0);
  sleep(1500);
  clickByTextDesc('支付宝会员', 0);
  sleep(1000);
  clickByTextDesc('领积分', 0);
  sleep(2000);
  var i = 0;
  for (i = 0; i < 10; i++) {
    clickByTextDesc('点击领取', 0);
    sleep(100);
  }
  back();
  sleep(400);
  back();
  sleep(400);
}

//程序主入口
function mainEntrence() {
  //打开支付宝
  openAlipay();

  // enterMyMainPage()

  get_alipay_points();
  toastLog('退出程序');
  exit();
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

function openAlipay() {
  launchApp('支付宝');
  toastLog('等待支付宝启动');
  sleep(1000);
  var i = 0;
  while (
    !textEndsWith('扫一扫').exists() &&
    !descEndsWith('扫一扫').exists() &&
    i <= 5
  ) {
    swipe(520, 300, 520, 1800, 50);
    sleep(500);
    if (!textEndsWith('扫一扫').exists() && !descEndsWith('扫一扫').exists()) {
      back();
      sleep(500);
      launchApp('支付宝');
      sleep(500);
      clickByTextDesc('首页', 0);
    }
    i++;
  }
  toastLog('第' + i + '次尝试进入支付宝主页');
  if (i >= 5) {
    toastLog('没有找到支付宝首页');
    sleep(1000);
    clickByTextDesc('首页', 0);
    return false;
    //exit_till_error();
  }
  return true;
}
