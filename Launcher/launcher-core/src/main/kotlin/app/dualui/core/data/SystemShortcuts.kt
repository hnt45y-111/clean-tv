package app.dualui.core.data

import android.content.Context
import android.content.Intent
import android.provider.AlarmClock
import android.provider.MediaStore
import android.provider.Settings
import android.widget.Toast
import androidx.annotation.StringRes
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.ui.graphics.vector.ImageVector
import app.dualui.core.R

/**
 * The "system apps" area. Nothing here pretends to be a real app: each entry only resolves and opens the
 * actual app the device already has for that role (or reports that none is installed).
 */
enum class SystemApp(@StringRes val label: Int, val icon: ImageVector) {
    CALCULATOR(R.string.sys_calculator, Icons.Rounded.Calculate),
    CLOCK(R.string.sys_clock, Icons.Rounded.Schedule),
    CALENDAR(R.string.sys_calendar, Icons.Rounded.CalendarMonth),
    SETTINGS(R.string.sys_settings, Icons.Rounded.Settings),
    PHONE(R.string.sys_phone, Icons.Rounded.Call),
    MESSAGES(R.string.sys_messages, Icons.Rounded.Sms),
    GALLERY(R.string.sys_gallery, Icons.Rounded.PhotoLibrary);

    fun intent(): Intent = when (this) {
        CALCULATOR -> Intent.makeMainSelectorActivity(Intent.ACTION_MAIN, Intent.CATEGORY_APP_CALCULATOR)
        CLOCK -> Intent(AlarmClock.ACTION_SHOW_ALARMS)
        CALENDAR -> Intent.makeMainSelectorActivity(Intent.ACTION_MAIN, Intent.CATEGORY_APP_CALENDAR)
        SETTINGS -> Intent(Settings.ACTION_SETTINGS)
        PHONE -> Intent(Intent.ACTION_DIAL)
        MESSAGES -> Intent.makeMainSelectorActivity(Intent.ACTION_MAIN, Intent.CATEGORY_APP_MESSAGING)
        GALLERY -> Intent.makeMainSelectorActivity(Intent.ACTION_MAIN, Intent.CATEGORY_APP_GALLERY)
    }.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)

    fun isAvailable(context: Context) = intent().resolveActivity(context.packageManager) != null

    fun open(context: Context) {
        try { context.startActivity(intent()) }
        catch (_: Exception) { Toast.makeText(context, R.string.app_unavailable, Toast.LENGTH_SHORT).show() }
    }

    companion object {
        /** Intents used to pre-fill a fresh home screen with the device's real default apps. */
        fun defaultDockIntents(): List<Intent> = listOf(
            Intent(Intent.ACTION_DIAL),
            Intent.makeMainSelectorActivity(Intent.ACTION_MAIN, Intent.CATEGORY_APP_MESSAGING),
            Intent.makeMainSelectorActivity(Intent.ACTION_MAIN, Intent.CATEGORY_APP_BROWSER),
            Intent(MediaStore.INTENT_ACTION_STILL_IMAGE_CAMERA),
        )
        fun defaultHomeIntents(): List<Intent> = listOf(
            Intent(Settings.ACTION_SETTINGS),
            Intent.makeMainSelectorActivity(Intent.ACTION_MAIN, Intent.CATEGORY_APP_GALLERY),
            Intent.makeMainSelectorActivity(Intent.ACTION_MAIN, Intent.CATEGORY_APP_CALCULATOR),
            Intent(AlarmClock.ACTION_SHOW_ALARMS),
            Intent.makeMainSelectorActivity(Intent.ACTION_MAIN, Intent.CATEGORY_APP_CALENDAR),
            Intent.makeMainSelectorActivity(Intent.ACTION_MAIN, Intent.CATEGORY_APP_MAPS),
            Intent.makeMainSelectorActivity(Intent.ACTION_MAIN, Intent.CATEGORY_APP_EMAIL),
            Intent.makeMainSelectorActivity(Intent.ACTION_MAIN, Intent.CATEGORY_APP_MUSIC),
        )
    }
}
