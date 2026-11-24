package app.dualui.samsung

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.pager.PagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.dualui.core.engine.AppLauncher
import app.dualui.core.model.AppInfo
import app.dualui.shared.*
import kotlin.math.abs
import kotlin.math.roundToInt

/** Icon + label (and folder preview) exactly as One UI draws them: squircle icons, labels below, soft shadow. */
@Composable
fun SamsungCell(model: CellModel, iconSize: Dp, showLabel: Boolean, ink: Color) {
    val appInfo = model.app
    Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
        when {
            appInfo != null -> {
                AppIcon(appInfo, iconSize, SamsungIconShape)
                if (showLabel) SamsungLabel(appInfo.label, ink)
            }
            model.item.kind == app.dualui.core.model.ItemKind.FOLDER -> {
                SamsungFolderIcon(model.folderApps, iconSize)
                if (showLabel) SamsungLabel(model.item.title, ink)
            }
        }
    }
}

@Composable
fun SamsungLabel(text: String, ink: Color, modifier: Modifier = Modifier) {
    Text(
        text, color = ink, fontSize = 12.sp, fontWeight = FontWeight.Medium, maxLines = 1, overflow = TextOverflow.Ellipsis,
        textAlign = TextAlign.Center,
        style = androidx.compose.ui.text.TextStyle(
            shadow = if (ink == Color.White) Shadow(Color(0x66000000), blurRadius = 6f) else Shadow.None,
        ),
        modifier = modifier.padding(top = 6.dp, start = 2.dp, end = 2.dp),
    )
}

@Composable
fun SamsungFolderIcon(apps: List<AppInfo>, size: Dp) {
    Box(
        Modifier.size(size).clip(SamsungIconShape).background(Color.White.copy(alpha = 0.30f)).padding(size * 0.1f),
    ) {
        val mini = size * 0.36f
        Column(Modifier.align(Alignment.Center), verticalArrangement = Arrangement.spacedBy(size * 0.06f)) {
            apps.take(4).chunked(2).forEach { row ->
                Row(horizontalArrangement = Arrangement.spacedBy(size * 0.06f)) {
                    row.forEach { AppIcon(it, mini, RoundedCornerShape(percent = 30)) }
                }
            }
        }
    }
}

/** App tile used in the drawer and search results. */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun SamsungAppTile(
    app: AppInfo, iconSize: Dp, ink: Color,
    onLongClick: (android.graphics.Rect) -> Unit, modifier: Modifier = Modifier,
) {
    val ctx = LocalContext.current
    val view = LocalView.current
    var bounds by remember { mutableStateOf(android.graphics.Rect()) }
    Column(
        modifier
            .clip(RoundedCornerShape(18.dp))
            .onGloballyPositioned { c -> c.boundsInRoot().let { bounds = android.graphics.Rect(it.left.toInt(), it.top.toInt(), it.right.toInt(), it.bottom.toInt()) } }
            .combinedClickable(onClick = { AppLauncher.launch(ctx, view, app, bounds) }, onLongClick = { onLongClick(bounds) })
            .padding(vertical = 8.dp, horizontal = 2.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        AppIcon(app, iconSize, SamsungIconShape)
        SamsungLabel(app.label, ink)
    }
}

/** One UI dock: floating translucent capsule. */
@Composable
fun SamsungDock(content: @Composable () -> Unit) {
    Box(
        Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 8.dp)
            .clip(RoundedCornerShape(34.dp)).background(Color.White.copy(alpha = 0.20f)).padding(horizontal = 6.dp, vertical = 4.dp),
    ) { content() }
}

@Composable
fun SamsungPageIndicator(pager: PagerState, count: Int, ink: Color) {
    Row(Modifier.fillMaxWidth().padding(vertical = 6.dp), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
        repeat(count) { i ->
            val active = i == pager.currentPage
            val w by androidx.compose.animation.core.animateDpAsState(if (active) 16.dp else 6.dp, label = "dot")
            Box(Modifier.padding(horizontal = 3.dp).height(6.dp).width(w).clip(CircleShape).background(ink.copy(alpha = if (active) 0.95f else 0.45f)))
        }
    }
}

/** One UI popup menu: rounded card with icon rows, springs out from the pressed icon. */
@Composable
fun SamsungMenu(anchor: androidx.compose.ui.geometry.Rect, actions: List<MenuAction>, onDismiss: () -> Unit) {
    val density = LocalDensity.current
    BoxWithConstraints(Modifier.fillMaxSize().clickable(interactionSource = remember { MutableInteractionSource() }, indication = null, onClick = onDismiss)) {
        val w = 236.dp
        val h = (actions.size * 52 + 16).dp
        val wPx = with(density) { w.toPx() }; val hPx = with(density) { h.toPx() }
        val maxW = with(density) { maxWidth.toPx() }
        val x = (anchor.center.x - wPx / 2).coerceIn(with(density) { 12.dp.toPx() }, maxW - wPx - with(density) { 12.dp.toPx() })
        val below = anchor.bottom + hPx + with(density) { 16.dp.toPx() } < with(density) { maxHeight.toPx() }
        val y = if (below) anchor.bottom + with(density) { 6.dp.toPx() } else anchor.top - hPx - with(density) { 6.dp.toPx() }
        val appear = remember { androidx.compose.animation.core.Animatable(0f) }
        LaunchedEffect(Unit) { appear.animateTo(1f, androidx.compose.animation.core.spring(0.7f, 600f)) }
        Column(
            Modifier.absoluteOffset { IntOffset(x.roundToInt(), y.roundToInt()) }.width(w)
                .graphicsLayer {
                    val s = 0.82f + 0.18f * appear.value
                    scaleX = s; scaleY = s; alpha = appear.value.coerceIn(0f, 1f)
                    transformOrigin = androidx.compose.ui.graphics.TransformOrigin(0.5f, if (below) 0f else 1f)
                }
                .shadow(18.dp, SamsungCard).clip(SamsungCard).background(MaterialTheme.colorScheme.surface).padding(vertical = 8.dp),
        ) {
            actions.forEach { a ->
                val tint = if (a.destructive) Color(0xFFE5484D) else MaterialTheme.colorScheme.onSurface
                Row(
                    Modifier.fillMaxWidth().height(52.dp).clickable { onDismiss(); a.run() }.padding(horizontal = 18.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(a.icon, null, tint = tint, modifier = Modifier.size(22.dp))
                    Spacer(Modifier.width(14.dp))
                    Text(a.label, color = tint, fontSize = 15.sp, fontWeight = FontWeight.Medium)
                }
            }
        }
    }
}

fun samsungPageGraphics(scope: androidx.compose.ui.graphics.GraphicsLayerScope, off: Float) {
    // One UI zooms the page out slightly and fades it while it slides away.
    val a = abs(off).coerceIn(0f, 1f)
    val s = 1f - 0.12f * a
    scope.scaleX = s; scope.scaleY = s; scope.alpha = 1f - 0.55f * a
}
