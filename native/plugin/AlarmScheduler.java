package com.heytools.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.Calendar;

final class AlarmScheduler {
  private static final String PREFS = "heytools_native_alarms";
  private static final String KEY = "alarms";
  private AlarmScheduler() {}

  static boolean canScheduleExact(Context c) {
    AlarmManager am = (AlarmManager)c.getSystemService(Context.ALARM_SERVICE);
    return Build.VERSION.SDK_INT < 31 || (am != null && am.canScheduleExactAlarms());
  }

  private static JSONArray read(Context c) {
    try { return new JSONArray(c.getSharedPreferences(PREFS, 0).getString(KEY, "[]")); }
    catch (Exception e) { return new JSONArray(); }
  }
  private static void write(Context c, JSONArray a) {
    c.getSharedPreferences(PREFS, 0).edit().putString(KEY, a.toString()).commit();
  }
  private static int indexOf(JSONArray a, int id) {
    for (int i=0;i<a.length();i++) if (a.optJSONObject(i)!=null && a.optJSONObject(i).optInt("id",-1)==id) return i;
    return -1;
  }
  private static Uri alarmUri(int id) { return Uri.parse("heytools://alarm/" + id); }
  private static PendingIntent operation(Context c, int id) {
    Intent i = new Intent(c, AlarmReceiver.class).setAction("com.heytools.ALARM_FIRE").setData(alarmUri(id));
    return PendingIntent.getBroadcast(c, id, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
  }
  static void cancelId(Context c, int id) {
    AlarmManager am = (AlarmManager)c.getSystemService(Context.ALARM_SERVICE);
    if (am != null) am.cancel(operation(c,id));
  }
  static void cancelIds(Context c, JSONArray ids) {
    JSONArray all = read(c);
    for(int i=0;i<ids.length();i++) {
      int id=ids.optInt(i,-1); if(id>=0) cancelId(c,id);
      int ix=indexOf(all,id); if(ix>=0) all.remove(ix);
    }
    write(c,all);
  }
  static void sync(Context c, JSONArray incoming) throws Exception {
    if (!canScheduleExact(c)) throw new SecurityException("Exact alarm access is disabled");
    JSONArray old=read(c);
    for(int i=0;i<old.length();i++){JSONObject o=old.optJSONObject(i);if(o!=null)cancelId(c,o.optInt("id",-1));}
    JSONArray clean=new JSONArray();
    for(int i=0;i<incoming.length();i++){
      JSONObject o=incoming.optJSONObject(i); if(o==null)continue;
      JSONObject n=new JSONObject(o.toString());
      if(n.optInt("id",-1)<0)continue;
      int previousIndex=indexOf(old,n.optInt("id",-1));
      JSONObject previous=previousIndex>=0?old.optJSONObject(previousIndex):null;
      if(previous!=null){
        long snoozeAt=previous.optLong("snoozeAt",0L);
        if(snoozeAt>System.currentTimeMillis()){n.put("snoozeAt",snoozeAt);n.put("snoozed",true);}
        n.put("lastFiredAt",previous.optLong("lastFiredAt",0L));
      } else { n.put("snoozeAt",0L); n.put("snoozed",false); n.put("lastFiredAt",0L); }
      clean.put(n);
    }
    write(c,clean);
    scheduleAll(c);
  }
  static void scheduleAll(Context c) {
    if (!canScheduleExact(c)) return;
    JSONArray all=read(c);
    for(int i=0;i<all.length();i++){
      JSONObject a=all.optJSONObject(i); if(a!=null) scheduleOne(c,a);
    }
    write(c,all);
  }
  private static long nextTime(JSONObject a) {
    long snooze=a.optLong("snoozeAt",0L);
    if(snooze>System.currentTimeMillis())return snooze;
    if(!a.optBoolean("on",false))return 0L;
    JSONArray days=a.optJSONArray("days");
    if(days==null||days.length()==0)return a.optLong("at",0L);
    String[] hm=a.optString("time","07:00").split(":");
    int hour=7,minute=0;
    try{hour=Integer.parseInt(hm[0]);if(hm.length>1)minute=Integer.parseInt(hm[1]);}catch(Exception ignored){}
    long best=Long.MAX_VALUE,now=System.currentTimeMillis();
    for(int i=0;i<days.length();i++){
      int wanted=days.optInt(i,-1);
      if(wanted<0||wanted>6)continue;
      Calendar d=Calendar.getInstance();d.set(Calendar.HOUR_OF_DAY,hour);d.set(Calendar.MINUTE,minute);d.set(Calendar.SECOND,0);d.set(Calendar.MILLISECOND,0);
      int diff=(wanted-d.get(Calendar.DAY_OF_WEEK)+1+7)%7;
      d.add(Calendar.DAY_OF_YEAR,diff);
      if(d.getTimeInMillis()<=now)d.add(Calendar.DAY_OF_YEAR,7);
      best=Math.min(best,d.getTimeInMillis());
    }
    return best==Long.MAX_VALUE?0L:best;
  }
  private static void scheduleOne(Context c, JSONObject a) {
    int id=a.optInt("id",-1); if(id<0)return;
    long at=nextTime(a); if(at<=System.currentTimeMillis())return;
    AlarmManager am=(AlarmManager)c.getSystemService(Context.ALARM_SERVICE);
    if(am==null)return;
    Intent open=new Intent(c,MainActivity.class).setAction("com.heytools.ALARM_OPEN").setData(alarmUri(id));
    PendingIntent show=PendingIntent.getActivity(c,id,open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    am.setAlarmClock(new AlarmManager.AlarmClockInfo(at,show),operation(c,id));
    try{a.put("nextAt",at);}catch(Exception ignored){}
  }
  static JSONObject fired(Context c,int id) {
    JSONArray all=read(c);int ix=indexOf(all,id);if(ix<0)return null;
    JSONObject a=all.optJSONObject(ix);if(a==null)return null;
    long snooze=a.optLong("snoozeAt",0L);
    if(!a.optBoolean("on",false)&&snooze<=System.currentTimeMillis())return null;
    try{
      a.put("lastFiredAt",System.currentTimeMillis());
      if(snooze>0){a.put("snoozeAt",0L);a.put("snoozed",false);}
      JSONArray days=a.optJSONArray("days");
      if(days==null||days.length()==0){a.put("on",false);a.put("nextAt",0L);}
      else {a.put("nextAt",0L);}
      write(c,all);
    }catch(Exception ignored){}
    if(a.optBoolean("on",false))scheduleOne(c,a);
    write(c,all);
    return a;
  }
  static void snooze(Context c,int id,int minutes) {
    JSONArray all=read(c);int ix=indexOf(all,id);if(ix<0)return;
    JSONObject a=all.optJSONObject(ix);if(a==null)return;
    try{a.put("snoozeAt",System.currentTimeMillis()+minutes*60000L);a.put("snoozed",true);write(c,all);scheduleOne(c,a);write(c,all);}
    catch(Exception e){throw new IllegalStateException(e);}
  }
  static void reschedule(Context c) { scheduleAll(c); }
  static JSONObject getState(Context c) {
    JSONObject out=new JSONObject();JSONArray state=new JSONArray(),all=read(c);
    for(int i=0;i<all.length();i++){JSONObject a=all.optJSONObject(i);if(a==null)continue;
      JSONObject x=new JSONObject();try{x.put("id",a.optInt("id"));x.put("on",a.optBoolean("on"));x.put("nextAt",a.optLong("nextAt"));x.put("snoozed",a.optBoolean("snoozed"));x.put("lastFiredAt",a.optLong("lastFiredAt"));state.put(x);}catch(Exception ignored){}
    }
    try{out.put("alarms",state);out.put("exactPermission",canScheduleExact(c));}catch(Exception ignored){}
    return out;
  }
}
