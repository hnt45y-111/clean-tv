package app.dualui.shared

import androidx.compose.foundation.Image
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.dualui.core.data.ArabicFormat
import app.dualui.core.engine.LauncherViewModel
import app.dualui.notifications.NotificationStore
import app.dualui.notifications.appBitmap

/**
 * Launcher-drawn status strip (only on the home screen, when the user picked a Samsung / Pixel notification style).
 * The real system status bar is hidden there; dragging this strip down opens the launcher panel.
 * Signal strength is not shown: Android only exposes it to apps holding phone-state permission, which we do not request.
 */
@OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
@Composable
fun LauncherStatusBar(vm: LauncherViewModel, ink: Color, font: FontFamily, textSp: Int, iconDp: Int, modifier: Modifier = Modifier) {
    val ctx = LocalContext.current
    val snap by vm.services.quickSettings.state.collectAsState()
    val notifs by NotificationStore.items.collectAsState()
    val now by rememberNow()
    val screenH = with(LocalDensity.current) { LocalConfiguration.current.screenHeightDp.dp.toPx() }
    val barH = WindowInsets.statusBarsIgnoringVisibility.asPaddingValues().calculateTopPadding().coerceAtLeast(24.dp)
    Row(
        modifier.fillMaxWidth().height(barH).padding(horizontal = 18.dp)
            .pointerInput(Unit) {
                var total = 0f
                detectVerticalDragGestures(
                    onDragStart = { total = 0f },
                    onDragEnd = { vm.panelRelease(total > screenH * 0.12f) },
                    onDragCancel = { vm.panelRelease(false) },
                ) { _, dy -> total += dy; vm.panelDrag((total / (screenH * 0.55f)).coerceAtLeast(0f)) }
            },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(ArabicFormat.time(now.toLocalTime()), color = ink, fontFamily = font, fontSize = textSp.sp, fontWeight = FontWeight.Medium)
        Spacer(Modifier.width(10.dp))
        notifs.distinctBy { it.pkg }.take(4).forEach { n ->
            appBitmap(ctx, n.pkg)?.let { Image(it.asImageBitmap(), null, Modifier.padding(end = 4.dp).size((iconDp - 2).dp).clip(CircleShape)) }
        }
        Spacer(Modifier.weight(1f))
        @Composable fun Ic(v: androidx.compose.ui.graphics.vector.ImageVector) =
            Icon(v, null, tint = ink, modifier = Modifier.padding(start = 6.dp).size(iconDp.dp))
        if (snap.dnd) Ic(Icons.Rounded.DoNotDisturbOn)
        if (snap.airplane) Ic(Icons.Rounded.AirplanemodeActive)
        if (snap.bluetooth) Ic(Icons.Rounded.Bluetooth)
        if (snap.wifi) Ic(Icons.Rounded.Wifi)
        if (snap.mobileData) Ic(Icons.Rounded.SignalCellularAlt)
        Ic(if (snap.charging) Icons.Rounded.BatteryChargingFull else Icons.Rounded.BatteryFull)
        Text(ArabicFormat.percent(snap.batteryPercent), color = ink, fontFamily = font, fontSize = (textSp - 2).sp, modifier = Modifier.padding(start = 3.dp))
    }
}
