package app.dualui.core.engine

import app.dualui.core.model.Container
import app.dualui.core.model.HomeItem
import app.dualui.core.model.ItemKind

/** Pure grid maths shared by all interfaces (no Android dependencies: easy to test). */
object HomeLayoutEngine {

    /** Rows usable on [page]; page 0 loses [headerRows] rows to the skin's built-in header widget. */
    fun minRow(page: Int, headerRows: Int) = if (page == 0) headerRows else 0

    fun rectsOverlap(a: HomeItem, x: Int, y: Int, sx: Int, sy: Int) =
        a.x < x + sx && x < a.x + a.spanX && a.y < y + sy && y < a.y + a.spanY

    fun fits(
        items: List<HomeItem>, container: Int, page: Int, x: Int, y: Int, sx: Int, sy: Int,
        cols: Int, rows: Int, dockCount: Int, headerRows: Int, ignoreId: Long = -1,
    ): Boolean {
        if (x < 0 || y < 0) return false
        if (container == Container.DOCK) {
            if (x + sx > dockCount || y != 0 || sy != 1) return false
        } else {
            if (x + sx > cols || y + sy > rows || y < minRow(page, headerRows)) return false
        }
        return items.none {
            it.id != ignoreId && it.container == container && (container == Container.DOCK || it.page == page) &&
                rectsOverlap(it, x, y, sx, sy)
        }
    }

    fun itemAt(items: List<HomeItem>, container: Int, page: Int, x: Int, y: Int, ignoreId: Long = -1): HomeItem? =
        items.firstOrNull {
            it.id != ignoreId && it.container == container && (container == Container.DOCK || it.page == page) &&
                x >= it.x && x < it.x + it.spanX && y >= it.y && y < it.y + it.spanY
        }

    /** First free area scanning pages from [startPage]; returns (page, x, y) or null when [maxPages] are exhausted. */
    fun findFree(
        items: List<HomeItem>, sx: Int, sy: Int, cols: Int, rows: Int, dockCount: Int, headerRows: Int,
        startPage: Int = 0, maxPages: Int = 12,
    ): Triple<Int, Int, Int>? {
        for (offset in 0 until maxPages) {
            val page = (startPage + offset) % maxPages
            for (y in minRow(page, headerRows)..(rows - sy)) for (x in 0..(cols - sx)) {
                if (fits(items, Container.HOME, page, x, y, sx, sy, cols, rows, dockCount, headerRows)) return Triple(page, x, y)
            }
        }
        return null
    }

    /** Nearest free single cell to (x,y) on the same page (used when dropping onto an occupied widget etc.). */
    fun nearestFree(
        items: List<HomeItem>, container: Int, page: Int, x: Int, y: Int, sx: Int, sy: Int,
        cols: Int, rows: Int, dockCount: Int, headerRows: Int, ignoreId: Long,
    ): Pair<Int, Int>? {
        val maxX = if (container == Container.DOCK) dockCount else cols
        val maxY = if (container == Container.DOCK) 1 else rows
        return (0 until maxY).flatMap { yy -> (0 until maxX).map { xx -> xx to yy } }
            .filter { (xx, yy) -> fits(items, container, page, xx, yy, sx, sy, cols, rows, dockCount, headerRows, ignoreId) }
            .minByOrNull { (xx, yy) -> (xx - x) * (xx - x) + (yy - y) * (yy - y) }
    }

    /**
     * Re-validates the whole layout after a grid / dock / skin-header change. Items that no longer fit or collide
     * are moved to the first free slot instead of being deleted, so nothing is ever lost. Returns changed items.
     */
    fun normalize(items: List<HomeItem>, cols: Int, rows: Int, dockCount: Int, headerRows: Int): List<HomeItem> {
        val placed = ArrayList<HomeItem>()
        val changed = ArrayList<HomeItem>()
        val top = items.filter { it.container != Container.FOLDER }
            .sortedWith(compareBy({ it.container }, { it.page }, { it.y }, { it.x }))
        for (it in top) {
            val spanX = it.spanX.coerceAtMost(if (it.container == Container.DOCK) 1 else cols)
            val spanY = it.spanY.coerceAtMost(if (it.container == Container.DOCK) 1 else (rows - headerRows).coerceAtLeast(1))
            val ok = fits(placed, it.container, it.page, it.x, it.y, spanX, spanY, cols, rows, dockCount, headerRows)
            if (ok) {
                val n = it.copy(spanX = spanX, spanY = spanY)
                placed += n; if (n != it) changed += n
            } else {
                val free = if (it.container == Container.DOCK)
                    nearestFree(placed, Container.DOCK, 0, it.x, 0, 1, 1, cols, rows, dockCount, headerRows, it.id)
                        ?.let { (x, y) -> Triple(0, x, y) }
                else null
                val dest = free?.let { f -> Triple(f.first, f.second, f.third) }
                if (dest != null) {
                    val n = it.copy(page = dest.first, x = dest.second, y = dest.third, spanX = 1, spanY = 1)
                    placed += n; changed += n
                } else {
                    val h = findFree(placed, spanX, spanY, cols, rows, dockCount, headerRows) ?: continue
                    val n = it.copy(container = Container.HOME, page = h.first, x = h.second, y = h.third, spanX = spanX, spanY = spanY)
                    placed += n; changed += n
                }
            }
        }
        return changed
    }

    fun pageCount(items: List<HomeItem>): Int =
        (items.filter { it.container == Container.HOME }.maxOfOrNull { it.page } ?: 0) + 1

    fun isFolder(i: HomeItem) = i.kind == ItemKind.FOLDER
}
