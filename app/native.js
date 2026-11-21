/* Bridge to the Android app (Capacitor). In a normal browser every call reports "not native" and the web fallbacks are used. */
(function () {
  var C = window.Capacitor;
  var native = !!(C && C.isNativePlatform && C.isNativePlatform());
  var P = null, A = null, SR = null, AL = null;
  if (native) {
    try { P = C.registerPlugin ? C.registerPlugin('MediaLibrary') : C.Plugins.MediaLibrary; } catch (e) { P = null; }
    try { A = C.registerPlugin ? C.registerPlugin('App') : C.Plugins.App; } catch (e) { A = null; }
    try { AL = C.registerPlugin ? C.registerPlugin('HeyAlarm') : C.Plugins.HeyAlarm; } catch (e) { AL = null; }
    try { SR = C.registerPlugin ? C.registerPlugin('ScreenRecord') : C.Plugins.ScreenRecord; } catch (e) { SR = null; }
  }
  function url(path) {
    return C.convertFileSrc('file://' + path.split('/').map(encodeURIComponent).join('/'));
  }
  window.HeyNative = {
    isNative: native,
    hasMedia: native && !!P,
    /* keeps the app running (with a notification) while a long job such as compressing or removing a background is busy */
    startWork: function (title, text) { try { return AL && AL.startWork ? AL.startWork({ title: title, text: text }).catch(function () {}) : null; } catch (e) { return null; } },
    stopWork: function () { try { return AL && AL.stopWork ? AL.stopWork().catch(function () {}) : null; } catch (e) { return null; } },
    /* Screen recording (Android MediaProjection). Older app builds do not have it, so check hasScreen first. */
    hasScreen: native && !!SR && !!SR.exportToGallery,
    screenStart: function (opts) { return SR.start(opts || {}); },
    screenStop: function () { return SR.stop(); },
    screenPause: function () { return SR.pause(); },
    screenResume: function () { return SR.resume(); },
    screenStatus: function () { return SR.status(); },
    screenExport: function (path, name) { return SR.exportToGallery({ path: path, name: name }); },
    screenDelete: function (path) { return SR.deleteFile({ path: path }); },
    onScreenFinished: function (cb) { try { return SR.addListener('finished', cb); } catch (e) { return null; } },
    fileUrl: function (path) { return url(path); },
    /* Ask Android for access to videos or music. Resolves true when granted. */
    ensure: function (kind) {
      return P.requestAccess({ kind: kind }).then(function (r) { return !!(r && r.granted); });
    },
    has: function (kind) {
      return P.checkAccess({ kind: kind }).then(function (r) { return !!(r && r.granted); }).catch(function () { return false; });
    },
    /* List every video or song on the phone. Read in pages of 1000 so big libraries never freeze the app.
       onProgress(done, total) is optional. Older app builds answer in one piece and still work. */
    scan: function (kind, onProgress) {
      var all = [];
      function map(i) {
        return { id: i.id, title: i.title, path: i.path, size: i.size, added: i.added || 0, duration: i.duration, artist: i.artist || '', album: i.album || '',
                 folder: (i.path || '').split('/').slice(-2, -1)[0] || '', url: url(i.path) };
      }
      function page(offset) {
        return P.scan({ kind: kind, offset: offset, limit: 1000 }).then(function (r) {
          (r.items || []).forEach(function (i) { all.push(map(i)); });
          if (onProgress) { try { onProgress(all.length, r.total || all.length); } catch (e) { /* ignore */ } }
          var next = typeof r.next === 'number' ? r.next : 0;
          if (r.items && r.items.length && next && next < (r.total || 0) && all.length < 60000) {
            return new Promise(function (res) { setTimeout(res, 0); }).then(function () { return page(next); });
          }
          return all;
        });
      }
      return page(0);
    },
    /* Android back button. Once a listener is set the app fully controls what Back does. */
    onBack: function (cb) { if (A && A.addListener) A.addListener('backButton', cb); },
    minimize: function () { if (A && A.minimizeApp) { A.minimizeApp(); return true; } return false; },
    exit: function () { if (A && A.exitApp) A.exitApp(); },
    /* save a file the phone can see (Downloads, Pictures, ...). Used for every "download" button inside the tools. */
    hasSave: native && !!P,
    saveStart: function (name, mime) { return P.saveStart({ name: name, mime: mime }); },
    saveChunk: function (id, data) { return P.saveChunk({ id: id, data: data }); },
    saveFinish: function (id) { return P.saveFinish({ id: id }); },
    saveAbort: function (id) { return P.saveAbort({ id: id }); },
    appInfo: function () { return A && A.getInfo ? A.getInfo() : Promise.resolve(null); },
    onResume: function (cb) { if (A && A.addListener) A.addListener('resume', cb); },
    /* keep music / video playing when the screen is left or the phone is locked */
    clearLogs: function () { return P && P.clearLogs ? P.clearLogs() : Promise.resolve(); },
    getLogs: function () { return P && P.getLogs ? P.getLogs() : Promise.resolve(null); },
    cacheAudio: function (key, data, first) { return P.cacheAudio({ key: key, data: data, first: !!first }); },
    startNativeAudio: function (source,title,artist,position) { try { var b=location.origin+"/_capacitor_file_"; if(String(source).indexOf(b)===0) source="file://"+decodeURIComponent(String(source).slice(b.length).split("?")[0]); } catch(e){} return P.startNativeAudio({source:source,title:title||"HeyTools",artist:artist||"Now playing",position:Math.max(0,Math.round(position||0))}); },
    getNativeAudioState: function () { return P.getNativeAudioState ? P.getNativeAudioState() : Promise.resolve({ active: false }); },
    onNativeMediaAction: function (cb) { try { return P.addListener('mediaAction', cb); } catch (e) { return null; } },
    onNativeAudioEnded: function (cb) { try { return P.addListener('audioEnded', cb); } catch (e) { return null; } },
    controlNativeAudio: function (action, position) { return P.controlNativeAudio({action:action||"pause",position:position||0}); },
    startPlayback: function (title, artist, playing) { if (P && P.startPlayback) P.startPlayback({ title: title || 'HeyTools', artist: artist || 'Now playing', playing: playing !== false }).catch(function () {}); },
    updatePlayback: function (title, artist, playing) { if (P && P.updatePlayback) P.updatePlayback({ title: title || 'HeyTools', artist: artist || 'Now playing', playing: playing !== false }).catch(function () {}); },
    stopPlayback: function () { if (P && P.stopPlayback) P.stopPlayback().catch(function () {}); },
    /* open a link outside the app (used to download the new APK) */
    openUrl: function (url) {
      try { var B = C.registerPlugin('Browser'); B.open({ url: url }); } catch (e) { window.open(url, '_blank'); }
    }
  };
})();
