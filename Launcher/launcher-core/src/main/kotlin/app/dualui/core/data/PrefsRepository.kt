package app.dualui.core.data

import android.content.Context
import androidx.datastore.preferences.core.*
import androidx.datastore.preferences.preferencesDataStore
import app.dualui.core.model.LauncherPrefs
import app.dualui.core.model.ThemeMode
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.store by preferencesDataStore("launcher_prefs")

class PrefsRepository(context: Context) {
    private val store = context.applicationContext.store

    private object K {
        val skin = stringPreferencesKey("skin")
        val setup = booleanPreferencesKey("setup_done")
        val seeded = booleanPreferencesKey("seeded")
        val cols = intPreferencesKey("cols")
        val rows = intPreferencesKey("rows")
        val dock = intPreferencesKey("dock")
        val scale = floatPreferencesKey("icon_scale")
        val labels = booleanPreferencesKey("labels")
        val themed = booleanPreferencesKey("themed_icons")
        val theme = stringPreferencesKey("theme_mode")
    }

    val prefs: Flow<LauncherPrefs> = store.data.map { p ->
        LauncherPrefs(
            skinId = p[K.skin],
            setupDone = p[K.setup] ?: false,
            seeded = p[K.seeded] ?: false,
            cols = p[K.cols] ?: 4,
            rows = p[K.rows] ?: 6,
            dockCount = p[K.dock] ?: 4,
            iconScale = p[K.scale] ?: 1f,
            showLabels = p[K.labels] ?: true,
            themedIcons = p[K.themed] ?: false,
            themeMode = runCatching { ThemeMode.valueOf(p[K.theme] ?: "SYSTEM") }.getOrDefault(ThemeMode.SYSTEM),
        )
    }

    suspend fun setSkin(id: String) = store.edit { it[K.skin] = id }
    suspend fun setSetupDone() = store.edit { it[K.setup] = true }
    suspend fun setSeeded() = store.edit { it[K.seeded] = true }
    suspend fun setGrid(cols: Int, rows: Int) = store.edit { it[K.cols] = cols; it[K.rows] = rows }
    suspend fun setDock(count: Int) = store.edit { it[K.dock] = count }
    suspend fun setIconScale(v: Float) = store.edit { it[K.scale] = v }
    suspend fun setLabels(v: Boolean) = store.edit { it[K.labels] = v }
    suspend fun setThemedIcons(v: Boolean) = store.edit { it[K.themed] = v }
    suspend fun setThemeMode(m: ThemeMode) = store.edit { it[K.theme] = m.name }
}
