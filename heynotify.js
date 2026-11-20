/* HeyTools notification broker.
   Android alarms use the native AlarmManager/AlarmClock path so they survive process death and reboot.
   Other reminders use Capacitor Local Notifications. Browser timers are best-effort while the page remains open. */
(function () {
  'use strict';
  var CHANNEL_DEFAULT = 'heytools_reminders';
  function cap() {
    var w=window, tries=[function(){return w.Capacitor;},function(){return w.parent&&w.parent.Capacitor;},function(){return w.top&&w.top.Capacitor;}];
    for(var i=0;i<tries.length;i++){try{var c=tries[i]();if(c&&c.isNativePlatform&&c.isNativePlatform())return c;}catch(e){}}
    return null;
  }
  var regErr={},C=null,LN=null,HA=null,native=false,channelsReady=null,listeners=Object.create(null),pendingActions=[],actionHooked=false;
  /* The Android bridge can appear a moment after this script runs, so look again until it shows up */
  function init(){
    if(native)return true;
    C=cap();
    if(!C){try{if(window.HeyNative&&window.HeyNative.isNative&&window.Capacitor&&window.Capacitor.registerPlugin)C=window.Capacitor;}catch(e){}}
    if(!C)return false;
    function getP(n){var P=null;try{P=C.Plugins&&C.Plugins[n];}catch(e){}if(P)return P;try{return C.registerPlugin(n);}catch(e){regErr[n]=String((e&&e.message)||e).slice(0,70);}return null;}
    LN=getP('LocalNotifications');HA=getP('HeyAlarm');
    native=!!(LN||HA);
    if(window.HeyNotify)window.HeyNotify.isNative=native;
    if(native&&!actionHooked){actionHooked=true;hookActions();}
    return native;
  }
  var initTries=0;
  if(typeof setInterval==='function'&&!native){var initTimer=setInterval(function(){if(init()||++initTries>40)clearInterval(initTimer);},250);}
  try{window.addEventListener('load',init);document.addEventListener('DOMContentLoaded',init);}catch(e){}
  var ACTION_TYPES=[
    {id:'ALARM',actions:[{id:'snooze',title:'Snooze'},{id:'stop',title:'Stop',destructive:true}]},
    {id:'TIMER',actions:[{id:'restart',title:'Restart'},{id:'dismiss',title:'Dismiss',destructive:true}]},
    {id:'TASK',actions:[{id:'done',title:'Mark done'},{id:'snooze',title:'Snooze'}]},
    {id:'WATER',actions:[{id:'log',title:'Log 250 ml'},{id:'snooze',title:'Remind in 1 hour'}]},
    {id:'HABIT',actions:[{id:'open',title:'Open habits'},{id:'later',title:'Later'}]},
    {id:'FOCUS',actions:[{id:'next',title:'Start next session'},{id:'dismiss',title:'Dismiss'}]}
  ];
  function ensureChannels(){
    if(!native)return Promise.resolve();
    if(channelsReady)return channelsReady;
    var T=window.HeyTones,jobs=[LN.createChannel({id:CHANNEL_DEFAULT,name:'Reminders',description:'HeyTools reminders and timers',importance:4,visibility:1,vibration:true})];
    if(T)T.list.forEach(function(t){jobs.push(LN.createChannel({id:'tone_'+t.id,name:'Alarm: '+t.name,description:'Alarm tone '+t.name,sound:'tone_'+t.id+'.wav',importance:5,visibility:1,vibration:true,lights:true}));});
    channelsReady=Promise.all(jobs.map(function(p){return p.catch(function(){});})).then(function(){return LN.registerActionTypes({types:ACTION_TYPES}).catch(function(){});});
    return channelsReady;
  }
  function permission(){
    if(native)return LN.checkPermissions().then(function(r){return r.display;}).catch(function(){return 'prompt';}).then(function(d){
      if(d==='granted'||!(HA&&HA.getNotificationState))return d;
      /* the plugin can disagree with Android (some phones have their own switch): trust what Android itself reports */
      return HA.getNotificationState().then(function(s){return s&&s.enabled?'granted':d;}).catch(function(){return d;});
    });
    try{return Promise.resolve(typeof Notification==='undefined'?'denied':Notification.permission==='default'?'prompt':Notification.permission);}catch(e){return Promise.resolve('denied');}
  }
  function exactPermission(){
    if(!native)return Promise.resolve('not-applicable');
    // HeyAlarm is the source of truth for AlarmManager's exact-alarm permission.
    // LocalNotifications may not expose this setting on every plugin version.
    if(HA&&HA.getState)return HA.getState().then(function(r){return r&&r.exactPermission?'granted':'denied';}).catch(function(){return 'unknown';});
    if(!LN.checkExactNotificationSetting)return Promise.resolve('unknown');
    return LN.checkExactNotificationSetting().then(function(r){return r&&typeof r.exact_alarm==='string'?r.exact_alarm:'unknown';}).catch(function(){return 'unknown';});
  }
  function requestPermission(){
    if(native)return permission().then(function(p){
      if(p==='granted')return p;
      return LN.requestPermissions().then(function(r){return r.display;}).catch(function(){return 'denied';}).then(function(d){
        return d==='granted'?d:permission();      // after the system dialog, ask Android again
      });
    });
    return new Promise(function(resolve){
      try{var p=Notification.requestPermission(function(v){resolve(v);});if(p&&p.then)p.then(resolve,function(){resolve('denied');});}
      catch(e){resolve('denied');}
    });
  }
  function requestExactPermission(){
    if(!native)return Promise.resolve('not-applicable');
    if(LN.changeExactNotificationSetting)return LN.changeExactNotificationSetting().then(function(r){return r&&r.exact_alarm||'unknown';}).catch(function(){return exactPermission();});
    if(HA&&HA.requestExactPermission)return HA.requestExactPermission().then(function(r){return r.exactPermission?'granted':'denied';});
    return exactPermission();
  }

  /* ---------- user notification settings (shared by the app and every tool) ----------
     all: master switch, alarm / remind / timers / updates: per type, quiet: hold gentle reminders overnight.
     Alarms and timers are never delayed by quiet hours, because the person set them for an exact time. */
  var PREF_KEY='heytools.notif.prefs.v1';
  var DEFAULTS={all:true,alarm:true,remind:true,timers:true,updates:true,quiet:false,qFrom:'22:00',qTo:'07:00'};
  function prefs(){
    var p={};try{p=JSON.parse(localStorage.getItem(PREF_KEY)||'{}')||{};}catch(e){}
    var o={};Object.keys(DEFAULTS).forEach(function(k){o[k]=(typeof p[k]===typeof DEFAULTS[k])?p[k]:DEFAULTS[k];});
    return o;
  }
  function setPrefs(patch){
    var o=prefs();Object.keys(patch||{}).forEach(function(k){if(k in DEFAULTS&&typeof patch[k]===typeof DEFAULTS[k])o[k]=patch[k];});
    try{localStorage.setItem(PREF_KEY,JSON.stringify(o));}catch(e){}
    return o;
  }
  function kindOf(it){
    if(it&&+it.id===99001)return 'updates';
    var g=(it&&(it.group||it.kind))||'';
    if(g==='alarm'||it&&it.alarm)return 'alarm';
    if(g==='timers')return 'timers';
    if(g==='test')return 'test';
    return 'remind';
  }
  function allowedKind(k){
    var p=prefs();if(!p.all)return false;
    if(k==='alarm')return p.alarm;if(k==='timers')return p.timers;if(k==='updates')return p.updates;return k==='test'||p.remind;
  }
  function minutes(hm){var a=String(hm||'0:0').split(':');return (+a[0]||0)*60+(+a[1]||0);}
  function inQuiet(mins,p){
    var f=minutes(p.qFrom),e=minutes(p.qTo);if(f===e)return false;
    return f<e?(mins>=f&&mins<e):(mins>=f||mins<e);
  }
  /* move a gentle reminder out of quiet hours: it fires when quiet hours end instead */
  function quietShift(it){
    var p=prefs();if(!p.quiet||kindOf(it)!=='remind')return it;
    var c=Object.assign({},it);
    if(c.repeat){
      if(inQuiet(c.repeat.hour*60+c.repeat.minute,p)){var e=minutes(p.qTo);c.repeat=Object.assign({},c.repeat,{hour:Math.floor(e/60),minute:e%60});}
      return c;
    }
    var d=new Date(c.at);if(isNaN(+d))return c;
    if(inQuiet(d.getHours()*60+d.getMinutes(),p)){
      var end=minutes(p.qTo),x=new Date(d);x.setHours(Math.floor(end/60),end%60,0,0);
      if(x<=d)x.setDate(x.getDate()+1);c.at=+x;
    }
    return c;
  }

  var timers=Object.create(null),timerGroups=Object.create(null);
  function clearWebTimer(id){if(timers[id]!=null)clearTimeout(timers[id]);delete timers[id];delete timerGroups[id];}
  function nextRepeat(r){
    var best=Infinity,now=new Date();
    (r.weekdays&&r.weekdays.length?r.weekdays:[1,2,3,4,5,6,7]).forEach(function(wd){
      var d=new Date(now);d.setHours(r.hour,r.minute,0,0);var diff=(wd-1-d.getDay()+7)%7;d.setDate(d.getDate()+diff);
      if(d<=now)d.setDate(d.getDate()+7);if(+d<best)best=+d;
    });return best;
  }
  function webSchedule(it){
    clearWebTimer(it.id);var at=it.repeat?nextRepeat(it.repeat):+new Date(it.at);
    if(!(at>Date.now()))return;timerGroups[it.id]=it.group||'';
    function arm(){
      var remaining=at-Date.now();
      if(remaining<=0){
        delete timers[it.id];
        try{if(typeof Notification!=='undefined'&&Notification.permission==='granted')new Notification(it.title,{body:it.body||'',tag:'hey-'+it.id});}catch(e){}
        if(it.tone&&window.HeyTones)window.HeyTones.play(it.tone,{seconds:6});
        (listeners.fire||[]).forEach(function(fn){try{fn(it);}catch(e){}});
        if(it.repeat)webSchedule(it);else delete timerGroups[it.id];return;
      }
      timers[it.id]=setTimeout(arm,Math.min(remaining,2147000000));
    }arm();
  }
  function actionType(it){
    if(it.actionTypeId)return it.actionTypeId;
    if(it.alarm)return 'ALARM';
    var g=it.kind||it.group||'';
    if(g==='timers')return 'TIMER';if(g==='todo'||g==='task')return 'TASK';if(g==='water')return 'WATER';
    if(g==='habit')return 'HABIT';if(g==='focus')return 'FOCUS';return '';
  }
  function toNative(it,wd){
    var n={id:it.id,title:it.title,body:it.body||'',channelId:it.tone?'tone_'+it.tone:CHANNEL_DEFAULT,
      extra:{group:it.group||'',tone:it.tone||'',label:it.body||'',kind:it.kind||''},smallIcon:'ic_stat_hey'};
    var a=actionType(it);if(a)n.actionTypeId=a;
    if(it.repeat)n.schedule={on:{weekday:wd,hour:it.repeat.hour,minute:it.repeat.minute},allowWhileIdle:true};
    else n.schedule={at:new Date(it.at),allowWhileIdle:true};
    return n;
  }
  var lastError='';
  /* Android 13+ rejects scheduling until notifications are allowed. Ask first and wait for the answer, so the very first reminder is not lost. */
  function ensureAllowed(){
    return permission().then(function(p){return p==='granted'?p:(p==='denied'?p:requestPermission());}).catch(function(){return 'denied';});
  }
  /* try everything at once; if Android rejects the batch, retry one by one on the plain channel so a single bad item cannot drop the rest */
  function scheduleNative(list){
    return LN.schedule({notifications:list}).catch(function(e){
      lastError=String((e&&e.message)||e);
      return Promise.all(list.map(function(n){
        var plain=Object.assign({},n,{channelId:CHANNEL_DEFAULT});delete plain.actionTypeId;
        return LN.schedule({notifications:[plain]}).catch(function(e2){lastError=String((e2&&e2.message)||e2);return null;});
      }));
    });
  }
  function schedule(items){
    var now=Date.now();
    items=(items||[]).filter(function(i){return i&&i.id!=null&&allowedKind(kindOf(i));}).map(function(it){
      /* something due a moment ago (the person was answering a permission prompt) still fires, right away */
      var at=+new Date(it.at);
      if(!it.repeat&&at<=now+1000&&at>now-120000)it=Object.assign({},it,{at:now+1500});
      return quietShift(it);
    });
    if(!native){items.forEach(webSchedule);return Promise.resolve(items.length);}
    if(!items.length)return Promise.resolve(0);
    return ensureAllowed().then(function(p){
      if(p!=='granted')return 0;
      return scheduleItemsNative(items);
    });
  }
  function scheduleItemsNative(items){
    var list=[];
    items.forEach(function(it){
      if(it.repeat&&it.repeat.weekdays&&it.repeat.weekdays.length)it.repeat.weekdays.forEach(function(wd){list.push(toNative(Object.assign({},it,{id:it.id*10+wd}),wd));});
      else if(it.repeat)[1,2,3,4,5,6,7].forEach(function(wd){list.push(toNative(Object.assign({},it,{id:it.id*10+wd}),wd));});
      else if(+new Date(it.at)>Date.now()+1000)list.push(toNative(Object.assign({},it,{id:it.id*10}),0));
    });
    if(!list.length)return Promise.resolve(0);
    return ensureChannels().then(function(){return scheduleNative(list);}).then(function(){return list.length;});
  }
  /* for Settings: what Android currently has scheduled, and the last problem scheduling reported */
  function diagnose(){
    if(!native)return Promise.resolve({native:false,pending:0,lastError:lastError});
    return pending().then(function(l){return {native:true,pending:l.length,lastError:lastError};}).catch(function(){return {native:true,pending:-1,lastError:lastError};});
  }
  function pending(){return native?LN.getPending().then(function(r){return r.notifications||[];}):Promise.resolve([]);}
  function cancelIds(ids){
    ids=ids||[];
    if(!native){ids.forEach(clearWebTimer);return Promise.resolve();}
    var all=[];ids.forEach(function(i){all.push({id:i*10});for(var w=1;w<=7;w++)all.push({id:i*10+w});});
    return LN.cancel({notifications:all}).catch(function(){});
  }
  function cancelAlarmIds(ids){
    if(!native||!HA||!HA.cancelAlarms)return cancelIds(ids);
    return HA.cancelAlarms({ids:ids||[]}).catch(function(){});
  }
  function cancelGroup(group){
    if(group==='alarm'&&native&&HA&&HA.syncAlarms)return HA.syncAlarms({alarms:[]}).then(function(){});
    if(!native){Object.keys(timerGroups).forEach(function(id){if(timerGroups[id]===group)clearWebTimer(id);});return Promise.resolve();}
    return pending().then(function(list){
      var mine=list.filter(function(n){return n.extra&&n.extra.group===group;}).map(function(n){return {id:n.id};});
      return mine.length?LN.cancel({notifications:mine}):null;
    }).catch(function(){});
  }
  function nativeAlarmItem(it){
    var days=it.repeat&&it.repeat.weekdays?it.repeat.weekdays.map(function(d){return d-1;}):[];
    var t=it.repeat?String(it.repeat.hour).padStart(2,'0')+':'+String(it.repeat.minute).padStart(2,'0'):'';
    return {id:+it.id,title:it.title||'Alarm',body:it.body||'',label:it.title||'Alarm',tone:it.tone||'classic',
      at:it.at?+new Date(it.at):0,time:t,days:days,snooze:it.snooze||10,on:true};
  }
  function syncGroup(group,items){
    items=items||[];items.forEach(function(i){i.group=group;});
    if(!allowedKind(kindOf({group:group}))){
      if(group==='alarm'&&native&&HA&&HA.syncAlarms)return HA.syncAlarms({alarms:[]}).then(function(){return 0;}).catch(function(){return 0;});
      return cancelGroup(group).then(function(){return 0;});
    }
    if(group==='alarm'&&native&&HA&&HA.syncAlarms)return HA.syncAlarms({alarms:items.map(nativeAlarmItem)}).then(function(r){return r.scheduled||items.length;});
    return cancelGroup(group).then(function(){return schedule(items);});
  }
  function alarmState(){return native&&HA&&HA.getState?HA.getState():Promise.resolve({alarms:[],exactPermission:false});}
  function cancelAll(){
    var jobs=[];
    if(native){
      jobs.push(LN.getPending().then(function(r){var l=(r.notifications||[]).map(function(n){return {id:n.id};});return l.length?LN.cancel({notifications:l}):null;}).catch(function(){}));
      if(HA&&HA.syncAlarms)jobs.push(HA.syncAlarms({alarms:[]}).catch(function(){}));
    }else{Object.keys(timers).forEach(clearWebTimer);}
    return Promise.all(jobs).then(function(){});
  }
  /* a notification a few seconds from now, so the person can check that sound, banner and permission all work */
  function sendTest(){
    if(!prefs().all)return Promise.resolve('off');
    return requestPermission().then(function(r){
      if(r!=='granted'){openNotificationSettings();return 'denied';}
      return schedule([{id:99002,title:'HeyTools test',body:'Notifications are working on this device.',at:Date.now()+3000,group:'test'}]).then(function(){return 'sent';});
    });
  }
  /* a real alarm 60 seconds from now, using the same exact-alarm path as the Alarm Clock tool */
  function testAlarm(){
    if(!(native&&HA&&HA.testAlarm))return Promise.resolve('unsupported');
    return HA.testAlarm().then(function(){return 'scheduled';}).catch(function(e){return (e&&e.message)||'failed';});
  }
  function batteryState(){
    if(!(native&&HA&&HA.getBatteryState))return Promise.resolve('unknown');
    return HA.getBatteryState().then(function(r){return r&&r.unrestricted?'ok':'restricted';}).catch(function(e){lastError='battery check: '+String((e&&e.message)||e);return 'unknown';});
  }
  function openBatterySettings(){
    if(!(native&&HA&&HA.openBatterySettings))return Promise.resolve();
    return HA.openBatterySettings().catch(function(){});
  }
  function setAutoUpdate(on){
    if(!(native&&HA&&HA.setAutoUpdate))return Promise.resolve();
    return HA.setAutoUpdate({enabled:!!on}).catch(function(){});
  }
  /* what each native call really answers, so a wrong status on the Settings screen can be traced */
  function rawState(){
    init();
    var out={native:native,alarmPlugin:!!HA,notifPlugin:!!LN,v:'37',regErr:regErr},jobs=[];
    try{var W=window.Capacitor;out.cap=!!W;out.isNP=W&&W.isNativePlatform?String(W.isNativePlatform()):'n/a';out.plat=W&&W.getPlatform?W.getPlatform():'n/a';out.heyNative=!!(window.HeyNative&&window.HeyNative.isNative);}catch(e){out.capErr=String(e).slice(0,50);}
    function err(k){return function(e){out[k]=String((e&&e.message)||e).slice(0,60);};}
    if(HA){out.fns=['getState','getNotificationState','getBatteryState','syncAlarms','testAlarm'].map(function(n){return n+':'+(typeof HA[n]==='function'?'y':'n');}).join(' ');}
    if(HA&&HA.getState)jobs.push(HA.getState().then(function(r){out.exactOk=!!(r&&r.exactPermission);out.alarmsSet=((r&&r.alarms)||[]).length;}).catch(err('getStateErr')));
    if(HA&&HA.getNotificationState)jobs.push(HA.getNotificationState().then(function(r){out.androidNotifOn=r&&r.enabled;out.permission=r&&r.runtime;out.sdk=r&&r.sdk;}).catch(err('notifStateErr')));
    if(LN)jobs.push(LN.checkPermissions().then(function(r){out.pluginSays=r&&r.display;}).catch(err('checkPermErr')));
    return Promise.all(jobs).then(function(){return JSON.stringify(out);});
  }
  function notificationState(){
    if(!(native&&HA&&HA.getNotificationState))return Promise.resolve(null);
    return HA.getNotificationState().catch(function(){return null;});
  }
  function openNotificationSettings(){
    if(!(native&&HA&&HA.openNotificationSettings))return Promise.resolve();
    return HA.openNotificationSettings().catch(function(){});
  }
  function on(evt,fn){
    (listeners[evt]=listeners[evt]||[]).push(fn);
    if(evt==='action'&&pendingActions.length){
      var queued=pendingActions.splice(0);
      queued.forEach(function(e){try{fn(e.actionId,e.notification);}catch(x){}});
    }
  }
  function hookActions(){LN.addListener('localNotificationActionPerformed',function(e){
    var handlers=listeners.action||[];
    if(!handlers.length){pendingActions.push(e);if(pendingActions.length>20)pendingActions.shift();return;}
    handlers.forEach(function(fn){try{fn(e.actionId,e.notification);}catch(x){}});
  });}
  window.HeyNotify={isNative:native,permission:permission,exactPermission:exactPermission,requestPermission:requestPermission,
    requestExactPermission:requestExactPermission,schedule:schedule,syncGroup:syncGroup,cancelGroup:cancelGroup,
    cancelIds:cancelIds,cancelAlarmIds:cancelAlarmIds,pending:pending,alarmState:alarmState,on:on,ensureChannels:ensureChannels,
    prefs:prefs,setPrefs:setPrefs,cancelAll:cancelAll,sendTest:sendTest,testAlarm:testAlarm,batteryState:batteryState,notificationState:notificationState,rawState:rawState,openNotificationSettings:openNotificationSettings,diagnose:diagnose,openBatterySettings:openBatterySettings,setAutoUpdate:setAutoUpdate,init:init};
  init();
})();