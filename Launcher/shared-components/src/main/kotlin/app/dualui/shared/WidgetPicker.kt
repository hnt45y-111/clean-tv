package app.dualui.shared

import android.appwidget.AppWidgetProviderInfo
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.graphics.drawable.toBitmap
import app.dualui.core.data.ArabicFormat
import app.dualui.core.engine.LauncherViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class SheetStyle(val container: Color, val onContainer: Color, val variant: Color, val accent: Color, val rowColor: Color, val shape: Shape, val font: FontFamily)

/** Bottom sheet listing every installed widget provider, grouped by app. Picking one starts the official bind flow. */
@Composable
fun WidgetPicker(vm: LauncherViewModel, style: SheetStyle, onDismiss: () -> Unit, modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val pm = context.packageManager
    var groups by remember { mutableStateOf<List<Pair<String, List<AppWidgetProviderInfo>>>>(emptyList()) }
    LaunchedEffect(Unit) {
        groups = withContext(Dispatchers.Default) {
            vm.services.widgets.installedProviders()
                .groupBy { it.provider.packageName }
                .map { (pkg, list) ->
                    val label = try { pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString() } catch (_: Exception) { pkg }
                    label to list
                }.sortedBy { it.first }
        }
    }
    Box(modifier.fillMaxSize()) {
        Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = .45f))
            .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null, onClick = onDismiss))
        Column(
            Modifier.align(Alignment.BottomCenter).fillMaxWidth().fillMaxHeight(0.78f)
                .clip(style.shape).background(style.container)
                .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) {}
                .padding(top = 18.dp),
        ) {
            Text(stringResource(R.string.widgets_title), color = style.onContainer, fontFamily = style.font,
                fontWeight = FontWeight.Bold, fontSize = 20.sp, modifier = Modifier.padding(horizontal = 24.dp, vertical = 8.dp))
            if (groups.isEmpty()) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text(stringResource(R.string.widgets_empty), color = style.variant, fontFamily = style.font)
                }
            } else LazyColumn(
                contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 32.dp, top = 6.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                items(groups, key = { it.first }) { (label, list) ->
                    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(22.dp)).background(style.rowColor).padding(14.dp)) {
                        Text(label, color = style.accent, fontFamily = style.font, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        Spacer(Modifier.height(8.dp))
                        list.forEach { info ->
                            val preview by produceState<androidx.compose.ui.graphics.ImageBitmap?>(null, info) {
                                value = withContext(Dispatchers.Default) {
                                    try { (info.loadPreviewImage(context, 0) ?: info.loadIcon(context, 0))?.toBitmap(360, 220)?.asImageBitmap() }
                                    catch (_: Exception) { null }
                                }
                            }
                            Row(
                                Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp))
                                    .clickable { vm.requestWidget(info); onDismiss() }.padding(vertical = 8.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Box(Modifier.size(110.dp, 72.dp).clip(RoundedCornerShape(12.dp)).background(style.container), contentAlignment = Alignment.Center) {
                                    preview?.let { Image(it, null, Modifier.fillMaxSize().padding(4.dp), contentScale = ContentScale.Fit) }
                                }
                                Spacer(Modifier.width(14.dp))
                                Column {
                                    Text(info.loadLabel(pm), color = style.onContainer, fontFamily = style.font, fontWeight = FontWeight.Medium, fontSize = 15.sp)
                                    val dm = context.resources.displayMetrics
                                    val cw = ((info.minWidth / dm.density + 30) / 70).toInt().coerceAtLeast(1)
                                    val ch = ((info.minHeight / dm.density + 30) / 70).toInt().coerceAtLeast(1)
                                    Text("${ArabicFormat.number(cw)} × ${ArabicFormat.number(ch)}", color = style.variant, fontFamily = style.font, fontSize = 12.sp)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
