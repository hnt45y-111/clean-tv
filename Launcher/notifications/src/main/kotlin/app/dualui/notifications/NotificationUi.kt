package app.dualui.notifications

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.text.format.DateUtils
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.NotificationsNone
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** Visual parameters so Samsung and Pixel can restyle the very same grouped list. */
data class NotificationStyle(
    val cardShape: Shape,
    val cardColor: Color,
    val onCard: Color,
    val onCardVariant: Color,
    val accent: Color,
    val font: FontFamily,
    val itemSpacing: Int = 8,
)

private val iconCache = HashMap<String, Bitmap?>()

fun appBitmap(context: Context, pkg: String): Bitmap? = iconCache.getOrPut(pkg) {
    try {
        val d = context.packageManager.getApplicationIcon(pkg)
        val b = Bitmap.createBitmap(96, 96, Bitmap.Config.ARGB_8888)
        d.setBounds(0, 0, 96, 96); d.draw(Canvas(b)); b
    } catch (_: Exception) { null }
}

/** Notifications grouped by originating app. Tap = open the app, X = dismiss (when Android allows it). */
@Composable
fun NotificationGroupsList(
    style: NotificationStyle,
    modifier: Modifier = Modifier,
    onOpenAccessSettings: () -> Unit,
    onItemOpened: () -> Unit = {},
) {
    val context = LocalContext.current
    val connected by NotificationStore.connected.collectAsState()
    val items by NotificationStore.items.collectAsState()
    val groups = remember(items) { NotificationStore.groups(items) }

    if (!connected) {
        Column(
            modifier.padding(16.dp).clip(style.cardShape).background(style.cardColor).padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(stringResource(R.string.notif_access_title), color = style.onCard, fontFamily = style.font,
                fontWeight = FontWeight.Bold, fontSize = 16.sp)
            Text(stringResource(R.string.notif_access_body), color = style.onCardVariant, fontFamily = style.font, fontSize = 13.sp)
            Text(
                stringResource(R.string.notif_access_button),
                color = style.accent, fontFamily = style.font, fontWeight = FontWeight.Bold,
                modifier = Modifier.clickable(onClick = onOpenAccessSettings).padding(vertical = 6.dp),
            )
        }
        return
    }
    if (groups.isEmpty()) {
        Box(modifier.fillMaxWidth().padding(vertical = 28.dp), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(Icons.Rounded.NotificationsNone, null, tint = style.onCardVariant, modifier = Modifier.size(34.dp))
                Spacer(Modifier.height(6.dp))
                Text(stringResource(R.string.notif_empty), color = style.onCardVariant, fontFamily = style.font, fontSize = 14.sp)
            }
        }
        return
    }
    LazyColumn(modifier, verticalArrangement = Arrangement.spacedBy(style.itemSpacing.dp)) {
        items(groups, key = { it.pkg }) { group ->
            var expanded by remember(group.pkg) { mutableStateOf(false) }
            Column(
                Modifier.fillMaxWidth().clip(style.cardShape).background(style.cardColor).padding(vertical = 6.dp),
            ) {
                Row(
                    Modifier.fillMaxWidth().clickable { if (group.items.size > 1) expanded = !expanded }
                        .padding(horizontal = 14.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    appBitmap(context, group.pkg)?.let {
                        Image(it.asImageBitmap(), null, Modifier.size(18.dp).clip(CircleShape))
                    }
                    Spacer(Modifier.width(8.dp))
                    Text(group.appLabel, color = style.onCardVariant, fontFamily = style.font, fontSize = 12.sp,
                        fontWeight = FontWeight.Medium, modifier = Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis)
                    if (group.items.size > 1) {
                        Text(arabicDigits(group.items.size), color = style.accent, fontFamily = style.font,
                            fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                }
                val shown = if (expanded) group.items else group.items.take(1)
                shown.forEach { n ->
                    Row(
                        Modifier.fillMaxWidth()
                            .clickable { NotificationStore.open(context, n); onItemOpened() }
                            .padding(horizontal = 14.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(Modifier.weight(1f)) {
                            if (n.title.isNotBlank()) Text(n.title, color = style.onCard, fontFamily = style.font,
                                fontWeight = FontWeight.Medium, fontSize = 14.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            if (n.text.isNotBlank()) Text(n.text, color = style.onCardVariant, fontFamily = style.font,
                                fontSize = 13.sp, maxLines = if (expanded) 4 else 2, overflow = TextOverflow.Ellipsis)
                            Text(
                                DateUtils.getRelativeTimeSpanString(n.time, System.currentTimeMillis(), DateUtils.MINUTE_IN_MILLIS).toString(),
                                color = style.onCardVariant.copy(alpha = .7f), fontFamily = style.font, fontSize = 11.sp,
                            )
                        }
                        if (n.clearable) {
                            Icon(
                                Icons.Rounded.Close, stringResource(R.string.notif_dismiss), tint = style.onCardVariant,
                                modifier = Modifier.size(32.dp).clip(CircleShape)
                                    .clickable { NotificationStore.dismiss(n) }.padding(6.dp),
                            )
                        }
                    }
                }
                if (!expanded && group.items.size > 1) {
                    Text(
                        stringResource(R.string.notif_more, arabicDigits(group.items.size - 1)),
                        color = style.accent, fontFamily = style.font, fontSize = 12.sp,
                        modifier = Modifier.clickable { expanded = true }.padding(horizontal = 14.dp, vertical = 4.dp),
                    )
                }
            }
        }
    }
}

private fun arabicDigits(n: Int): String =
    java.text.NumberFormat.getInstance(java.util.Locale.forLanguageTag("ar-u-nu-arab")).format(n)
