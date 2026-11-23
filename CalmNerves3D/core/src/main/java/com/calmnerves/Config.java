package com.calmnerves;

/** Online tournament backend (Supabase REST). Leave empty to disable; the tournament screen then says so honestly instead of showing fake data. */
public class Config {
    public static final String SUPABASE_URL = "";
    public static final String SUPABASE_KEY = "";
    public static boolean online() { return !SUPABASE_URL.isEmpty() && !SUPABASE_KEY.isEmpty(); }
}
