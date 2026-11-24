package app.dualui.pixel

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.spring
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.pager.PagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.GraphicsLayerScope
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.dualui.core.engine.AppLauncher
import app.dualui.core.model.AppInfo
import app.dualui.core.model.ItemKind
import app.dualui.shared.*
import kotlin.math.abs
import kotlin.math.roundToInt

@Composable
fun PixelCell(model: CellModel, iconSize: Dp, showLabel: Boolean, ink: Color) {
    val themed = LocalThemedIcons.current
    val appInfo = model.app
    Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
        when {
            appInfo != null -> {
                AppIcon(appInfo, iconSize, PixelIconShape, themed = themed)
                if (showLabel) PixelLabel(appInfo.label, ink)
            }
            model.item.kind == ItemKind.FOLDER -> {
                PixelFolderIcon(model.folderApps, iconSize)
                if (showLabel) PixelLabel(model.item.title, ink)
            }
        }
    }
}

@Composable
fun PixelLabel(text: String, ink: Color) {
    Text(
        text, color = ink, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center,
        style = TextStyle(shadow = if (ink == Color.White) Shadow(Color(0x55000000), blurRadius = 5f) else Shadow.None),
        modifier = Modifier.padding(top = 5.dp, start = 2.dp, end = 2.dp),
    )
}

/** Pixel folders: a round container showing a 2×2 cluster of circular icons. */
@Composable
fun PixelFolderIcon(apps: List<AppInfo>, size: Dp) {
    val themed = LocalThemedIcons.current
    Box(Modifier.size(size).clip(CircleShape).background(MaterialTheme.colorScheme.surfaceContainerHigh.copy(alpha = 0.92f)), contentAlignment = Alignment.Center) {
        val mini = size * 0.34f
        Column(verticalArrangement = Arrangement.spacedBy(size * 0.05f), horizontalAlignment = Alignment.CenterHorizontally) {
            apps.take(4).chunked(2).forEach { row ->
                Row(horizontalArrangement = Arrangement.spacedBy(size * 0.05f)) { row.forEach { AppIcon(it, mini, CircleShape, themed = themed) } }
            }
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun PixelAppTile(app: AppInfo, iconSize: Dp, ink: Color, onLongClick: (android.graphics.Rect) -> Unit, modifier: Modifier = Modifier) {
    val ctx = LocalContext.current
    val view = LocalView.current
    var bounds by remember { mutableStateOf(android.graphics.Rect()) }
    Column(
        modifier.clip(RoundedCornerShape(16.dp))
            .onGloballyPositioned { c -> c.boundsInRoot().let { bounds = android.graphics.Rect(it.left.toInt(), it.top.toInt(), it.right.toInt(), it.bottom.toInt()) } }
            .combinedClickable(onClick = { AppLauncher.launch(ctx, view, app, bounds) }, onLongClick = { onLongClick(bounds) })
            .padding(vertical = 8.dp, horizontal = 2.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        AppIcon(app, iconSize, PixelIconShape, themed = LocalThemedIcons.current)
        PixelLabel(app.label, ink)
    }
}

@Composable
fun PixelPageIndicator(pager: PagerState, count: Int, ink: Color) {
    if (count < 2) { Spacer(Modifier.height(10.dp)); return }
    Row(Modifier.fillMaxWidth().padding(vertical = 8.dp), horizontalArrangement = Arrangement.Center) {
        repeat(count) { i ->
            val active = i == pager.currentPage
            Box(Modifier.padding(horizontal = 3.dp).size(if (active) 8.dp else 6.dp).clip(CircleShape).background(ink.copy(alpha = if (active) 0.95f else 0.4f)))
        }
    }
}

/** Pixel's bottom search pill (sits right above the dock). */
@Composable
fun PixelSearchPill(onClick: () -> Unit) {
    val cs = MaterialTheme.colorScheme
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp).height(54.dp)
            .clip(RoundedCornerShape(27.dp)).background(cs.surfaceContainerHigh.copy(alpha = 0.96f))
            .clickable(onClick = onClick).padding(horizontal = 18.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(Icons.Rounded.Search, null, tint = cs.onSurfaceVariant)
        Spacer(Modifier.width(12.dp))
        Text(stringResource(R.string.px_search_home), color = cs.onSurfaceVariant, fontSize = 15.sp)
    }
}

/** Pixel long-press shortcuts: separate stacked pills (first/last extra round), springing from the icon. */
@Composable
fun PixelMenu(anchor: Rect, actions: List<MenuAction>, onDismiss: () -> Unit) {
    val density = LocalDensity.current
    val cs = MaterialTheme.colorScheme
    BoxWithConstraints(Modifier.fillMaxSize().clickable(interactionSource = remember { MutableInteractionSource() }, indication = null, onClick = onDismiss)) {
        val w = 232.dp
        val itemH = 54.dp
        val gap = 3.dp
        val h = itemH * actions.size + gap * (actions.size - 1)
        val wPx = with(density) { w.toPx() }; val hPx = with(density) { h.toPx() }
        val maxW = with(density) { maxWidth.toPx() }
        val edge = with(density) { 12.dp.toPx() }
        val x = (anchor.center.x - wPx / 2).coerceIn(edge, maxW - wPx - edge)
        val below = anchor.bottom + hPx + with(density) { 20.dp.toPx() } < with(density) { maxHeight.toPx() }
        val y = if (below) anchor.bottom + with(density) { 8.dp.toPx() } else anchor.top - hPx - with(density) { 8.dp.toPx() }
        val appear = remember { Animatable(0f) }
        LaunchedEffect(Unit) { appear.animateTo(1f, spring(0.8f, 500f)) }
        Column(
            Modifier.absoluteOffset { IntOffset(x.roundToInt(), y.roundToInt()) }.width(w)
                .graphicsLayer {
                    val s = 0.7f + 0.3f * appear.value
                    scaleX = s; scaleY = s; alpha = appear.value.coerceIn(0f, 1f)
                    transformOrigin = TransformOrigin(0.5f, if (below) 0f else 1f)
                },
            verticalArrangement = Arrangement.spacedBy(gap),
        ) {
            actions.forEachIndexed { i, a ->
                val big = 27.dp; val small = 8.dp
                val shape = RoundedCornerShape(
                    topStart = if (i == 0) big else small, topEnd = if (i == 0) big else small,
                    bottomStart = if (i == actions.lastIndex) big else small, bottomEnd = if (i == actions.lastIndex) big else small,
                )
                val tint = if (a.destructive) cs.error else cs.onSurface
                Row(
                    Modifier.fillMaxWidth().height(itemH).clip(shape).background(cs.surfaceContainerHigh)
                        .clickable { onDismiss(); a.run() }.padding(horizontal = 18.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(a.icon, null, tint = if (a.destructive) cs.error else cs.primary, modifier = Modifier.size(22.dp))
                    Spacer(Modifier.width(14.dp))
                    Text(a.label, color = tint, fontSize = 14.sp, fontWeight = FontWeight.Medium)
                }
            }
        }
    }
}

fun pixelPageGraphics(scope: GraphicsLayerScope, off: Float) {
    // Pixel: plain horizontal slide with a subtle depth fade.
    val a = abs(off).coerceIn(0f, 1f)
    scope.alpha = 1f - 0.35f * a
    scope.translationX = off * scope.size.width * 0.18f
}
