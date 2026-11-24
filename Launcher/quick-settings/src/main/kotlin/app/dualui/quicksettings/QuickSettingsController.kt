package app.dualui.quicksettings

import android.Manifest
import android.app.NotificationManager
import android.bluetooth.BluetoothManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.camera2.CameraManager
import android.location.LocationManager
import android.media.AudioManager
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.Uri
import android.net.wifi.WifiManager
import android.os.BatteryManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.provider.Settings
import android.database.ContentObserver
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.ui.graphics.vector.ImageVector
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

enum class QsId { WIFI, BLUETOOTH, MOBILE_DATA, AIRPLANE, FLASHLIGHT, ROTATION, DND, LOCATION, BATTERY_SAVER }

/** Where a tile's tap ends: a real in-app toggle, or the official system panel (Android forbids direct control). */
enum class QsMode { DIRECT, SYSTEM_PANEL, NEEDS_PERMISSION }

data class QsTile(
    val id: QsId,
    val label: String,
    val icon: ImageVector,
    val active: Boolean,
    val subtitle: String,
    val mode: QsMode,
)

data class QsSnapshot(
    val wifi: Boolean = false,
    val bluetooth: Boolean = false,
    val mobileData: Boolean = false,
    val airplane: Boolean = false,
    val torch: Boolean = false,
    val hasTorch: Boolean = false,
    val autoRotate: Boolean = false,
    val dnd: Boolean = false,
    val location: Boolean = false,
    val batterySaver: Boolean = false,
    val brightness: Float = 0.5f,
    val volume: Float = 0.5f,
    val batteryPercent: Int = 0,
    val charging: Boolean = false,
    val canWriteSettings: Boolean = false,
    val hasPolicyAccess: Boolean = false,
)

/**
 * Real, official-API quick settings. What a third-party app may NOT do (toggle Wi-Fi, Bluetooth, mobile data,
 * airplane mode, location, battery saver on Android 10+) is routed to the corresponding system panel instead of being faked.
 */
class QuickSettingsController(context: Context) {
    private val app = context.applicationContext
    private val main = Handler(Looper.getMainLooper())

    private val _state = MutableStateFlow(QsSnapshot())
    val state: StateFlow<QsSnapshot> = _state.asStateFlow()

    private val camera = app.getSystemService(Context.CAMERA_SERVICE) as CameraManager
    private val audio = app.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    private val cm = app.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    private var torchCamera: String? = camera.cameraIdList.firstOrNull {
        camera.getCameraCharacteristics(it).get(android.hardware.camera2.CameraCharacteristics.FLASH_INFO_AVAILABLE) == true
    }
    private var torchOn = false
    private var started = false

