package app.dualui.pixel

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
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
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.dualui.core.engine.AppLauncher
import app.dualui.core.engine.LauncherViewModel
import app.dualui.core.engine.SearchEngine
import app.dualui.core.model.AppInfo
import app.dualui.core.R as CoreR
import app.dualui.shared.*
import app.dualui.core.engine.Reveal
import app.dualui.shared.R as SharedR

/** Pixel "All apps": a bottom sheet that slides up with the finger, search on top, long scrolling grid. */
@Composable
fun PixelDrawer(vm: LauncherViewModel, reveal: Reveal, focusSearch: Boolean, onFocusConsumed: () -> Unit) {
    if (!reveal.visible) return
    val p = reveal.progress
    val apps by vm.apps.collectAsState()
    val prefs by vm.prefs.collectAsState()
    val cols = (prefs?.cols ?: 4).coerceIn(4, 5)
    var query by remember { mutableStateOf("") }
    var menu by remember { mutableStateOf<Pair<AppInfo, Rect>?>(null) }
    val results = remember(query, apps) { SearchEngine.search(query, apps) }
    val cs = MaterialTheme.colorScheme
    val ctx = LocalContext.current
    val focus = remember { FocusRequester() }
    LaunchedEffect(focusSearch, reveal.isOpen) {
        if (focusSearch && reveal.isOpen) { kotlinx.coroutines.delay(250); try { focus.requestFocus() } catch (_: Exception) {}; onFocusConsumed() }
    }
    LaunchedEffect(reveal.isOpen) { if (!reveal.isOpen) query = "" }

    Box(Modifier.fillMaxSize()) {
        Box(Modifier.fillMaxSize().graphicsLayer { alpha = p * 0.45f }.background(Color.Black)
            .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) { reveal.close() })
        Column(
            Modifier.fillMaxSize()
                .graphicsLayer { translationY = (1f - p) * size.height }
                .padding(top = 28.dp)
                .clip(RoundedCornerShape(topStart = 32.dp, topEnd = 32.dp))
                .background(cs.surfaceContainer)
                .windowInsetsPadding(WindowInsets.navigationBars).imePadding(),
        ) {
            // drag handle: pull down to close
            Box(
                Modifier.fillMaxWidth().height(34.dp).pointerInput(Unit) {
                    var total = 0f
                    detectVerticalDragGestures(onDragStart = { total = 0f }, onDragEnd = { if (total > 120f) reveal.close() }) { _, dy -> total += dy }
                },
                contentAlignment = Alignment.Center,
            ) { Box(Modifier.size(36.dp, 4.dp).clip(CircleShape).background(cs.onSurfaceVariant.copy(alpha = 0.5f))) }

            Row(
                Modifier.fillMaxWidth().padding(horizontal = 16.dp).height(52.dp).clip(RoundedCornerShape(26.dp))
                    .background(cs.surfaceContainerHighest).padding(horizontal = 16.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(Icons.Rounded.Search, null, tint = cs.onSurfaceVariant)
                Spacer(Modifier.width(12.dp))
                BasicTextField(
                    value = query, onValueChange = { query = it }, singleLine = true,
                    textStyle = TextStyle(color = cs.onSurface, fontSize = 16.sp, fontFamily = PlexArabicFamily),
                    cursorBrush = SolidColor(cs.primary),
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                    keyboardActions = KeyboardActions(onSearch = { results.firstOrNull()?.let { AppLauncher.launch(ctx, null, it, null) } }),
                    modifier = Modifier.weight(1f).focusRequester(focus),
                    decorationBox = { inner ->
                        Box(contentAlignment = Alignment.CenterStart) {
                            if (query.isEmpty()) Text(stringResource(R.string.px_search_apps), color = cs.onSurfaceVariant, fontSize = 16.sp)
                            inner()
                        }
                    },
                )
                if (query.isNotEmpty()) Icon(Icons.Rounded.Close, null, tint = cs.onSurfaceVariant,
                    modifier = Modifier.size(28.dp).clip(CircleShape).clickable { query = "" }.padding(3.dp))
            }
            Spacer(Modifier.height(10.dp))
            if (query.isBlank()) {
                // "system apps" as a Pixel chip row
                SystemAppsPanel(
                    SystemAppsStyle(CircleShape, cs.primaryContainer, cs.onPrimaryContainer, cs.onSurface, PlexArabicFamily),
                    Modifier.padding(bottom = 6.dp),
                )
                LazyVerticalGrid(
                    columns = GridCells.Fixed(cols), modifier = Modifier.weight(1f).fillMaxWidth().padding(horizontal = 8.dp),
                    contentPadding = PaddingValues(bottom = 24.dp),
                ) {
                    items(apps, key = { it.key + it.user.hashCode() }) { app ->
                        PixelAppTile(app, 58.dp, cs.onSurface, onLongClick = { b ->
                            menu = app to Rect(b.left.toFloat(), b.top.toFloat(), b.right.toFloat(), b.bottom.toFloat())
                        })
                    }
                }
            } else {
                LazyColumn(Modifier.weight(1f).fillMaxWidth(), contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp)) {
                    if (results.isEmpty()) item {
                        Text(stringResource(SharedR.string.search_no_results), color = cs.onSurfaceVariant, modifier = Modifier.padding(20.dp))
                    }
                    items(results, key = { it.key }) { app ->
                        val view = LocalView.current
                        Row(
                            Modifier.fillMaxWidth().clip(RoundedCornerShape(24.dp)).clickable { AppLauncher.launch(ctx, view, app, null) }.padding(10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            AppIcon(app, 44.dp, PixelIconShape, themed = LocalThemedIcons.current)
                            Spacer(Modifier.width(16.dp))
                            Text(app.label, color = cs.onSurface, fontSize = 16.sp)
                        }
                    }
                    item {
                        Row(
                            Modifier.fillMaxWidth().padding(top = 6.dp).clip(RoundedCornerShape(24.dp))
                                .clickable { AppLauncher.webSearch(ctx, query) }.padding(10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Box(Modifier.size(44.dp).clip(CircleShape).background(cs.primaryContainer), contentAlignment = Alignment.Center) {
                                Icon(Icons.Rounded.Public, null, tint = cs.onPrimaryContainer)
                            }
                            Spacer(Modifier.width(16.dp))
                            Text(stringResource(CoreR.string.search_web_prefix, query), color = cs.onSurface, fontSize = 15.sp)
                        }
                    }
                }
            }
        }
        menu?.let { (app, r) ->
            PixelMenu(
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
