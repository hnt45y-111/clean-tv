package app.dualui.shared

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.spring
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.dualui.core.engine.AppLauncher
import app.dualui.core.engine.LauncherViewModel
import app.dualui.core.model.AppInfo
import app.dualui.core.model.HomeItem
import app.dualui.core.R as CoreR

/** Opened folder: title editor + grid of its apps. Look comes from the skin's [FolderStyle]; behaviour is shared. */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun FolderOverlay(
    vm: LauncherViewModel,
    folder: HomeItem,
    children: List<Pair<HomeItem, AppInfo>>,
    style: FolderStyle,
    originFraction: Offset,
    iconSize: Dp,
    cell: @Composable (CellModel, Dp, Boolean) -> Unit,
    onClose: () -> Unit,
) {
    val context = LocalContext.current
    val view = LocalView.current
    val focus = LocalFocusManager.current
    var name by remember(folder.id) { mutableStateOf(folder.title) }
    val latestName by rememberUpdatedState(name)
    DisposableEffect(folder.id) {
        onDispose { if (latestName.trim() != folder.title) vm.renameFolder(folder.id, latestName) }
    }
    val progress = remember { Animatable(0f) }
    LaunchedEffect(Unit) { progress.animateTo(1f, spring(dampingRatio = 0.78f, stiffness = 380f)) }

    Box(Modifier.fillMaxSize()) {
        Box(
            Modifier.fillMaxSize()
                .graphicsLayer { alpha = progress.value.coerceIn(0f, 1f) }
                .background(style.scrim)
                .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) { focus.clearFocus(); onClose() },
        )
        Box(
            Modifier.fillMaxSize().graphicsLayer {
                val s = style.startScale + (1f - style.startScale) * progress.value
                scaleX = s; scaleY = s
                alpha = progress.value.coerceIn(0f, 1f)
                transformOrigin = TransformOrigin(originFraction.x, originFraction.y)
            },
            contentAlignment = Alignment.Center,
        ) {
            Column(
                Modifier.fillMaxWidth(style.widthFraction).heightIn(max = 520.dp)
                    .clip(style.shape).background(style.container)
                    .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) { focus.clearFocus() }
                    .padding(horizontal = 18.dp, vertical = 16.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                BasicTextField(
                    value = name, onValueChange = { name = it.take(24) },
                    singleLine = true,
                    textStyle = TextStyle(color = style.onContainer, fontFamily = style.font, fontSize = 20.sp, fontWeight = FontWeight.Medium, textAlign = TextAlign.Center),
                    cursorBrush = SolidColor(style.onContainer),
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                    keyboardActions = KeyboardActions(onDone = { focus.clearFocus() }),
                    modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
                    decorationBox = { inner ->
                        Box(contentAlignment = Alignment.Center) {
                            if (name.isEmpty()) Text(stringResource(R.string.folder_name_hint), color = style.onContainer.copy(alpha = .5f),
                                fontFamily = style.font, fontSize = 20.sp)
                            inner()
                        }
                    },
                )
                Spacer(Modifier.height(8.dp))
                LazyVerticalGrid(
                    columns = GridCells.Fixed(style.columns),
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    items(children, key = { it.first.id }) { (item, app) ->
                        var menu by remember { mutableStateOf(false) }
                        var bounds by remember { mutableStateOf(android.graphics.Rect()) }
                        Box(
                            Modifier.height(iconSize + 42.dp)
                                .onGloballyPositioned { c -> c.boundsInRoot().let { bounds = android.graphics.Rect(it.left.toInt(), it.top.toInt(), it.right.toInt(), it.bottom.toInt()) } }
                                .combinedClickable(
                                    interactionSource = remember { MutableInteractionSource() }, indication = null,
                                    onClick = { AppLauncher.launch(context, view, app, bounds); onClose() },
                                    onLongClick = { menu = true },
                                ),
                        ) {
                            cell(CellModel(item, app, emptyList(), false), iconSize, true)
                            DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
                                DropdownMenuItem(text = { Text(stringResource(R.string.act_remove_from_folder), fontFamily = style.font) },
                                    onClick = { menu = false; vm.removeFromFolder(item.id); if (children.size <= 2) onClose() })
                                DropdownMenuItem(text = { Text(stringResource(R.string.act_app_info), fontFamily = style.font) },
                                    onClick = { menu = false; AppLauncher.appInfo(context, app) })
                            }
                        }
                    }
                }
            }
        }
    }
}
