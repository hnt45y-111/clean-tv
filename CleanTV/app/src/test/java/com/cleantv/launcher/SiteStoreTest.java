package com.cleantv.launcher;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import android.content.Context;

import androidx.test.core.app.ApplicationProvider;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;

/** The saved channels of «مواقع القنوات»: kept on the device, read back by the launcher page. Runs on the JVM, no emulator. */
@RunWith(RobolectricTestRunner.class)
@Config(sdk = 34)
public class SiteStoreTest {
    private Context c;

    @Before
    public void clear() {
        c = ApplicationProvider.getApplicationContext();
        Media.prefs(c).edit().remove("siteCh").commit();
    }

    private static JSONObject ch(String name, String url, String g) throws Exception {
        return new JSONObject().put("n", name).put("u", url).put("g", g).put("p", "").put("c", "my").put("r", "http://site/").put("ua", "UA");
    }

    @Test
    public void startsEmpty() {
        assertEquals(0, SiteActivity.load(c).length());
    }

    @Test
    public void savedChannelIsKeptWithEveryField() throws Exception {
        SiteActivity.save(c, ch("قناة", "http://x/a.m3u8", "sport"));
        JSONArray a = SiteActivity.load(c);
        assertEquals(1, a.length());
        JSONObject o = a.getJSONObject(0);
        assertEquals("قناة", o.getString("n"));
        assertEquals("http://x/a.m3u8", o.getString("u"));
        assertEquals("sport", o.getString("g"));
        assertEquals("http://site/", o.getString("r"));
        assertEquals("UA", o.getString("ua"));
    }

    @Test
    public void sameStreamIsReplacedNotDuplicated() throws Exception {
        SiteActivity.save(c, ch("اسم قديم", "http://x/a.m3u8", "news"));
        SiteActivity.save(c, ch("اسم جديد", "http://x/a.m3u8", "sport"));
        JSONArray a = SiteActivity.load(c);
        assertEquals(1, a.length());
        assertEquals("اسم جديد", a.getJSONObject(0).getString("n"));
        assertEquals("sport", a.getJSONObject(0).getString("g"));
    }

    @Test
    public void removeDeletesOnlyTheMatchingChannel() throws Exception {
        SiteActivity.save(c, ch("أ", "http://x/1.m3u8", "news"));
        SiteActivity.save(c, ch("ب", "http://x/2.m3u8", "sport"));
        SiteActivity.remove(c, "http://x/1.m3u8|أ");
        JSONArray a = SiteActivity.load(c);
        assertEquals(1, a.length());
        assertEquals("ب", a.getJSONObject(0).getString("n"));
        SiteActivity.remove(c, "http://x/2.m3u8|غلط");     // wrong name: nothing is removed
        assertEquals(1, SiteActivity.load(c).length());
    }

    @Test
    public void brokenStorageReadsAsEmpty() {
        Media.prefs(c).edit().putString("siteCh", "{not json").commit();
        assertTrue(SiteActivity.load(c).length() == 0);
        // and saving afterwards works again
        try { SiteActivity.save(c, ch("ج", "http://x/3.m3u8", "ent")); } catch (Exception e) { throw new AssertionError(e); }
        assertEquals(1, SiteActivity.load(c).length());
    }
}