    private val receiver = object : BroadcastReceiver() {
        override fun onReceive(c: Context?, i: Intent?) = refresh()
    }
    private val observer = object : ContentObserver(main) {
        override fun onChange(selfChange: Boolean) = refresh()
    }
    private val netCallback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) = refresh()
        override fun onLost(network: Network) = refresh()
        override fun onCapabilitiesChanged(network: Network, c: NetworkCapabilities) = refresh()
    }
    private val torchCallback = object : CameraManager.TorchCallback() {
        override fun onTorchModeChanged(id: String, enabled: Boolean) {
            if (id == torchCamera) { torchOn = enabled; refresh() }
        }
    }

    fun start() {
        if (started) return
        started = true
        val f = IntentFilter().apply {
            addAction(WifiManager.WIFI_STATE_CHANGED_ACTION)
            addAction("android.bluetooth.adapter.action.STATE_CHANGED")
            addAction(Intent.ACTION_AIRPLANE_MODE_CHANGED)
            addAction(NotificationManager.ACTION_INTERRUPTION_FILTER_CHANGED)
            addAction(LocationManager.MODE_CHANGED_ACTION)
            addAction(PowerManager.ACTION_POWER_SAVE_MODE_CHANGED)
            addAction(Intent.ACTION_BATTERY_CHANGED)
            addAction("android.media.VOLUME_CHANGED_ACTION")
        }
        if (Build.VERSION.SDK_INT >= 33) app.registerReceiver(receiver, f, Context.RECEIVER_EXPORTED)
        else app.registerReceiver(receiver, f)
        app.contentResolver.registerContentObserver(Settings.System.CONTENT_URI, true, observer)
        try { cm.registerDefaultNetworkCallback(netCallback) } catch (_: Exception) {}
        try { camera.registerTorchCallback(torchCallback, main) } catch (_: Exception) {}
        refresh()
    }

    fun stop() {
        if (!started) return
        started = false
        try { app.unregisterReceiver(receiver) } catch (_: Exception) {}
        app.contentResolver.unregisterContentObserver(observer)
        try { cm.unregisterNetworkCallback(netCallback) } catch (_: Exception) {}
        try { camera.unregisterTorchCallback(torchCallback) } catch (_: Exception) {}
    }

    fun refresh() {
        val wifi = (app.getSystemService(Context.WIFI_SERVICE) as WifiManager).isWifiEnabled
        val bt = (app.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager).adapter?.isEnabled == true
        val caps = cm.getNetworkCapabilities(cm.activeNetwork)
        val cellular = caps?.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) == true
        val airplane = Settings.Global.getInt(app.contentResolver, Settings.Global.AIRPLANE_MODE_ON, 0) == 1
        val nm = app.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val dnd = nm.currentInterruptionFilter.let { it != NotificationManager.INTERRUPTION_FILTER_ALL && it != NotificationManager.INTERRUPTION_FILTER_UNKNOWN }
        val loc = (app.getSystemService(Context.LOCATION_SERVICE) as LocationManager).isLocationEnabled
        val pm = app.getSystemService(Context.POWER_SERVICE) as PowerManager
        val bat = app.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        val level = bat?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
        val scale = bat?.getIntExtra(BatteryManager.EXTRA_SCALE, 100) ?: 100
        val status = bat?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
        val brightness = Settings.System.getInt(app.contentResolver, Settings.System.SCREEN_BRIGHTNESS, 128) / 255f
        val maxVol = audio.getStreamMaxVolume(AudioManager.STREAM_MUSIC).coerceAtLeast(1)
        _state.value = QsSnapshot(
            wifi = wifi, bluetooth = bt, mobileData = cellular, airplane = airplane,
            torch = torchOn, hasTorch = torchCamera != null,
            autoRotate = Settings.System.getInt(app.contentResolver, Settings.System.ACCELEROMETER_ROTATION, 0) == 1,
            dnd = dnd, location = loc, batterySaver = pm.isPowerSaveMode,
            brightness = brightness.coerceIn(0f, 1f),
            volume = audio.getStreamVolume(AudioManager.STREAM_MUSIC) / maxVol.toFloat(),
            batteryPercent = if (level >= 0) level * 100 / scale else 0,
            charging = status == BatteryManager.BATTERY_STATUS_CHARGING || status == BatteryManager.BATTERY_STATUS_FULL,
            canWriteSettings = Settings.System.canWrite(app),
            hasPolicyAccess = nm.isNotificationPolicyAccessGranted,
        )
    }

    fun tiles(): List<QsTile> {
        val s = _state.value
        fun onOff(b: Boolean) = app.getString(if (b) R.string.qs_on else R.string.qs_off)
        val panel = app.getString(R.string.qs_opens_panel)
        val perm = app.getString(R.string.qs_needs_permission)
        return buildList {
            add(QsTile(QsId.WIFI, app.getString(R.string.qs_wifi), if (s.wifi) Icons.Rounded.Wifi else Icons.Rounded.WifiOff, s.wifi, onOff(s.wifi), QsMode.SYSTEM_PANEL))
            add(QsTile(QsId.BLUETOOTH, app.getString(R.string.qs_bluetooth), if (s.bluetooth) Icons.Rounded.Bluetooth else Icons.Rounded.BluetoothDisabled, s.bluetooth, onOff(s.bluetooth), QsMode.SYSTEM_PANEL))
            add(QsTile(QsId.MOBILE_DATA, app.getString(R.string.qs_mobile_data), Icons.Rounded.SignalCellularAlt, s.mobileData, if (s.mobileData) app.getString(R.string.qs_connected) else panel, QsMode.SYSTEM_PANEL))
            add(QsTile(QsId.AIRPLANE, app.getString(R.string.qs_airplane), Icons.Rounded.AirplanemodeActive, s.airplane, onOff(s.airplane), QsMode.SYSTEM_PANEL))
            add(QsTile(QsId.FLASHLIGHT, app.getString(R.string.qs_flashlight), if (s.torch) Icons.Rounded.FlashlightOn else Icons.Rounded.FlashlightOff, s.torch,
                if (s.hasTorch) onOff(s.torch) else app.getString(R.string.qs_no_torch), QsMode.DIRECT))
            add(QsTile(QsId.ROTATION, app.getString(R.string.qs_rotation), Icons.Rounded.ScreenRotation, s.autoRotate,
                if (s.canWriteSettings) onOff(s.autoRotate) else perm, if (s.canWriteSettings) QsMode.DIRECT else QsMode.NEEDS_PERMISSION))
            add(QsTile(QsId.DND, app.getString(R.string.qs_dnd), Icons.Rounded.DoNotDisturbOn, s.dnd,
                if (s.hasPolicyAccess) onOff(s.dnd) else perm, if (s.hasPolicyAccess) QsMode.DIRECT else QsMode.NEEDS_PERMISSION))
            add(QsTile(QsId.LOCATION, app.getString(R.string.qs_location), Icons.Rounded.LocationOn, s.location, onOff(s.location), QsMode.SYSTEM_PANEL))
            add(QsTile(QsId.BATTERY_SAVER, app.getString(R.string.qs_battery_saver), Icons.Rounded.BatterySaver, s.batterySaver, onOff(s.batterySaver), QsMode.SYSTEM_PANEL))
        }
    }

    /** Toggle (or open the right system screen). Returns the intent the UI must start, or null if handled in-process. */
    fun toggle(id: QsId): Intent? {
        val s = _state.value
        fun sys(a: String) = Intent(a).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        return when (id) {
            QsId.WIFI -> sys(Settings.Panel.ACTION_WIFI)
            QsId.BLUETOOTH -> sys(Settings.ACTION_BLUETOOTH_SETTINGS)
            QsId.MOBILE_DATA -> sys(Settings.Panel.ACTION_INTERNET_CONNECTIVITY)
            QsId.AIRPLANE -> sys(Settings.ACTION_AIRPLANE_MODE_SETTINGS)
            QsId.LOCATION -> sys(Settings.ACTION_LOCATION_SOURCE_SETTINGS)
            QsId.BATTERY_SAVER -> sys(Settings.ACTION_BATTERY_SAVER_SETTINGS)
            QsId.FLASHLIGHT -> {
                torchCamera?.let { try { camera.setTorchMode(it, !s.torch) } catch (_: Exception) {} }
                null
            }
            QsId.ROTATION -> if (!s.canWriteSettings) writeSettingsIntent() else {
                Settings.System.putInt(app.contentResolver, Settings.System.ACCELEROMETER_ROTATION, if (s.autoRotate) 0 else 1)
                refresh(); null
            }
            QsId.DND -> if (!s.hasPolicyAccess) sys(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS) else {
                val nm = app.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                nm.setInterruptionFilter(if (s.dnd) NotificationManager.INTERRUPTION_FILTER_ALL else NotificationManager.INTERRUPTION_FILTER_PRIORITY)
                null
            }
        }
    }

    fun writeSettingsIntent(): Intent =
        Intent(Settings.ACTION_MANAGE_WRITE_SETTINGS, Uri.parse("package:${app.packageName}")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)

    /** Returns false when the "Modify system settings" permission is missing (UI should then offer [writeSettingsIntent]). */
    fun setBrightness(fraction: Float): Boolean {
        if (!Settings.System.canWrite(app)) return false
        Settings.System.putInt(app.contentResolver, Settings.System.SCREEN_BRIGHTNESS_MODE, Settings.System.SCREEN_BRIGHTNESS_MODE_MANUAL)
        Settings.System.putInt(app.contentResolver, Settings.System.SCREEN_BRIGHTNESS, (fraction.coerceIn(0.02f, 1f) * 255).toInt())
        _state.value = _state.value.copy(brightness = fraction)
        return true
    }

    fun setVolume(fraction: Float) {
        val max = audio.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
        audio.setStreamVolume(AudioManager.STREAM_MUSIC, (fraction * max).toInt().coerceIn(0, max), 0)
        _state.value = _state.value.copy(volume = fraction)
    }

    /** Pulls down the REAL system shade (best effort; allowed by the normal EXPAND_STATUS_BAR permission). */
    fun expandSystemShade() {
        try {
            val sbs = app.getSystemService("statusbar")
            Class.forName("android.app.StatusBarManager").getMethod("expandNotificationsPanel").invoke(sbs)
        } catch (_: Throwable) {}
    }
}
