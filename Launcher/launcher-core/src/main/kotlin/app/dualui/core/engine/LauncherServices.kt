package app.dualui.core.engine

import android.content.Context
import app.dualui.core.data.*
import app.dualui.core.widgets.WidgetController
import app.dualui.quicksettings.QuickSettingsController

/** Process-wide singletons shared by every interface (so switching skins never reloads or loses anything). */
class LauncherServices private constructor(context: Context) {
    val apps = AppRepository.get(context)
    val db = LauncherDb.get(context)
    val prefs = PrefsRepository(context)
    val icons = IconLoader(apps)
    val widgets = WidgetController(context)
    val wallpaper = WallpaperHelper(context)
    val quickSettings = QuickSettingsController(context)
    val roles by lazy { SystemRoles(context) }

    companion object {
        @Volatile private var instance: LauncherServices? = null
        fun get(context: Context): LauncherServices = instance ?: synchronized(this) {
            instance ?: LauncherServices(context.applicationContext).also { instance = it }
        }
    }
}
