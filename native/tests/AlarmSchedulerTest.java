package com.heytools.app;

import android.content.Context;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class AlarmSchedulerTest {
  private Context context;
  private static final int ID = 17654321;

  @Before public void setUp() throws Exception {
    context=InstrumentationRegistry.getInstrumentation().getTargetContext();
    context.getSharedPreferences("heytools_native_alarms",Context.MODE_PRIVATE).edit().clear().commit();
    assertTrue("Test device must grant exact-alarm access",AlarmScheduler.canScheduleExact(context));
  }
  @After public void tearDown() throws Exception {
    JSONArray ids=new JSONArray();ids.put(ID);AlarmScheduler.cancelIds(context,ids);
    context.getSharedPreferences("heytools_native_alarms",Context.MODE_PRIVATE).edit().clear().commit();
  }

  private JSONObject oneTime() throws Exception {
    JSONObject a=new JSONObject();a.put("id",ID);a.put("title","Test alarm");a.put("label","Test alarm");
    a.put("time","07:00");a.put("days",new JSONArray());a.put("at",System.currentTimeMillis()+300000L);
    a.put("on",true);a.put("tone","classic");a.put("snooze",5);return a;
  }

  @Test public void exactAlarmIsPersistedAndCanBeCancelled() throws Exception {
    JSONArray list=new JSONArray();list.put(oneTime());AlarmScheduler.sync(context,list);
    JSONObject state=AlarmScheduler.getState(context);
    assertTrue(state.optBoolean("exactPermission"));
    JSONArray saved=state.optJSONArray("alarms");assertNotNull(saved);assertEquals(1,saved.length());
    assertTrue(saved.getJSONObject(0).optLong("nextAt")>System.currentTimeMillis());
    JSONArray ids=new JSONArray();ids.put(ID);AlarmScheduler.cancelIds(context,ids);
    assertEquals(0,AlarmScheduler.getState(context).optJSONArray("alarms").length());
  }

  @Test public void snoozedOneTimeAlarmCanRingAfterItsFirstOccurrence() throws Exception {
    JSONArray list=new JSONArray();list.put(oneTime());AlarmScheduler.sync(context,list);
    JSONObject first=AlarmScheduler.fired(context,ID);
    assertNotNull(first);assertFalse(first.optBoolean("on"));
    AlarmScheduler.snooze(context,ID,1);
    JSONObject state=AlarmScheduler.getState(context);
    assertTrue(state.optJSONArray("alarms").getJSONObject(0).optBoolean("snoozed"));

    android.content.SharedPreferences prefs=context.getSharedPreferences("heytools_native_alarms",Context.MODE_PRIVATE);
    JSONArray stored=new JSONArray(prefs.getString("alarms","[]"));
    stored.getJSONObject(0).put("snoozeAt",System.currentTimeMillis()-1000L);
    prefs.edit().putString("alarms",stored.toString()).commit();
    JSONObject second=AlarmScheduler.fired(context,ID);
    assertNotNull("Snooze must still fire when the one-time alarm is already disabled",second);
    assertFalse(second.optBoolean("on"));
    assertFalse(second.optBoolean("snoozed"));
  }

  @Test public void repeatingAlarmIsScheduledAgainAfterFiring() throws Exception {
    JSONObject a=oneTime();a.put("days",new JSONArray().put(0).put(1).put(2).put(3).put(4).put(5).put(6));
    a.put("time","07:30");
    JSONArray list=new JSONArray();list.put(a);AlarmScheduler.sync(context,list);
    JSONObject before=AlarmScheduler.getState(context).optJSONArray("alarms").getJSONObject(0);
    assertTrue(before.optLong("nextAt")>System.currentTimeMillis());
    assertNotNull(AlarmScheduler.fired(context,ID));
    JSONObject after=AlarmScheduler.getState(context).optJSONArray("alarms").getJSONObject(0);
    assertTrue(after.optBoolean("on"));
    assertTrue(after.optLong("nextAt")>System.currentTimeMillis());
  }
}
