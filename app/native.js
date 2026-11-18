/* Bridge to the Android app (Capacitor). In a normal browser every call reports "not native" and the web fallbacks are used. */
(function () {
  var C = window.Capacitor;
  var native = !!(C && C.isNativePlatform && C.isNativePlatform());
  var P = null, A = null;
  if (native) {
    try { P = C.registerPlugin ? C.registerPlugin('MediaLibrary') : C.Plugins.MediaLibrary; } catch (e) { P = null; }
    try { A = C.registerPlugin ? C.registerPlugin('App') : C.Plugins.App; } catch (e) { A = null; }
  }
  function url(path) {
    return C.convertFileSrc('file://' + path.split('/').map(encodeURIComponent).join('/'));
  }
  window.HeyNative = {
    isNative: native,
    hasMedia: native && !!P,
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
        return { id: i.id, title: i.title, path: i.path, size: i.size, duration: i.duration, artist: i.artist || '', album: i.album || '',
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
    exit: function () { if (A && A.exitApp) A.exitApp(); },
    /* save a file the phone can see (Downloads, Pictures, ...). Used for every "download" button inside the tools. */
    hasSave: native && !!P,
    saveStart: function (name, mime) { return P.saveStart({ name: name, mime: mime }); },
    saveChunk: function (id, data) { return P.saveChunk({ id: id, data: data }); },
    saveFinish: function (id) { return P.saveFinish({ id: id }); },
    saveAbort: function (id) { return P.saveAbort({ id: id }); },
    onResume: function (cb) { if (A && A.addListener) A.addListener('resume', cb); },
    /* keep music / video playing when the screen is left or the phone is locked */
    startNativeAudio: function (source,title,artist) { return P.startNativeAudio({source:source,title:title||"HeyTools",artist:artist||"Now playing"}); },
    controlNativeAudio: function (action) { return P.controlNativeAudio({action:action||"pause"}); },
    startPlayback: function (title, artist, playing) { if (P && P.startPlayback) P.startPlayback({ title: title || 'HeyTools', artist: artist || 'Now playing', playing: playing !== false }).catch(function () {}); },
    updatePlayback: function (title, artist, playing) { if (P && P.updatePlayback) P.updatePlayback({ title: title || 'HeyTools', artist: artist || 'Now playing', playing: playing !== false }).catch(function () {}); },
    stopPlayback: function () { if (P && P.stopPlayback) P.stopPlayback().catch(function () {}); },
    /* open a link outside the app (used to download the new APK) */
    openUrl: function (url) {
      try { var B = C.registerPlugin('Browser'); B.open({ url: url }); } catch (e) { window.open(url, '_blank'); }
    }
  };
})();
