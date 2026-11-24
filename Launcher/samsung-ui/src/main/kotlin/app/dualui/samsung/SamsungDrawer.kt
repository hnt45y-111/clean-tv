package app.dualui.samsung

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.dualui.core.engine.AppLauncher
import app.dualui.core.engine.LauncherViewModel
import app.dualui.core.engine.SearchEngine
import app.dualui.core.model.AppInfo
import app.dualui.core.R as CoreR
import app.dualui.shared.*
import app.dualui.shared.R as SharedR

/** One UI app drawer: paged grid, system-apps card on top, search pill anchored at the bottom (thumb reach). */
@Composable
fun SamsungDrawer(vm: LauncherViewModel, reveal: Reveal, dark: Boolean) {
    if (!reveal.visible) return
    val p = reveal.progress
    val apps by vm.apps.collectAsState()
    val prefs by vm.prefs.collectAsState()
    val cols = (prefs?.cols ?: 4).coerceIn(4, 6)
    var query by remember { mutableStateOf("") }
    var menu by remember { mutableStateOf<Pair<AppInfo, Rect>?>(null) }
    val results = remember(query, apps) { SearchEngine.search(query, apps) }
    val ink = MaterialTheme.colorScheme.onSurface
    val scrim = if (dark) Color(0xF2101013) else Color(0xF2F5F6F9)
    val ctx = LocalContext.current

    LaunchedEffect(reveal.isOpen) { if (!reveal.isOpen) query = "" }

    Box(
        Modifier.fillMaxSize()
            .graphicsLayer { alpha = p; scaleX = 0.93f + 0.07f * p; scaleY = 0.93f + 0.07f * p }
            .background(scrim),
    ) {
        Column(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.systemBars).imePadding()) {
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 22.dp, vertical = 14.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(stringResource(R.string.sm_apps_title), color = ink, fontSize = 22.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                Icon(
                    Icons.Rounded.KeyboardArrowDown, null, tint = ink,
                    modifier = Modifier.size(36.dp).clip(CircleShape).clickable { reveal.close() }.padding(4.dp),
                )
            }
            if (query.isBlank()) {
                Box(
                    Modifier.padding(horizontal = 16.dp).fillMaxWidth().clip(SamsungCard)
                        .background(MaterialTheme.colorScheme.surface.copy(alpha = if (dark) 0.8f else 0.9f)).padding(vertical = 8.dp),
                ) {
                    SystemAppsPanel(
                        SystemAppsStyle(RoundedCornerShape(16.dp), MaterialTheme.colorScheme.surfaceVariant, MaterialTheme.colorScheme.primary,
                            ink, app.dualui.shared.TajawalFamily),
                    )
                }
                Spacer(Modifier.height(6.dp))
                BoxWithConstraints(
                    Modifier.weight(1f).fillMaxWidth().pointerInput(Unit) {
                        var total = 0f
                        detectVerticalDragGestures(
                            onDragStart = { total = 0f },
                            onDragEnd = { if (total > 140f) reveal.close() },
                        ) { _, dy -> total += dy }
                    },
                ) {
                    val rowH = 108.dp
                    val rows = (maxHeight / rowH).toInt().coerceAtLeast(3)
                    val perPage = cols * rows
                    val pages = apps.chunked(perPage)
                    val pager = rememberPagerState { pages.size.coerceAtLeast(1) }
                    Column(Modifier.fillMaxSize()) {
                        HorizontalPager(pager, Modifier.weight(1f), beyondViewportPageCount = 1) { page ->
                            val list = pages.getOrElse(page) { emptyList() }
                            Column(Modifier.fillMaxSize().padding(horizontal = 10.dp)) {
                                list.chunked(cols).forEach { row ->
                                    Row(Modifier.fillMaxWidth().height(rowH)) {
                                        row.forEach { app ->
                                            SamsungAppTile(
                                                app, 56.dp, ink, onLongClick = { b -> menu = app to Rect(b.left.toFloat(), b.top.toFloat(), b.right.toFloat(), b.bottom.toFloat()) },
                                                modifier = Modifier.weight(1f),
                                            )
                                        }
                                        repeat(cols - row.size) { Spacer(Modifier.weight(1f)) }
                                    }
                                }
                            }
                        }
                        SamsungPageIndicator(pager, pages.size.coerceAtLeast(1), ink)
                    }
                }
            } else {
                LazyColumn(Modifier.weight(1f).fillMaxWidth(), contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp)) {
                    if (results.isEmpty()) item {
                        Text(stringResource(SharedR.string.search_no_results), color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(20.dp))
                    }
                    items(results, key = { it.key }) { app ->
                        val view = LocalView.current
                        Row(
                            Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).clickable { AppLauncher.launch(ctx, view, app, null) }.padding(10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            AppIcon(app, 46.dp, SamsungIconShape)
                            Spacer(Modifier.width(14.dp))
                            Text(app.label, color = ink, fontSize = 16.sp, fontWeight = FontWeight.Medium)
                        }
                    }
                    item {
                        Row(
                            Modifier.fillMaxWidth().padding(top = 6.dp).clip(RoundedCornerShape(20.dp))
                                .clickable { AppLauncher.webSearch(ctx, query) }.padding(10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Box(Modifier.size(46.dp).clip(SamsungIconShape).background(MaterialTheme.colorScheme.primary), contentAlignment = Alignment.Center) {
                                Icon(Icons.Rounded.Public, null, tint = Color.White)
                            }
                            Spacer(Modifier.width(14.dp))
                            Text(stringResource(CoreR.string.search_web_prefix, query), color = ink, fontSize = 15.sp)
                        }
                    }
                }
            }
            // search pill: bottom oriented
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 10.dp).height(54.dp)
                    .clip(RoundedCornerShape(27.dp)).background(MaterialTheme.colorScheme.surface)
                    .padding(horizontal = 18.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(Icons.Rounded.Search, null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.width(12.dp))
                BasicTextField(
                    value = query, onValueChange = { query = it }, singleLine = true,
                    textStyle = TextStyle(color = ink, fontSize = 16.sp, fontFamily = app.dualui.shared.TajawalFamily),
                    cursorBrush = SolidColor(MaterialTheme.colorScheme.primary),
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                    keyboardActions = KeyboardActions(onSearch = {
                        results.firstOrNull()?.let { AppLauncher.launch(ctx, null, it, null) }
                    }),
                    modifier = Modifier.weight(1f),
                    decorationBox = { inner ->
                        Box(contentAlignment = Alignment.CenterStart) {
                            if (query.isEmpty()) Text(stringResource(R.string.sm_search_placeholder), color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 16.sp)
                            inner()
                        }
                    },
                )
                if (query.isNotEmpty()) Icon(Icons.Rounded.Close, null, tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(28.dp).clip(CircleShape).clickable { query = "" }.padding(2.dp))
            }
        }
        menu?.let { (app, r) ->
            SamsungMenu(
                r,
                listOf(
                    MenuAction(ctx.getString(SharedR.string.act_add_home), Icons.Rounded.AddHome) { vm.addToHome(app); reveal.close() },
                    MenuAction(ctx.getString(SharedR.string.act_app_info), Icons.Rounded.Info) { AppLauncher.appInfo(ctx, app) },
                    MenuAction(ctx.getString(SharedR.string.act_uninstall), Icons.Rounded.Delete, true) { AppLauncher.uninstall(ctx, app) },
                ),
            ) { menu = null }
        }
    }
}
