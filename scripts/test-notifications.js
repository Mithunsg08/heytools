#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'..','heynotify.js'),'utf8');

async function nativeTests(){
  const calls={alarms:[],scheduled:[],cancelled:[],actionTypes:[],listeners:{}};
  const LN={
    createChannel:async()=>({}),registerActionTypes:async x=>calls.actionTypes.push(x),
    checkPermissions:async()=>({display:'granted'}),requestPermissions:async()=>({display:'granted'}),
    checkExactNotificationSetting:async()=>({exact_alarm:'granted'}),
    changeExactNotificationSetting:async()=>({exact_alarm:'granted'}),
    schedule:async x=>{calls.scheduled.push(...x.notifications);return{};},
    getPending:async()=>({notifications:[]}),cancel:async x=>calls.cancelled.push(...x.notifications),
    addListener:(name,fn)=>{calls.listeners[name]=fn;return Promise.resolve();}
  };
  const HA={
    syncAlarms:async x=>{calls.alarms.push(x.alarms);return{scheduled:x.alarms.length};},
    cancelAlarms:async x=>calls.cancelled.push(...x.ids.map(id=>({alarmId:id}))),
    getState:async()=>({alarms:[],exactPermission:true}),
    requestExactPermission:async()=>({exactPermission:true})
  };
  const window={Capacitor:{isNativePlatform:()=>true,registerPlugin:n=>n==='HeyAlarm'?HA:LN},parent:null,top:null};
  window.parent=window;window.top=window;
  const ctx={window,Date,Promise,Notification:undefined,setTimeout,clearTimeout,console,Object,Math};
  vm.runInNewContext(source,ctx,{filename:'heynotify.js'});
  const H=window.HeyNotify;
  assert.equal(H.isNative,true);
  const at=Date.now()+3600000;
  await H.syncGroup('alarm',[
    {id:1234,title:'Morning',body:'Wake up',tone:'classic',alarm:true,snooze:8,at},
    {id:1235,title:'Weekdays',tone:'chime',alarm:true,snooze:5,repeat:{weekdays:[1,2,6],hour:7,minute:5}}
  ]);
  assert.equal(calls.alarms.length,1);
  assert.equal(calls.alarms[0].length,2);
  assert.equal(calls.alarms[0][0].id,1234);
  assert.equal(calls.alarms[0][0].at,at);
  assert.deepEqual(Array.from(calls.alarms[0][1].days),[0,1,5]);
  assert.equal(calls.alarms[0][1].time,'07:05');
  assert.equal(calls.alarms[0][1].snooze,5);
  await H.syncGroup('water',[{id:800,title:'Water',body:'Drink',repeat:{hour:8,minute:15},group:'water'}]);
  assert.equal(calls.scheduled.length,7);
  assert.equal(calls.scheduled[0].actionTypeId,'WATER');
  assert.equal(calls.scheduled[0].extra.group,'water');
  let action='';
  H.on('action',(id)=>{action=id;});
  calls.listeners.localNotificationActionPerformed({actionId:'log',notification:{id:800001}});
  assert.equal(action,'log');
  await H.cancelIds([800]);
  assert.equal(calls.cancelled.some(x=>x.alarmId===800),false,'generic reminder cancellation must not touch alarm storage');
  await H.cancelAlarmIds([1234]);
  assert.equal(calls.cancelled.some(x=>x.alarmId===1234),true);
  await H.cancelGroup('alarm');
  assert.equal(calls.alarms.at(-1).length,0);
  assert.equal(await H.permission(),'granted');
  assert.equal(await H.exactPermission(),'granted');
  await H.requestPermission();
  assert.equal(await H.requestExactPermission(),'granted');
  console.log('PASS: native alarm mapping, weekday conversion, group isolation, actions and permissions');
}

async function browserTests(){
  const timers=[],cleared=[];
  const window={parent:null,top:null};window.parent=window;window.top=window;
  const ctx={window,Date,Promise,Notification:{permission:'granted'},setTimeout:(fn,ms)=>{const id=timers.length+1;timers.push({id,fn,ms});return id;},clearTimeout:id=>cleared.push(id),console,Object,Math};
  vm.runInNewContext(source,ctx,{filename:'heynotify.js browser'});
  const H=window.HeyNotify;
  assert.equal(H.isNative,false);
  await H.syncGroup('water',[{id:44,title:'Water',at:Date.now()+60000,group:'water'}]);
  assert.equal(timers.length,1);
  await H.cancelGroup('water');
  assert.equal(cleared.length,1);
  console.log('PASS: browser fallback schedules and cancels while the page is active');
}

(async()=>{await nativeTests();await browserTests();console.log('Notification tests completed successfully.');})().catch(e=>{console.error(e);process.exitCode=1;});
