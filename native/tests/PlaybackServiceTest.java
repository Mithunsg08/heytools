package com.heytools.app;
import android.content.Context;import android.content.Intent;import android.net.Uri;import androidx.test.ext.junit.runners.AndroidJUnit4;import androidx.test.platform.app.InstrumentationRegistry;import org.junit.Test;import org.junit.runner.RunWith;import java.io.File;import java.io.FileOutputStream;import static org.junit.Assert.*;
@RunWith(AndroidJUnit4.class) public class PlaybackServiceTest {
 private Context c;
 private File wave()throws Exception{int rate=16000,n=rate*12;File f=new File(c.getCacheDir(),"heytools-test.wav");try(FileOutputStream o=new FileOutputStream(f)){ascii(o,"RIFF");i(o,36+n*2);ascii(o,"WAVE");ascii(o,"fmt ");i(o,16);s(o,1);s(o,1);i(o,rate);i(o,rate*2);s(o,2);s(o,16);ascii(o,"data");i(o,n*2);for(int x=0;x<n;x++)s(o,(int)(5000*Math.sin(2*Math.PI*440*x/rate)));}return f;}
 private void ascii(FileOutputStream o,String v)throws Exception{o.write(v.getBytes("US-ASCII"));}private void i(FileOutputStream o,int v)throws Exception{o.write(v&255);o.write(v>>8&255);o.write(v>>16&255);o.write(v>>24&255);}private void s(FileOutputStream o,int v)throws Exception{o.write(v&255);o.write(v>>8&255);}
 private void waitState(boolean state)throws Exception{long end=System.currentTimeMillis()+8000;while(System.currentTimeMillis()<end&&PlaybackService.audioIsPlaying!=state)Thread.sleep(100);assertEquals(state,PlaybackService.audioIsPlaying);}
 private void action(String a){c.startService(new Intent(c,PlaybackService.class).setAction(a));}
 @Test public void audioPlaysPausesResumesAndContinuesWhenScreenOff()throws Exception{
 c=InstrumentationRegistry.getInstrumentation().getTargetContext();File f=wave();Intent p=new Intent(c,PlaybackService.class).setAction("com.heytools.PLAY_URL").putExtra("source",Uri.fromFile(f).toString()).putExtra("title","Test audio");c.startForegroundService(p);waitState(true);
 action("com.heytools.PAUSE_URL");waitState(false);action("com.heytools.RESUME_URL");waitState(true);
 try{android.os.ParcelFileDescriptor d=InstrumentationRegistry.getInstrumentation().getUiAutomation().executeShellCommand("input keyevent 26");d.close();Thread.sleep(2500);assertTrue("Audio stopped after display off",PlaybackService.audioIsPlaying);}
 finally{android.os.ParcelFileDescriptor d=InstrumentationRegistry.getInstrumentation().getUiAutomation().executeShellCommand("input keyevent 26");d.close();}
 action("com.heytools.STOP_URL");long end=System.currentTimeMillis()+5000;while(System.currentTimeMillis()<end&&PlaybackService.audioIsPlaying)Thread.sleep(100);assertFalse(PlaybackService.audioIsPlaying);
 }
}