/* HeyTools notifications. One small API for every tool.
   In the Android app it schedules real system notifications (they ring even when the app is closed).
   In a browser it works only while the page is open, using the Notification API and the HeyTones synth.
     HeyNotify.schedule([{ id, title, body, at, tone, group, repeat:{weekdays:[1..7],hour,minute} }])
     HeyNotify.syncGroup('todo', items)   // replaces every pending item of that group
     HeyNotify.cancelGroup('alarm') / HeyNotify.cancelIds([..])
     HeyNotify.requestPermission()        // resolves 'granted' | 'denied'
   weekday: 1 = Sunday ... 7 = Saturday. */
(function () {
  var CHANNEL_DEFAULT = 'heytools_reminders';
  function cap() {
    var w = window, tries = [function () { return w.Capacitor; }, function () { return w.parent && w.parent.Capacitor; }, function () { return w.top && w.top.Capacitor; }];
    for (var i = 0; i < tries.length; i++) { try { var c = tries[i](); if (c && c.isNativePlatform && c.isNativePlatform()) return c; } catch (e) { /* cross-origin */ } }
    return null;
  }
  var C = cap(), LN = null;
  if (C) { try { LN = C.registerPlugin('LocalNotifications'); } catch (e) { LN = null; } }
  var native = !!LN;
  var channelsReady = null, listeners = {};

  function ensureChannels() {
    if (!native) return Promise.resolve();
    if (channelsReady) return channelsReady;
    var T = window.HeyTones, jobs = [LN.createChannel({ id: CHANNEL_DEFAULT, name: 'Reminders', description: 'To do and habit reminders', importance: 4, visibility: 1, vibration: true })];
    if (T) T.list.forEach(function (t) {
      jobs.push(LN.createChannel({ id: 'tone_' + t.id, name: 'Alarm: ' + t.name, description: 'Alarm with the ' + t.name + ' tone', sound: 'tone_' + t.id + '.wav', importance: 5, visibility: 1, vibration: true, lights: true }));
    });
    channelsReady = Promise.all(jobs.map(function (j) { return j.catch(function () {}); })).then(function () {
      return LN.registerActionTypes({ types: [{ id: 'ALARM', actions: [{ id: 'snooze', title: 'Snooze' }, { id: 'stop', title: 'Stop', destructive: true }] }] }).catch(function () {});
    });
    return channelsReady;
  }

  function permission() {
    if (native) return LN.checkPermissions().then(function (r) { return r.display; });
    try { return Promise.resolve(typeof Notification === 'undefined' ? 'denied' : Notification.permission === 'default' ? 'prompt' : Notification.permission); } catch (e) { return Promise.resolve('denied'); }
  }
  function requestPermission() {
    if (native) {
      return LN.requestPermissions().then(function (r) {
        return LN.checkExactNotificationSetting ? LN.checkExactNotificationSetting().then(function (x) {
          if (x && x.exact_alarm !== 'granted' && LN.changeExactNotificationSetting) return LN.changeExactNotificationSetting().then(function () { return r.display; }, function () { return r.display; });
          return r.display;
        }, function () { return r.display; }) : r.display;
      }).catch(function () { return 'denied'; });
    }
    return new Promise(function (res) {
      try { var p = Notification.requestPermission(function (v) { res(v); }); if (p && p.then) p.then(res, function () { res('denied'); }); } catch (e) { res('denied'); }
    });
  }

  /* ----- browser fallback: timers while the page is open ----- */
  var timers = {};
  function webSchedule(it) {
    clearTimeout(timers[it.id]);
    var at = it.repeat ? nextRepeat(it.repeat) : +new Date(it.at), wait = at - Date.now();
    if (!(wait > 0) || wait > 2147000000) return;
    timers[it.id] = setTimeout(function () {
      try { if (typeof Notification !== 'undefined' && Notification.permission === 'granted') new Notification(it.title, { body: it.body || '', tag: 'hey-' + it.id }); } catch (e) { /* ignore */ }
      if (it.tone && window.HeyTones) window.HeyTones.play(it.tone, { seconds: 6 });
      (listeners.fire || []).forEach(function (f) { try { f(it); } catch (e) { /* ignore */ } });
      if (it.repeat) webSchedule(it);
    }, wait);
  }
  function nextRepeat(r) {
    var best = Infinity, now = new Date();
    (r.weekdays && r.weekdays.length ? r.weekdays : [1, 2, 3, 4, 5, 6, 7]).forEach(function (wd) {
      var d = new Date(now); d.setHours(r.hour, r.minute, 0, 0);
      var diff = (wd - 1 - d.getDay() + 7) % 7; d.setDate(d.getDate() + diff);
      if (d <= now) d.setDate(d.getDate() + 7);
      if (+d < best) best = +d;
    });
    return best;
  }

  /* ----- public API ----- */
  function toNative(it, wd) {
    var n = { id: it.id, title: it.title, body: it.body || '', channelId: it.tone ? 'tone_' + it.tone : CHANNEL_DEFAULT, extra: { group: it.group || '', tone: it.tone || '', label: it.body || '' }, smallIcon: 'ic_stat_hey' };
    if (it.alarm) n.actionTypeId = 'ALARM';
    if (it.repeat) n.schedule = { on: { weekday: wd, hour: it.repeat.hour, minute: it.repeat.minute }, allowWhileIdle: true };
    else n.schedule = { at: new Date(it.at), allowWhileIdle: true };
    return n;
  }
  function schedule(items) {
    items = (items || []).filter(function (i) { return i && i.id != null; });
    if (!native) { items.forEach(webSchedule); return Promise.resolve(items.length); }
    var list = [];
    items.forEach(function (it) {
      if (it.repeat && it.repeat.weekdays && it.repeat.weekdays.length) it.repeat.weekdays.forEach(function (wd) { list.push(toNative(Object.assign({}, it, { id: it.id * 10 + wd }), wd)); });
      else if (it.repeat) [1, 2, 3, 4, 5, 6, 7].forEach(function (wd) { list.push(toNative(Object.assign({}, it, { id: it.id * 10 + wd }), wd)); });
      else if (+new Date(it.at) > Date.now() + 1000) list.push(toNative(Object.assign({}, it, { id: it.id * 10 }), 0));
    });
    if (!list.length) return Promise.resolve(0);
    return ensureChannels().then(function () { return LN.schedule({ notifications: list }); }).then(function () { return list.length; });
  }
  function pending() { return native ? LN.getPending().then(function (r) { return r.notifications || []; }) : Promise.resolve([]); }
  function cancelIds(ids) {
    if (!native) { ids.forEach(function (i) { clearTimeout(timers[i]); }); return Promise.resolve(); }
    var all = []; ids.forEach(function (i) { all.push({ id: i * 10 }); for (var w = 1; w <= 7; w++) all.push({ id: i * 10 + w }); });
    return LN.cancel({ notifications: all }).catch(function () {});
  }
  function cancelGroup(group) {
    if (!native) return Promise.resolve();
    return pending().then(function (list) {
      var mine = list.filter(function (n) { return n.extra && n.extra.group === group; }).map(function (n) { return { id: n.id }; });
      return mine.length ? LN.cancel({ notifications: mine }) : null;
    }).catch(function () {});
  }
  function syncGroup(group, items) {
    items.forEach(function (i) { i.group = group; });
    return cancelGroup(group).then(function () { return schedule(items); });
  }
  function on(evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); }

  if (native) {
    try { LN.addListener('localNotificationActionPerformed', function (e) { (listeners.action || []).forEach(function (f) { try { f(e.actionId, e.notification); } catch (x) { /* ignore */ } }); }); } catch (e) { /* ignore */ }
  }
  window.HeyNotify = { isNative: native, permission: permission, requestPermission: requestPermission, schedule: schedule, syncGroup: syncGroup, cancelGroup: cancelGroup, cancelIds: cancelIds, pending: pending, on: on, ensureChannels: ensureChannels };
})();
