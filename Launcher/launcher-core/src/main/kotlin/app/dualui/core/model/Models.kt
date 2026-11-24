package app.dualui.core.model

import android.os.UserHandle
import androidx.room.Entity
import androidx.room.PrimaryKey

/** An installed, launchable activity discovered through [android.content.pm.LauncherApps]. */
data class AppInfo(
    val packageName: String,
    val activity: String,
    val label: String,
    val user: UserHandle,
) {
    val key: String get() = "$packageName/$activity"
}

object ItemKind { const val APP = 0; const val FOLDER = 1; const val WIDGET = 2 }
object Container { const val HOME = 0; const val DOCK = 1; const val FOLDER = 2 }

/** One persisted element of the home layout. Shared by every interface so switching skins keeps everything. */
@Entity(tableName = "home_items")
data class HomeItem(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val kind: Int,
    val container: Int,
    /** Folder id when [container] == [Container.FOLDER], else -1. */
    val parent: Long = -1,
    val page: Int = 0,
    val x: Int = 0,
    val y: Int = 0,
    val spanX: Int = 1,
    val spanY: Int = 1,
    val pkg: String = "",
    val cls: String = "",
    val title: String = "",
    val widgetId: Int = -1,
) {
    val appKey: String get() = "$pkg/$cls"
}

enum class ThemeMode { SYSTEM, LIGHT, DARK }

data class LauncherPrefs(
    val skinId: String? = null,
    val setupDone: Boolean = false,
    val seeded: Boolean = false,
    val cols: Int = 4,
    val rows: Int = 6,
    val dockCount: Int = 4,
    val iconScale: Float = 1f,
    val showLabels: Boolean = true,
    val themedIcons: Boolean = false,
    val themeMode: ThemeMode = ThemeMode.SYSTEM,
    /** "" = same as the active interface, else "samsung" | "pixel" | "system" (the device's own shade + status bar). */
    val panelStyle: String = "",
    /** Restyle the device's system apps (phone, messages, camera...) with the interface's own icon set. */
    val systemIcons: Boolean = true,
) {
    fun effectivePanel(): String = panelStyle.ifEmpty { skinId ?: "system" }
}
