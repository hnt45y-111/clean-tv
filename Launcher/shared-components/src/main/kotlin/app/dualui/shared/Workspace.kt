package app.dualui.shared

import android.graphics.Rect as AndroidRect
import androidx.activity.compose.BackHandler
import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.PagerState
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.dualui.core.engine.AppLauncher
import app.dualui.core.engine.HomeLayoutEngine
import app.dualui.core.engine.LauncherViewModel
import app.dualui.core.model.*
import app.dualui.core.widgets.WidgetView
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.collectLatest
import kotlin.math.floor
import kotlin.math.min
import kotlin.math.roundToInt

/** State the skin needs to read (pager for the page indicator, dragging for fading chrome). */
@Stable
class WorkspaceState {
    var pagesUsed by mutableIntStateOf(1)
    var dragging by mutableStateOf(false)
    var openFolder by mutableStateOf<Long?>(null)
    var menu by mutableStateOf<ItemMenu?>(null)
    /** One extra blank page is offered while dragging so users can start a new page. */
    val pageCount: Int get() = pagesUsed + if (dragging) 1 else 0
    lateinit var pager: PagerState
}

@Composable
fun rememberWorkspaceState(vm: LauncherViewModel): WorkspaceState {
    val items by vm.items.collectAsState()
    val ws = remember { WorkspaceState() }
    val used = HomeLayoutEngine.pageCount(items)
    SideEffect { ws.pagesUsed = used }
    ws.pager = rememberPagerState { ws.pageCount }
    LaunchedEffect(ws) { snapshotFlow { ws.pager.currentPage }.collectLatest { vm.currentPage = it } }
    return ws
}

private data class Drag(val item: HomeItem, val pointer: Offset, val moved: Boolean)
private data class Target(val container: Int, val page: Int, val x: Int, val y: Int, val zone: Int = 0)

/**
 * The shared home workspace: paged grid + dock + drag & drop + folders + long-press menus.
 * Skins plug their visuals in through [WorkspaceSpec]; the behaviour is identical in every interface.
 */
