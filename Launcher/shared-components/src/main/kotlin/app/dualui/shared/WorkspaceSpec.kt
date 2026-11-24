package app.dualui.shared

import androidx.compose.foundation.pager.PagerState
import androidx.compose.runtime.Composable
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.GraphicsLayerScope
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.Dp
import app.dualui.core.model.AppInfo
import app.dualui.core.model.HomeItem

/** What a skin draws inside one grid cell. */
class CellModel(
    val item: HomeItem,
    val app: AppInfo?,
    /** Up to the first few apps inside a folder (for the folder preview icon). */
    val folderApps: List<AppInfo>,
    val inDock: Boolean,
)

class MenuAction(val label: String, val icon: ImageVector, val destructive: Boolean = false, val run: () -> Unit)

/** Long-press menu request. [anchor] is in the workspace's own coordinate space; the skin decides how to present it. */
class ItemMenu(val item: HomeItem, val anchor: Rect, val actions: List<MenuAction>)

class FolderStyle(
    val shape: Shape,
    val container: Color,
    val onContainer: Color,
    val scrim: Color,
    val font: FontFamily,
    val columns: Int = 3,
    val widthFraction: Float = 0.9f,
    /** Scale the card starts from when opening (smaller = more dramatic zoom out of the folder icon). */
    val startScale: Float = 0.5f,
)

class DropBarStyle(
    val container: Color,
    val onContainer: Color,
    val activeContainer: Color,
    val onActive: Color,
    val shape: Shape,
    val font: FontFamily,
)

/**
 * Everything that makes a workspace look and feel like Samsung or Pixel, injected into the shared grid / drag engine.
 */
class WorkspaceSpec(
    val headerRows: Int,
    val pageHeader: @Composable () -> Unit,
    val cell: @Composable (CellModel, Dp, Boolean) -> Unit,
    val widgetShape: Shape,
    val dockContainer: @Composable (@Composable () -> Unit) -> Unit,
    val aboveDock: @Composable (PagerState) -> Unit,
    val pageGraphics: GraphicsLayerScope.(pageOffset: Float) -> Unit,
    val menu: @Composable (ItemMenu, () -> Unit) -> Unit,
    val folder: FolderStyle,
    val dropBar: DropBarStyle,
    val dropHint: Color,
    /** Cell height share used by the dock (1 = same as a grid row). */
    val dockHeightRows: Float = 1f,
)
