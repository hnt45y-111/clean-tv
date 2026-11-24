package app.dualui.notifications

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/** A single, already-flattened notification as shown by the launcher's own notification UI. */
data class NotifItem(
    val key: String,
    val pkg: String,
    val appLabel: String,
    val title: String,
    val text: String,
    val time: Long,
    val clearable: Boolean,
    val contentIntent: PendingIntent?,
)

data class NotifGroup(val pkg: String, val appLabel: String, val items: List<NotifItem>)

/**
 * Process-wide holder fed by [LauncherNotificationListener]. The listener only runs after the user
 * granted notification access; until then [connected] is false and the list is empty.
 */
object NotificationStore {
    private val _items = MutableStateFlow<List<NotifItem>>(emptyList())
    val items: StateFlow<List<NotifItem>> = _items.asStateFlow()

    private val _connected = MutableStateFlow(false)
    val connected: StateFlow<Boolean> = _connected.asStateFlow()

    internal var service: LauncherNotificationListener? = null

    internal fun publish(list: List<NotifItem>) { _items.value = list }
    internal fun setConnected(value: Boolean) {
        _connected.value = value
        if (!value) _items.value = emptyList()
    }

    fun groups(list: List<NotifItem>): List<NotifGroup> =
        list.groupBy { it.pkg }
            .map { (pkg, items) -> NotifGroup(pkg, items.first().appLabel, items.sortedByDescending { it.time }) }
            .sortedByDescending { g -> g.items.first().time }

    /** Dismisses one notification. Android only allows this for clearable (non-ongoing) notifications. */
    fun dismiss(item: NotifItem): Boolean {
        val s = service ?: return false
        if (!item.clearable) return false
        s.cancelNotification(item.key)
        return true
    }

    fun dismissAll() { service?.cancelAllNotifications() }

    /** Opens the originating app: fires the notification's own content intent, else the app's launch intent. */
    fun open(context: Context, item: NotifItem) {
        val pi = item.contentIntent
        val ok = try { pi?.send(); pi != null } catch (_: PendingIntent.CanceledException) { false }
        if (!ok) {
            context.packageManager.getLaunchIntentForPackage(item.pkg)?.let {
                it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                context.startActivity(it)
            }
        }
        if (ok && item.clearable) dismiss(item)
    }
}

object NotificationAccess {
    fun isEnabled(context: Context): Boolean =
        NotificationManagerCompat.getEnabledListenerPackages(context).contains(context.packageName)

    fun settingsIntent(): Intent =
        Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
}
