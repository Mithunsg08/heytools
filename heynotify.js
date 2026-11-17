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
  var C=cap(),LN=null,HA=null;
  if(C){try{LN=C.registerPlugin('LocalNotifications');}catch(e){}try{HA=C.registerPlugin('HeyAlarm');}catch(e){}}
  var native=!!LN,channelsReady=null,listeners=Object.create(null),pendingActions=[];
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
    if(native)return LN.checkPermissions().then(function(r){return r.display;});
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
    if(native)return LN.requestPermissions().then(function(r){return r.display;}).catch(function(){return 'denied';});
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
  function schedule(items){
    items=(items||[]).filter(function(i){return i&&i.id!=null;});
    if(!native){items.forEach(webSchedule);return Promise.resolve(items.length);}
    var list=[];
    items.forEach(function(it){
      if(it.repeat&&it.repeat.weekdays&&it.repeat.weekdays.length)it.repeat.weekdays.forEach(function(wd){list.push(toNative(Object.assign({},it,{id:it.id*10+wd}),wd));});
      else if(it.repeat)[1,2,3,4,5,6,7].forEach(function(wd){list.push(toNative(Object.assign({},it,{id:it.id*10+wd}),wd));});
      else if(+new Date(it.at)>Date.now()+1000)list.push(toNative(Object.assign({},it,{id:it.id*10}),0));
    });
    if(!list.length)return Promise.resolve(0);
    return ensureChannels().then(function(){return LN.schedule({notifications:list});}).then(function(){return list.length;});
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
    if(group==='alarm'&&native&&HA&&HA.syncAlarms)return HA.syncAlarms({alarms:items.map(nativeAlarmItem)}).then(function(r){return r.scheduled||items.length;});
    return cancelGroup(group).then(function(){return schedule(items);});
  }
  function alarmState(){return native&&HA&&HA.getState?HA.getState():Promise.resolve({alarms:[],exactPermission:false});}
  function on(evt,fn){
    (listeners[evt]=listeners[evt]||[]).push(fn);
    if(evt==='action'&&pendingActions.length){
      var queued=pendingActions.splice(0);
      queued.forEach(function(e){try{fn(e.actionId,e.notification);}catch(x){}});
    }
  }
  if(native)LN.addListener('localNotificationActionPerformed',function(e){
    var handlers=listeners.action||[];
    if(!handlers.length){pendingActions.push(e);if(pendingActions.length>20)pendingActions.shift();return;}
    handlers.forEach(function(fn){try{fn(e.actionId,e.notification);}catch(x){}});
  });
  window.HeyNotify={isNative:native,permission:permission,exactPermission:exactPermission,requestPermission:requestPermission,
    requestExactPermission:requestExactPermission,schedule:schedule,syncGroup:syncGroup,cancelGroup:cancelGroup,
    cancelIds:cancelIds,cancelAlarmIds:cancelAlarmIds,pending:pending,alarmState:alarmState,on:on,ensureChannels:ensureChannels};
})();