@Composable
fun HomeWorkspace(
    vm: LauncherViewModel,
    ws: WorkspaceState,
    spec: WorkspaceSpec,
    modifier: Modifier = Modifier,
    blocked: Boolean = false,
    onVerticalDrag: (startY: Float, dy: Float) -> Unit = { _, _ -> },
    onVerticalEnd: (dy: Float, velocityY: Float, cancelled: Boolean) -> Unit = { _, _, _ -> },
    onBackgroundLongPress: (Offset) -> Unit = {},
) {
    val prefs by vm.prefs.collectAsState()
    val p = prefs ?: return
    val items by vm.items.collectAsState()
    val apps by vm.apps.collectAsState()
    val appByKey = remember(apps) { apps.associateBy { it.key } }
    val context = LocalContext.current
    val view = LocalView.current
    val haptics = LocalHapticFeedback.current
    val density = LocalDensity.current
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl

    LaunchedEffect(spec.headerRows) { vm.applyHeaderRows(spec.headerRows) }

    // The gesture coroutine outlives recompositions: read skin callbacks through "updated" holders so they never go stale.
    val blockedNow by rememberUpdatedState(blocked)
    val onVDragNow by rememberUpdatedState(onVerticalDrag)
    val onVEndNow by rememberUpdatedState(onVerticalEnd)
    val onBgLongNow by rememberUpdatedState(onBackgroundLongPress)

    var rootTopLeft by remember { mutableStateOf(Offset.Zero) }
    var rootSize by remember { mutableStateOf(Size.Zero) }
    var pagerRect by remember { mutableStateOf(Rect.Zero) }
    var dockRect by remember { mutableStateOf(Rect.Zero) }
    var drag by remember { mutableStateOf<Drag?>(null) }
    val pager = ws.pager

    val cols = p.cols; val rows = p.rows
    val cellW = if (pagerRect.width > 0) pagerRect.width / cols else 1f
    val cellH = if (pagerRect.height > 0) pagerRect.height / rows else 1f
    val slotW = if (dockRect.width > 0) dockRect.width / p.dockCount else 1f
    val iconDp = with(density) { (min(cellW, cellH) * 0.52f * p.iconScale).toDp() }.coerceIn(30.dp, 76.dp)
    val zoneBottom = with(density) { 96.dp.toPx() }

    // ---- geometry helpers (RTL aware: column 0 is on the right) ----
    fun colToX(col: Int, span: Int, width: Float, total: Int): Float {
        val w = width / total
        return if (rtl) width - (col + span) * w else col * w
    }
    fun xToCol(x: Float, width: Float, total: Int): Int {
        val c = floor(x / (width / total)).toInt().coerceIn(0, total - 1)
        return if (rtl) total - 1 - c else c
    }
    fun cellRect(t: Target, item: HomeItem?): Rect {
        val sx = item?.spanX ?: 1; val sy = item?.spanY ?: 1
        return if (t.container == Container.DOCK) {
            val x = dockRect.left + colToX(t.x, 1, dockRect.width, p.dockCount)
            Rect(x, dockRect.top, x + slotW, dockRect.bottom)
        } else {
            val x = pagerRect.left + colToX(t.x, sx, pagerRect.width, cols)
            val y = pagerRect.top + t.y * cellH
            Rect(x, y, x + sx * cellW, y + sy * cellH)
        }
    }
    fun targetAt(pt: Offset, spanX: Int = 1): Target? {
        if (dockRect.contains(pt)) return Target(Container.DOCK, 0, xToCol(pt.x - dockRect.left, dockRect.width, p.dockCount), 0)
        if (pagerRect.contains(pt)) {
            val lx = pt.x - pagerRect.left; val ly = pt.y - pagerRect.top
            val y = floor(ly / cellH).toInt().coerceIn(0, rows - 1)
            var x = xToCol(lx, pagerRect.width, cols)
            if (spanX > 1) x = (x - (spanX - 1) / 2).coerceIn(0, cols - spanX)   // centre wide widgets under the finger
            return Target(Container.HOME, pager.currentPage, x, y)
        }
        return null
    }
    fun itemAtTarget(t: Target): HomeItem? =
        HomeLayoutEngine.itemAt(items.filter { it.container != Container.FOLDER }, t.container, t.page, t.x, t.y)

    fun androidBounds(r: Rect): AndroidRect {
        val a = r.translate(rootTopLeft)
        return AndroidRect(a.left.roundToInt(), a.top.roundToInt(), a.right.roundToInt(), a.bottom.roundToInt())
    }

    fun menuActions(item: HomeItem, app: AppInfo?, rect: Rect): List<MenuAction> = buildList {
        when (item.kind) {
            ItemKind.APP -> if (app != null) {
                add(MenuAction(context.getString(R.string.act_app_info), Icons.Rounded.Info) { AppLauncher.appInfo(context, app, androidBounds(rect)) })
                add(MenuAction(context.getString(R.string.act_uninstall), Icons.Rounded.Delete, true) { AppLauncher.uninstall(context, app) })
                add(MenuAction(context.getString(R.string.act_remove_home), Icons.Rounded.RemoveCircleOutline) { vm.removeItem(item.id) })
            }
            ItemKind.FOLDER -> {
                add(MenuAction(context.getString(R.string.act_rename), Icons.Rounded.Edit) { ws.openFolder = item.id })
                add(MenuAction(context.getString(R.string.act_ungroup), Icons.Rounded.FolderOff) { vm.ungroup(item.id) })
                add(MenuAction(context.getString(R.string.act_remove_folder), Icons.Rounded.RemoveCircleOutline, true) { vm.removeItem(item.id) })
            }
            ItemKind.WIDGET -> add(MenuAction(context.getString(R.string.act_remove_widget), Icons.Rounded.RemoveCircleOutline, true) { vm.removeItem(item.id) })
        }
    }

    fun cellModel(item: HomeItem, inDock: Boolean): CellModel {
        val app = if (item.kind == ItemKind.APP) appByKey[item.appKey] else null
        val kids = if (item.kind == ItemKind.FOLDER)
            items.filter { it.container == Container.FOLDER && it.parent == item.id }.sortedBy { it.x }
                .mapNotNull { appByKey[it.appKey] } else emptyList()
        return CellModel(item, app, kids, inDock)
    }

    // ---- edge-hover page switching while dragging ----
    val edge by remember {
        derivedStateOf {
            val d = drag
            if (d == null || !d.moved) 0 else {
                val m = 36f * density.density
                when { d.pointer.x < m -> -1; d.pointer.x > rootSize.width - m -> 1; else -> 0 }
            }
        }
    }
    LaunchedEffect(edge) {
        if (edge == 0) return@LaunchedEffect
        delay(600)
        while (true) {
            // in RTL the page order is mirrored: the left edge leads to the NEXT page
            val dir = if (rtl) -edge else edge
            val next = (pager.currentPage + dir).coerceIn(0, ws.pageCount - 1)
            if (next != pager.currentPage) pager.animateScrollToPage(next)
            delay(800)
        }
    }

    BackHandler(enabled = ws.openFolder != null || ws.menu != null) {
        if (ws.menu != null) ws.menu = null else ws.openFolder = null
    }

    Box(
        modifier
            .fillMaxSize()
            .onGloballyPositioned { rootTopLeft = it.boundsInRoot().topLeft; rootSize = Size(it.size.width.toFloat(), it.size.height.toFloat()) }
            // Keyed on geometry + data: the helper lambdas above close over cell sizes / items, so the recogniser
            // is restarted (only while idle in practice) whenever they change instead of using stale values.
            .pointerInput(pagerRect, dockRect, appByKey, items, p.cols, p.rows, p.dockCount, rtl) {
                workspaceGestures(
                    enabled = { !blockedNow && ws.openFolder == null },
                    onTap = { pt ->
                        if (ws.menu != null) { ws.menu = null; return@workspaceGestures }
                        val t = targetAt(pt) ?: return@workspaceGestures
                        val item = itemAtTarget(t) ?: return@workspaceGestures
                        when (item.kind) {
                            ItemKind.APP -> appByKey[item.appKey]?.let {
                                AppLauncher.launch(context, view, it, androidBounds(cellRect(t, item)))
                            }
                            ItemKind.FOLDER -> ws.openFolder = item.id
                        }
                    },
                    onLongPress = { pt ->
                        val t = targetAt(pt)
                        val item = t?.let(::itemAtTarget)
                        haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                        if (t == null || item == null) { onBgLongNow(pt); false }
                        else {
                            drag = Drag(item, pt, false)
                            val r = cellRect(t, item)
                            ws.menu = ItemMenu(item, r, menuActions(item, appByKey[item.appKey], r))
                            true
                        }
                    },
                    onDrag = { pt ->
                        val d = drag ?: return@workspaceGestures
                        val started = d.moved || (pt - d.pointer).getDistance() > viewConfigurationSlop(density.density)
                        if (started && !d.moved) { ws.menu = null; ws.dragging = true }
                        drag = d.copy(pointer = if (started) pt else d.pointer, moved = started)
                    },
                    onDragEnd = { cancelled ->
                        val d = drag
                        drag = null
                        if (d != null && d.moved) {
                            ws.dragging = false
                            if (!cancelled) {
                                val pt = d.pointer
                                if (pt.y < zoneBottom && d.item.container != Container.FOLDER) {
                                    val isInfoSide = pt.x < rootSize.width / 2 != rtl   // info on the "end" side
                                    if (d.item.kind == ItemKind.APP && isInfoSide) {
                                        appByKey[d.item.appKey]?.let { AppLauncher.appInfo(context, it) }
                                    } else vm.removeItem(d.item.id)
                                } else {
                                    targetAt(pt, d.item.spanX)?.let { t -> vm.moveItem(d.item.id, t.container, t.page, t.x, t.y) }
                                }
                            }
                        }
                    },
                    onVerticalDrag = { start, dy -> onVDragNow(start.y, dy) },
                    onVerticalEnd = { dy, vy, c -> onVEndNow(dy, vy, c) },
                )
            },
    ) {
        Column(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.systemBars)) {
            Box(
                Modifier.weight(1f).fillMaxWidth()
                    .onGloballyPositioned { pagerRect = it.boundsInRoot().translate(-rootTopLeft) },
            ) {
                HorizontalPager(
                    state = pager,
                    userScrollEnabled = drag == null && !blocked,
                    beyondViewportPageCount = 1,
                    modifier = Modifier.fillMaxSize(),
                ) { page ->
                    Box(
                        Modifier.fillMaxSize().graphicsLayer {
                            val off = (pager.currentPage - page) + pager.currentPageOffsetFraction
                            spec.pageGraphics(this, off)
                        },
                    ) {
                        if (page == 0 && spec.headerRows > 0) {
                            Box(Modifier.fillMaxWidth().height(with(density) { (cellH * spec.headerRows).toDp() })) { spec.pageHeader() }
                        }
                        val pageItems = items.filter { it.container == Container.HOME && it.page == page }
                        pageItems.forEach { item ->
                            key(item.id) {
                                val hidden = drag?.let { it.moved && it.item.id == item.id } == true
                                Box(
                                    Modifier
                                        .absoluteOffset {
                                            IntOffset(colToX(item.x, item.spanX, pagerRect.width, cols).roundToInt(), (item.y * cellH).roundToInt())
                                        }
                                        .size(with(density) { (cellW * item.spanX).toDp() }, with(density) { (cellH * item.spanY).toDp() })
                                        .alpha(if (hidden) 0f else 1f),
                                ) {
                                    if (item.kind == ItemKind.WIDGET) {
                                        Box(Modifier.fillMaxSize().padding(4.dp).clip(spec.widgetShape)) {
                                            WidgetView(vm.services.widgets, item.widgetId)
                                        }
                                    } else spec.cell(cellModel(item, false), iconDp, p.showLabels)
                                }
                            }
                        }
                    }
                }
            }
            spec.aboveDock(pager)
            spec.dockContainer {
                Box(
                    Modifier.fillMaxWidth().height(with(density) { (cellH * spec.dockHeightRows).toDp() })
                        .onGloballyPositioned { dockRect = it.boundsInRoot().translate(-rootTopLeft) },
                ) {
                    items.filter { it.container == Container.DOCK && it.x < p.dockCount }.forEach { item ->
                        key(item.id) {
                            val hidden = drag?.let { it.moved && it.item.id == item.id } == true
                            Box(
                                Modifier
                                    .absoluteOffset { IntOffset(colToX(item.x, 1, dockRect.width, p.dockCount).roundToInt(), 0) }
                                    .size(with(density) { slotW.toDp() }, with(density) { (cellH * spec.dockHeightRows).toDp() })
                                    .alpha(if (hidden) 0f else 1f),
                            ) { spec.cell(cellModel(item, true), iconDp, false) }
                        }
                    }
                }
            }
        }

        // ---- drop hint ----
        val d = drag
        if (d != null && d.moved && d.pointer.y >= zoneBottom) {
            targetAt(d.pointer, d.item.spanX)?.let { t ->
                val r = cellRect(t, d.item)
                val occupant = itemAtTarget(t)?.takeIf { it.id != d.item.id }
                val merge = occupant != null && d.item.kind == ItemKind.APP && (occupant.kind == ItemKind.APP || occupant.kind == ItemKind.FOLDER)
                Box(
                    Modifier
                        .absoluteOffset { IntOffset(r.left.roundToInt(), r.top.roundToInt()) }
                        .size(with(density) { r.width.toDp() }, with(density) { r.height.toDp() })
                        .padding(if (merge) 2.dp else 6.dp)
                        .clip(if (merge) CircleShape else RoundedCornerShape(18.dp))
                        .background(spec.dropHint.copy(alpha = if (merge) 0.32f else 0.20f))
                        .then(if (merge) Modifier.border(2.dp, spec.dropHint, CircleShape) else Modifier),
                )
            }
        }

        // ---- remove / info bar ----
        AnimatedVisibility(
            visible = d != null && d.moved,
            enter = slideInVertically { -it } + fadeIn(),
            exit = slideOutVertically { -it } + fadeOut(),
            modifier = Modifier.align(Alignment.TopCenter),
        ) {
            val hot = d?.pointer
            val isApp = d?.item?.kind == ItemKind.APP
            val onInfoSide = hot != null && hot.y < zoneBottom && ((hot.x < rootSize.width / 2) != rtl)
            val onRemoveSide = hot != null && hot.y < zoneBottom && !onInfoSide || (hot != null && hot.y < zoneBottom && !isApp)
            Row(
                Modifier.fillMaxWidth().windowInsetsPadding(WindowInsets.statusBars).padding(horizontal = 16.dp, vertical = 10.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                @Composable
                fun Zone(label: String, icon: androidx.compose.ui.graphics.vector.ImageVector, active: Boolean, mod: Modifier) {
                    Row(
                        mod.height(56.dp).clip(spec.dropBar.shape)
                            .background(if (active) spec.dropBar.activeContainer else spec.dropBar.container),
                        horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically,
                    ) {
                        val c = if (active) spec.dropBar.onActive else spec.dropBar.onContainer
                        Icon(icon, null, tint = c, modifier = Modifier.size(22.dp))
                        Spacer(Modifier.width(8.dp))
                        Text(label, color = c, fontFamily = spec.dropBar.font, fontWeight = FontWeight.Medium, fontSize = 14.sp)
                    }
                }
                Zone(stringResource(R.string.zone_remove), Icons.Rounded.Delete, onRemoveSide, Modifier.weight(1f))
                if (isApp) Zone(stringResource(R.string.zone_info), Icons.Rounded.Info, onInfoSide, Modifier.weight(1f))
            }
        }

        // ---- drag ghost ----
        if (d != null && d.moved) {
            val gw = cellW * d.item.spanX; val gh = cellH * d.item.spanY
            Box(
                Modifier
                    .absoluteOffset { IntOffset((d.pointer.x - gw / 2).roundToInt(), (d.pointer.y - gh / 2).roundToInt()) }
                    .size(with(density) { gw.toDp() }, with(density) { gh.toDp() })
                    .graphicsLayer { scaleX = 1.14f; scaleY = 1.14f; alpha = 0.95f },
            ) {
                if (d.item.kind == ItemKind.WIDGET) {
                    Box(Modifier.fillMaxSize().padding(4.dp).clip(spec.widgetShape).background(spec.dropHint.copy(alpha = .35f)))
                } else spec.cell(cellModel(d.item, d.item.container == Container.DOCK), iconDp, false)
            }
        }

        // ---- long-press menu ----
        ws.menu?.let { m -> spec.menu(m) { ws.menu = null } }

        // ---- folder ----
        val openId = ws.openFolder
        val folder = openId?.let { id -> items.firstOrNull { it.id == id && it.kind == ItemKind.FOLDER } }
        if (openId != null && folder == null) ws.openFolder = null
        AnimatedVisibility(visible = folder != null, enter = fadeIn(), exit = fadeOut()) {
            if (folder != null) {
                val kids = items.filter { it.container == Container.FOLDER && it.parent == folder.id }.sortedBy { it.x }
                val origin = run {
                    val r = cellRect(
                        Target(folder.container, folder.page, folder.x, folder.y), folder
                    )
                    Offset((r.center.x / rootSize.width.coerceAtLeast(1f)), (r.center.y / rootSize.height.coerceAtLeast(1f)))
                }
                FolderOverlay(
                    vm = vm, folder = folder, children = kids.mapNotNull { k -> appByKey[k.appKey]?.let { k to it } },
                    style = spec.folder, originFraction = origin, iconSize = iconDp,
                    cell = spec.cell, onClose = { ws.openFolder = null },
                )
            }
        }
    }
}

private fun viewConfigurationSlop(density: Float) = 8f * density
