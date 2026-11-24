package app.dualui.core.data

import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.provider.AlarmClock
import android.provider.MediaStore
import android.provider.Settings

/** The jobs a phone's built-in apps do. Used to restyle their icons per interface and to pre-fill the home screen. */
enum class IconRole { PHONE, MESSAGES, CAMERA, GALLERY, CALCULATOR, CLOCK, CALENDAR, SETTINGS, BROWSER, MAPS, EMAIL, MUSIC }

class SystemRoles(context: Context) {
    private val pm = context.packageManager

    private fun intent(r: IconRole): Intent = when (r) {
        IconRole.PHONE -> Intent(Intent.ACTION_DIAL)
        IconRole.MESSAGES -> Intent.makeMainSelectorActivity(Intent.ACTION_MAIN, Intent.CATEGORY_APP_MESSAGING)
        IconRole.CAMERA -> Intent(MediaStore.INTENT_ACTION_STILL_IMAGE_CAMERA)
        IconRole.GALLERY -> Intent.makeMainSelectorActivity(Intent.ACTION_MAIN, Intent.CATEGORY_APP_GALLERY)
        IconRole.CALCULATOR -> Intent.makeMainSelectorActivity(Intent.ACTION_MAIN, Intent.CATEGORY_APP_CALCULATOR)
        IconRole.CLOCK -> Intent(AlarmClock.ACTION_SHOW_ALARMS)
        IconRole.CALENDAR -> Intent.makeMainSelectorActivity(Intent.ACTION_MAIN, Intent.CATEGORY_APP_CALENDAR)
        IconRole.SETTINGS -> Intent(Settings.ACTION_SETTINGS)
        IconRole.BROWSER -> Intent.makeMainSelectorActivity(Intent.ACTION_MAIN, Intent.CATEGORY_APP_BROWSER)
        IconRole.MAPS -> Intent.makeMainSelectorActivity(Intent.ACTION_MAIN, Intent.CATEGORY_APP_MAPS)
        IconRole.EMAIL -> Intent.makeMainSelectorActivity(Intent.ACTION_MAIN, Intent.CATEGORY_APP_EMAIL)
        IconRole.MUSIC -> Intent.makeMainSelectorActivity(Intent.ACTION_MAIN, Intent.CATEGORY_APP_MUSIC)
    }

    /** Packages able to do [role] (the user's default first). Never contains the system "chooser" package. */
    val packagesByRole: Map<IconRole, List<String>> = IconRole.entries.associateWith { r ->
        val i = intent(r)
        val all = try { pm.queryIntentActivities(i, PackageManager.MATCH_DEFAULT_ONLY or PackageManager.MATCH_ALL) } catch (_: Exception) { emptyList() }
        val default = try { pm.resolveActivity(i, PackageManager.MATCH_DEFAULT_ONLY)?.activityInfo?.packageName } catch (_: Exception) { null }
        (listOfNotNull(default) + all.map { it.activityInfo.packageName }).filter { it != "android" }.distinct()
    }

    private fun isSystem(pkg: String): Boolean = try {
        val f = pm.getApplicationInfo(pkg, 0).flags
        f and (ApplicationInfo.FLAG_SYSTEM or ApplicationInfo.FLAG_UPDATED_SYSTEM_APP) != 0
    } catch (_: Exception) { false }

    /** Only built-in (system) apps are restyled, so third-party apps always keep their own icon. */
    val roleByPackage: Map<String, IconRole> = buildMap {
        for (r in IconRole.entries) for (p in packagesByRole[r].orEmpty()) if (p !in this && isSystem(p)) put(p, r)
    }
}
