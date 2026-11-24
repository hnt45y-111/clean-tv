package app.dualui.pixel

import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.VolumeUp
import androidx.compose.material.icons.rounded.*
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
 * Pixel-style panel inside the launcher: brightness on top, two-column pill tiles with state text,
 * then grouped notification cards. (The real system shade stays reachable through a button.)
 */
@Composable
fun PixelControlCenter(host: SkinHost, reveal: Reveal) {
    if (!reveal.visible) return
    val p = reveal.progress
    val ctx = LocalContext.current
    val cs = MaterialTheme.colorScheme
    val qs = host.vm.services.quickSettings
    val snap by qs.state.collectAsState()
    val tiles = remember(snap) { qs.tiles() }
    val now by rememberNow()

    fun start(i: Intent?) { if (i != null) try { ctx.startActivity(i) } catch (_: Exception) {} }

    Box(Modifier.fillMaxSize()) {
        Box(Modifier.fillMaxSize().graphicsLayer { alpha = p }.background(Color.Black.copy(alpha = 0.5f))
            .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) { reveal.close() })
        Column(
            Modifier.fillMaxWidth().fillMaxHeight(0.94f)
                .graphicsLayer { translationY = -(1f - p) * size.height; alpha = (p * 2f).coerceIn(0f, 1f) }
                .clip(RoundedCornerShape(bottomStart = 36.dp, bottomEnd = 36.dp)).background(cs.surfaceContainer)
                .windowInsetsPadding(WindowInsets.statusBars)
                .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) {}
                .padding(horizontal = 16.dp),
        ) {
            Row(Modifier.fillMaxWidth().padding(top = 16.dp, bottom = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(ArabicFormat.time(now.toLocalTime()) + " " + ArabicFormat.ampm(now.toLocalTime()), color = cs.onSurface, fontSize = 30.sp, fontWeight = FontWeight.Medium)
                    Text(
                        ArabicFormat.date(now.toLocalDate()) + " • " + (if (snap.charging) stringResource(R.string.px_battery_charging) + " " else "") + ArabicFormat.percent(snap.batteryPercent),
                        color = cs.onSurfaceVariant, fontSize = 13.sp,
                    )
                }
                Box(Modifier.size(44.dp).clip(CircleShape).background(cs.surfaceContainerHighest).clickable { reveal.close(); host.openSettings(null) },
                    contentAlignment = Alignment.Center) { Icon(Icons.Rounded.Settings, null, tint = cs.onSurface) }
            }
            SliderBar(
                snap.brightness, { if (!qs.setBrightness(it)) start(qs.writeSettingsIntent()) },
                Icons.Rounded.BrightnessMedium, 56.dp, cs.surfaceContainerHighest, cs.primary, cs.onPrimary, thumb = cs.onPrimary.copy(alpha = 0.95f),
            )
            if (!snap.canWriteSettings) Text(stringResource(R.string.px_brightness_permission), color = cs.primary, fontSize = 12.sp,
                modifier = Modifier.clickable { start(qs.writeSettingsIntent()) }.padding(horizontal = 8.dp, vertical = 6.dp))
            Spacer(Modifier.height(12.dp))
            tiles.chunked(2).forEach { row ->
                Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    row.forEach { t ->
                        Row(
                            Modifier.weight(1f).height(66.dp).clip(RoundedCornerShape(33.dp))
                                .background(if (t.active) cs.primary else cs.surfaceContainerHighest)
                                .clickable { start(qs.toggle(t.id)) }.padding(horizontal = 12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            val fg = if (t.active) cs.onPrimary else cs.onSurface
                            Box(Modifier.size(44.dp).clip(CircleShape).background(if (t.active) cs.onPrimary.copy(alpha = 0.18f) else cs.surfaceContainer),
                                contentAlignment = Alignment.Center) { Icon(t.icon, null, tint = fg, modifier = Modifier.size(24.dp)) }
                            Spacer(Modifier.width(10.dp))
                            Column {
                                Text(t.label, color = fg, fontSize = 14.sp, fontWeight = FontWeight.Medium, maxLines = 1)
                                Text(t.subtitle, color = fg.copy(alpha = 0.8f), fontSize = 11.sp, maxLines = 1)
                            }
                        }
                    }
                    if (row.size == 1) Spacer(Modifier.weight(1f))
                }
            }
            Spacer(Modifier.height(8.dp))
            SliderBar(snap.volume, { qs.setVolume(it) }, Icons.AutoMirrored.Rounded.VolumeUp, 56.dp, cs.surfaceContainerHighest, cs.secondaryContainer, cs.onSurface,
                thumb = cs.primary)

            Row(Modifier.fillMaxWidth().padding(top = 14.dp, bottom = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(stringResource(R.string.px_notifications), color = cs.onSurface, fontSize = 16.sp, fontWeight = FontWeight.Medium, modifier = Modifier.weight(1f))
                Text(stringResource(app.dualui.notifications.R.string.notif_clear_all), color = cs.primary, fontSize = 13.sp,
                    modifier = Modifier.clip(CircleShape).clickable { NotificationStore.dismissAll() }.padding(horizontal = 12.dp, vertical = 6.dp))
            }
            Box(Modifier.weight(1f)) {
                NotificationGroupsList(
                    style = NotificationStyle(RoundedCornerShape(24.dp), cs.surfaceContainerHigh, cs.onSurface, cs.onSurfaceVariant, cs.primary, PlexArabicFamily, 6),
                    onOpenAccessSettings = { start(NotificationAccess.settingsIntent()) },
                    onItemOpened = { reveal.close() },
                )
            }
            Text(
                stringResource(R.string.px_open_system_shade), color = cs.onSurfaceVariant, fontSize = 12.sp,
                modifier = Modifier.align(Alignment.CenterHorizontally).clip(CircleShape)
                    .clickable { reveal.close(); qs.expandSystemShade() }.padding(horizontal = 14.dp, vertical = 8.dp),
            )
            Box(Modifier.align(Alignment.CenterHorizontally).padding(bottom = 10.dp).size(36.dp, 4.dp).clip(CircleShape)
                .background(cs.onSurfaceVariant.copy(alpha = 0.4f)).clickable { reveal.close() })
        }
    }
}
