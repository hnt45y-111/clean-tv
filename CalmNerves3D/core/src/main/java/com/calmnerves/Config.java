package com.calmnerves;

/** Online tournament backend (Supabase REST). Leave empty to disable; the tournament screen then says so honestly instead of showing fake data. */
public class Config {
    public static final String SUPABASE_URL = "https://pegjfuculkrkwitihfqg.supabase.co";
    public static final String SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBlZ2pmdWN1bGtya3dpdGloZnFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQxNTQ4NjQsImV4cCI6MjEwOTczMDg2NH0.WTcnvgO6Nbjv6c5fXuEv68CId3IffzyQVPqDRTrPHDk";
    public static boolean online() { return !SUPABASE_URL.isEmpty() && !SUPABASE_KEY.isEmpty(); }
}
