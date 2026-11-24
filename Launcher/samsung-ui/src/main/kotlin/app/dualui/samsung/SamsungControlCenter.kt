package app.dualui.samsung

import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material.icons.automirrored.rounded.VolumeUp
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.dualui.core.data.ArabicFormat
import app.dualui.core.engine.SkinHost
import app.dualui.notifications.NotificationAccess
import app.dualui.notifications.NotificationGroupsList
import app.dualui.notifications.NotificationStore
import app.dualui.notifications.NotificationStyle
import app.dualui.quicksettings.QsMode
import app.dualui.shared.*

/**
 * Samsung-style quick panel INSIDE the launcher (Android does not let third-party apps replace the real shade):
 * round tiles + wide brightness / volume bars + grouped notifications. Everything shown is backed by real APIs.
 */
@Composable
fun SamsungControlCenter(host: SkinHost, reveal: Reveal, dark: Boolean) {
    if (!reveal.visible) return
    val p = reveal.progress
    val ctx = LocalContext.current
    val qs = host.vm.services.quickSettings
    val snap by qs.state.collectAsState()
    val tiles = remember(snap) { qs.tiles() }
    val now by rememberNow()
    val cs = MaterialTheme.colorScheme

    fun start(i: Intent?) { if (i != null) try { ctx.startActivity(i) } catch (_: Exception) {} }

    Box(Modifier.fillMaxSize()) {
        Box(
            Modifier.fillMaxSize().graphicsLayer { alpha = p }.background(Color.Black.copy(alpha = 0.45f))
                .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) { reveal.close() },
        )
        Column(
            Modifier.fillMaxWidth().fillMaxHeight(0.92f)
                .graphicsLayer { translationY = -(1f - p) * size.height }
                .clip(RoundedCornerShape(bottomStart = 34.dp, bottomEnd = 34.dp))
                .background(cs.background)
                .windowInsetsPadding(WindowInsets.statusBars)
                .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) {}
                .padding(horizontal = 18.dp),
        ) {
            Row(Modifier.fillMaxWidth().padding(top = 14.dp, bottom = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(ArabicFormat.time(now.toLocalTime()), color = cs.onSurface, fontSize = 34.sp, fontWeight = FontWeight.Bold)
                    Text(ArabicFormat.date(now.toLocalDate()), color = cs.onSurfaceVariant, fontSize = 14.sp)
                }
                Text(
                    (if (snap.charging) "⚡ " else "") + ArabicFormat.percent(snap.batteryPercent),
                    color = cs.onSurfaceVariant, fontSize = 14.sp, modifier = Modifier.padding(horizontal = 10.dp),
                )
                RoundAction(Icons.Rounded.Settings) { reveal.close(); host.openSettings(null) }
            }
            // round tiles, 3 per row (One UI quick panel)
            tiles.chunked(3).forEach { row ->
                Row(Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
                    row.forEach { t ->
                        Column(
                            Modifier.weight(1f).clip(RoundedCornerShape(20.dp)).clickable { start(qs.toggle(t.id)) }.padding(vertical = 4.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                        ) {
                            Box(
                                Modifier.size(62.dp).clip(CircleShape).background(if (t.active) cs.primary else cs.surfaceVariant),
                                contentAlignment = Alignment.Center,
                            ) { Icon(t.icon, null, tint = if (t.active) Color.White else cs.onSurface, modifier = Modifier.size(28.dp)) }
                            Text(t.label, color = cs.onSurface, fontSize = 12.sp, fontWeight = FontWeight.Medium, textAlign = TextAlign.Center, maxLines = 1,
                                modifier = Modifier.padding(top = 6.dp))
                            Text(
                                t.subtitle, color = if (t.mode == QsMode.NEEDS_PERMISSION) cs.primary else cs.onSurfaceVariant,
                                fontSize = 10.sp, textAlign = TextAlign.Center, maxLines = 1,
                            )
                        }
                    }
                    repeat(3 - row.size) { Spacer(Modifier.weight(1f)) }
                }
            }
            Spacer(Modifier.height(8.dp))
            SliderBar(
                snap.brightness,
                { if (!qs.setBrightness(it)) start(qs.writeSettingsIntent()) },
                Icons.Rounded.LightMode, 48.dp, cs.surfaceVariant, cs.primary.copy(alpha = 0.9f), cs.onSurface,
            )
            if (!snap.canWriteSettings) Text(
                stringResource(R.string.sm_brightness_permission), color = cs.primary, fontSize = 12.sp,
                modifier = Modifier.clickable { start(qs.writeSettingsIntent()) }.padding(vertical = 4.dp, horizontal = 6.dp),
            )
            Spacer(Modifier.height(10.dp))
            SliderBar(snap.volume, { qs.setVolume(it) }, Icons.AutoMirrored.Rounded.VolumeUp, 48.dp, cs.surfaceVariant, cs.primary.copy(alpha = 0.9f), cs.onSurface)

            Row(Modifier.fillMaxWidth().padding(top = 16.dp, bottom = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(stringResource(R.string.sm_notifications), color = cs.onSurface, fontSize = 17.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                Text(stringResource(app.dualui.notifications.R.string.notif_clear_all), color = cs.primary, fontSize = 13.sp,
                    modifier = Modifier.clip(RoundedCornerShape(10.dp)).clickable { NotificationStore.dismissAll() }.padding(8.dp))
            }
            Box(Modifier.weight(1f)) {
                NotificationGroupsList(
                    style = NotificationStyle(RoundedCornerShape(22.dp), cs.surface, cs.onSurface, cs.onSurfaceVariant, cs.primary, app.dualui.shared.TajawalFamily),
                    onOpenAccessSettings = { start(NotificationAccess.settingsIntent()) },
                    onItemOpened = { reveal.close() },
                )
            }
            Row(Modifier.fillMaxWidth().padding(vertical = 6.dp), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
                Text(
                    stringResource(R.string.sm_open_system_shade), color = cs.onSurfaceVariant, fontSize = 12.sp,
                    modifier = Modifier.clip(RoundedCornerShape(12.dp)).clickable { reveal.close(); qs.expandSystemShade() }.padding(horizontal = 12.dp, vertical = 6.dp),
                )
            }
            Box(Modifier.align(Alignment.CenterHorizontally).padding(bottom = 10.dp).size(width = 44.dp, height = 5.dp).clip(CircleShape).background(cs.onSurfaceVariant.copy(alpha = .4f))
                .clickable { reveal.close() })
        }
    }
}

@Composable
private fun RoundAction(icon: androidx.compose.ui.graphics.vector.ImageVector, onClick: () -> Unit) {
    Box(
        Modifier.size(42.dp).clip(CircleShape).background(MaterialTheme.colorScheme.surfaceVariant).clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) { Icon(icon, null, tint = MaterialTheme.colorScheme.onSurface, modifier = Modifier.size(22.dp)) }
}
