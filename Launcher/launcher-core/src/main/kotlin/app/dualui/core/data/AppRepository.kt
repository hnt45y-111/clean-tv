package app.dualui.core.data

import android.content.ComponentName
import android.content.Context
import android.content.pm.LauncherApps
import android.os.Process
import android.os.UserHandle
import app.dualui.core.model.AppInfo
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.text.Collator
import java.util.Locale

/**
 * Discovers launchable apps through [LauncherApps] (the official launcher API: no QUERY_ALL_APPS needed,
 * works across work profiles, and delivers install/uninstall callbacks).
 */
class AppRepository private constructor(context: Context) {
    private val ctx = context.applicationContext
    private val launcherApps = ctx.getSystemService(Context.LAUNCHER_APPS_SERVICE) as LauncherApps
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val collator = Collator.getInstance(Locale("ar")).apply { strength = Collator.PRIMARY }

    private val _apps = MutableStateFlow<List<AppInfo>>(emptyList())
    val apps: StateFlow<List<AppInfo>> = _apps.asStateFlow()

    /** True after the first full scan, so "app disappeared" cleanups never run against an empty cold list. */
    private val _loaded = MutableStateFlow(false)
    val loaded: StateFlow<Boolean> = _loaded.asStateFlow()

    private val callback = object : LauncherApps.Callback() {
        override fun onPackageRemoved(packageName: String, user: UserHandle) = reload()
        override fun onPackageAdded(packageName: String, user: UserHandle) = reload()
        override fun onPackageChanged(packageName: String, user: UserHandle) = reload()
        override fun onPackagesAvailable(packageNames: Array<out String>, user: UserHandle, replacing: Boolean) = reload()
        override fun onPackagesUnavailable(packageNames: Array<out String>, user: UserHandle, replacing: Boolean) = reload()
    }

    init {
        launcherApps.registerCallback(callback)
        reload()
    }

    fun reload() {
        scope.launch {
            val list = launcherApps.profiles.flatMap { user ->
                launcherApps.getActivityList(null, user).map {
                    AppInfo(it.componentName.packageName, it.componentName.className, it.label.toString(), user)
                }
            }.filter { it.packageName != ctx.packageName }
                .sortedWith { a, b -> collator.compare(a.label, b.label) }
            _apps.value = list
            _loaded.value = true
        }
    }

    fun find(pkg: String, cls: String): AppInfo? = _apps.value.firstOrNull { it.packageName == pkg && it.activity == cls }
    fun findByPackage(pkg: String): AppInfo? = _apps.value.firstOrNull { it.packageName == pkg }

    /** Raw drawable for icon rendering. */
    fun iconDrawable(app: AppInfo, densityDpi: Int = 0) =
        launcherApps.getActivityList(app.packageName, app.user)
            .firstOrNull { it.componentName.className == app.activity }
            ?.getIcon(densityDpi)

    fun launcherApps(): LauncherApps = launcherApps
    fun component(app: AppInfo) = ComponentName(app.packageName, app.activity)
    fun isInstalled(pkg: String) = _apps.value.any { it.packageName == pkg }
    val myUser: UserHandle get() = Process.myUserHandle()

    companion object {
        @Volatile private var instance: AppRepository? = null
        fun get(context: Context): AppRepository = instance ?: synchronized(this) {
            instance ?: AppRepository(context).also { instance = it }
        }
    }
}
