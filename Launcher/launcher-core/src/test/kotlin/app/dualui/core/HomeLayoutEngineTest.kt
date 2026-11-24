package app.dualui.core

import app.dualui.core.engine.HomeLayoutEngine
import app.dualui.core.engine.SearchEngine
import app.dualui.core.model.Container
import app.dualui.core.model.HomeItem
import app.dualui.core.model.ItemKind
import org.junit.Assert.*
import org.junit.Test

class HomeLayoutEngineTest {
    private fun app(id: Long, page: Int, x: Int, y: Int, container: Int = Container.HOME) =
        HomeItem(id = id, kind = ItemKind.APP, container = container, page = page, x = x, y = y, pkg = "p$id", cls = "c")

    @Test fun headerRowsAreReservedOnFirstPageOnly() {
        assertFalse(HomeLayoutEngine.fits(emptyList(), Container.HOME, 0, 0, 0, 1, 1, 4, 6, 4, headerRows = 2))
        assertTrue(HomeLayoutEngine.fits(emptyList(), Container.HOME, 0, 0, 2, 1, 1, 4, 6, 4, headerRows = 2))
        assertTrue(HomeLayoutEngine.fits(emptyList(), Container.HOME, 1, 0, 0, 1, 1, 4, 6, 4, headerRows = 2))
    }

    @Test fun occupiedCellDoesNotFit() {
        val items = listOf(app(1, 0, 1, 3))
        assertFalse(HomeLayoutEngine.fits(items, Container.HOME, 0, 1, 3, 1, 1, 4, 6, 4, 0))
        assertTrue(HomeLayoutEngine.fits(items, Container.HOME, 0, 1, 3, 1, 1, 4, 6, 4, 0, ignoreId = 1))
    }

    @Test fun widgetSpanCollidesWithApp() {
        val items = listOf(app(1, 0, 2, 3))
        assertFalse(HomeLayoutEngine.fits(items, Container.HOME, 0, 1, 2, 3, 2, 4, 6, 4, 0))
    }

    @Test fun findFreeSkipsToNextPageWhenFull() {
        val full = (0 until 4).flatMap { x -> (0 until 6).map { y -> app((x * 6 + y + 1).toLong(), 0, x, y) } }
        val free = HomeLayoutEngine.findFree(full, 1, 1, 4, 6, 4, 0, startPage = 0)
        assertEquals(1, free!!.first)
    }

    @Test fun dockSlotsAreBoundedByDockCount() {
        assertTrue(HomeLayoutEngine.fits(emptyList(), Container.DOCK, 0, 3, 0, 1, 1, 4, 6, 4, 0))
        assertFalse(HomeLayoutEngine.fits(emptyList(), Container.DOCK, 0, 4, 0, 1, 1, 4, 6, 4, 0))
    }

    @Test fun normalizeNeverLosesItemsWhenGridShrinks() {
        val items = listOf(app(1, 0, 5, 5), app(2, 0, 0, 0), app(3, 0, 0, 0))
        val changed = HomeLayoutEngine.normalize(items, cols = 4, rows = 5, dockCount = 4, headerRows = 1)
        val result = items.map { i -> changed.firstOrNull { it.id == i.id } ?: i }
        assertEquals(3, result.size)
        // all inside the grid, none overlapping, none inside the header row of page 0
        result.forEach { assertTrue(it.x in 0..3 && it.y in 0..4); if (it.page == 0) assertTrue(it.y >= 1) }
        assertEquals(3, result.map { Triple(it.page, it.x, it.y) }.toSet().size)
    }

    @Test fun normalizeMovesDockOverflowToHome() {
        val items = listOf(app(1, 0, 0, 0, Container.DOCK), app(2, 0, 3, 0, Container.DOCK))
        val changed = HomeLayoutEngine.normalize(items, 4, 6, dockCount = 3, headerRows = 0)
        val moved = changed.first { it.id == 2L }
        assertTrue(moved.container == Container.HOME || moved.x < 3)
    }

    @Test fun arabicSearchIgnoresDiacriticsAndAlefForms() {
        assertEquals(SearchEngine.normalize("أحمد"), SearchEngine.normalize("احمد"))
        assertEquals(SearchEngine.normalize("مَكتَبة"), SearchEngine.normalize("مكتبه"))
    }
}
