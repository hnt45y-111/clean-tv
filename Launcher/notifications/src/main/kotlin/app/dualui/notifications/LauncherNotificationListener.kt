package app.dualui.notifications

import android.app.Notification
import android.content.pm.PackageManager
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

class LauncherNotificationListener : NotificationListenerService() {

    override fun onListenerConnected() {
        NotificationStore.service = this
        NotificationStore.setConnected(true)
        refresh()
    }

    override fun onListenerDisconnected() {
        NotificationStore.service = null
        NotificationStore.setConnected(false)
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) = refresh()
    override fun onNotificationRemoved(sbn: StatusBarNotification?) = refresh()

    private fun refresh() {
        val active = try { activeNotifications } catch (_: SecurityException) { null } ?: return
        val pm = packageManager
        val labels = HashMap<String, String>()
        val list = active.asSequence()
            .filter { it.packageName != packageName }
            .filter { it.notification.flags and Notification.FLAG_GROUP_SUMMARY == 0 }
            .map { sbn ->
                val n = sbn.notification
                val extras = n.extras
                val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
                val text = (extras.getCharSequence(Notification.EXTRA_BIG_TEXT)
                    ?: extras.getCharSequence(Notification.EXTRA_TEXT))?.toString().orEmpty()
                val label = labels.getOrPut(sbn.packageName) {
                    try { pm.getApplicationLabel(pm.getApplicationInfo(sbn.packageName, 0)).toString() }
                    catch (_: PackageManager.NameNotFoundException) { sbn.packageName }
                }
                NotifItem(
                    key = sbn.key, pkg = sbn.packageName, appLabel = label, title = title, text = text,
                    time = sbn.postTime, clearable = sbn.isClearable, contentIntent = n.contentIntent,
                )
            }
            .filter { it.title.isNotBlank() || it.text.isNotBlank() }
            .toList()
        NotificationStore.publish(list)
    }
}
