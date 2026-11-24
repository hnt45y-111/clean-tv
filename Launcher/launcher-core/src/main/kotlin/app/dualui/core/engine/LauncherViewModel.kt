package app.dualui.core.engine

import android.app.Application
import android.appwidget.AppWidgetProviderInfo
import android.content.ComponentName
import android.content.Intent
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import app.dualui.core.R
import app.dualui.core.data.SystemApp
import app.dualui.core.model.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

sealed interface LauncherEvent {
    /** The user must approve binding this widget (system dialog). */
    data class BindWidget(val id: Int, val provider: ComponentName) : LauncherEvent
    data class ConfigureWidget(val id: Int) : LauncherEvent
    data class Message(val resId: Int) : LauncherEvent
}

/**
 * The shared launcher engine. All persistent state (layout in Room, settings in DataStore) lives here, independent
 * of the active skin, which is why switching interfaces never touches the user's shortcuts or folders.
 */
class LauncherViewModel(application: Application) : AndroidViewModel(application) {
    val services = LauncherServices.get(application)
    private val dao = services.db.home()
    private val repo = services.prefs

    /** null until DataStore delivered its first value. */
    val prefs: StateFlow<LauncherPrefs?> = repo.prefs.stateIn(viewModelScope, SharingStarted.Eagerly, null)
    val apps: StateFlow<List<AppInfo>> = services.apps.apps
    val items: StateFlow<List<HomeItem>> =
        dao.observeAll().stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())

    private val _events = MutableSharedFlow<LauncherEvent>(extraBufferCapacity = 8)
    val events: SharedFlow<LauncherEvent> = _events.asSharedFlow()

    /** Fired when the user presses Home while the launcher is already showing: skins close overlays and go to page 0. */
    private val _homePressed = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    val homePressed: SharedFlow<Unit> = _homePressed.asSharedFlow()
    fun onHomePressed() { _homePressed.tryEmit(Unit) }

    /** Set by the active skin; page 0 reserves this many rows for its built-in header. */
    @Volatile var headerRows: Int = 0
        private set
    @Volatile var currentPage: Int = 0

    private var pendingWidgetProvider: AppWidgetProviderInfo? = null

    init {
        viewModelScope.launch {
            val loaded = services.apps.loaded.first { it }
            val p = prefs.filterNotNull().first()
            if (!p.seeded) seed(p)
            // drop shortcuts whose app was uninstalled
            services.apps.apps.collect { current ->
                if (!loaded) return@collect
                val keys = current.mapTo(HashSet()) { it.key }
                val dead = dao.all().filter { it.kind == ItemKind.APP && it.appKey !in keys }
                if (dead.isNotEmpty() && current.isNotEmpty()) {
                    dao.delete(dead.map { it.id }); cleanupFolders()
                }
            }
        }
    }

    // ---------- preferences ----------
    fun setSkin(id: String) = launchIo { repo.setSkin(id) }
    fun finishSetup() = launchIo { repo.setSetupDone() }
    fun setIconScale(v: Float) = launchIo { repo.setIconScale(v) }
    fun setLabels(v: Boolean) = launchIo { repo.setLabels(v) }
    fun setThemedIcons(v: Boolean) = launchIo { repo.setThemedIcons(v) }
    fun setThemeMode(m: ThemeMode) = launchIo { repo.setThemeMode(m) }
    fun setGrid(cols: Int, rows: Int) = launchIo { repo.setGrid(cols, rows); reflowNow(cols, rows, prefs.value?.dockCount ?: 4) }
    fun setDock(count: Int) = launchIo { repo.setDock(count); reflowNow(prefs.value?.cols ?: 4, prefs.value?.rows ?: 6, count) }

    /** Called by the active skin so the layout adapts to its header; never loses items. */
    fun applyHeaderRows(n: Int) {
        if (headerRows == n) return
        headerRows = n
        launchIo { val p = prefs.filterNotNull().first(); reflowNow(p.cols, p.rows, p.dockCount) }
    }

    private suspend fun reflowNow(cols: Int, rows: Int, dock: Int) {
        val changed = HomeLayoutEngine.normalize(dao.all(), cols, rows, dock, headerRows)
        if (changed.isNotEmpty()) dao.update(changed)
    }

    // ---------- seeding ----------
    private suspend fun seed(p: LauncherPrefs) {
        val pm = getApplication<Application>().packageManager
        fun resolvePkg(i: Intent): AppInfo? {
            val pkg = pm.resolveActivity(i, 0)?.activityInfo?.packageName ?: return null
            return services.apps.findByPackage(pkg)
        }
        val used = HashSet<String>()
        val dock = SystemApp.defaultDockIntents().mapNotNull(::resolvePkg).filter { used.add(it.key) }.take(p.dockCount)
        dock.forEachIndexed { i, a -> dao.insert(HomeItem(kind = ItemKind.APP, container = Container.DOCK, x = i, pkg = a.packageName, cls = a.activity)) }
        val home = (SystemApp.defaultHomeIntents().mapNotNull(::resolvePkg) + services.apps.apps.value)
            .filter { used.add(it.key) }.take(8)
        val all = dao.all()
        var snapshot = all
        for (a in home) {
            val free = HomeLayoutEngine.findFree(snapshot, 1, 1, p.cols, p.rows, p.dockCount, 2) ?: break
            val item = HomeItem(kind = ItemKind.APP, container = Container.HOME, page = free.first, x = free.second, y = free.third, pkg = a.packageName, cls = a.activity)
            val id = dao.insert(item)
            snapshot = snapshot + item.copy(id = id)
        }
        repo.setSeeded()
    }

    // ---------- layout operations ----------
    fun addToHome(app: AppInfo) = launchIo {
        val p = prefs.filterNotNull().first()
        val all = dao.all()
        val free = HomeLayoutEngine.findFree(all, 1, 1, p.cols, p.rows, p.dockCount, headerRows, currentPage)
        if (free == null) { _events.tryEmit(LauncherEvent.Message(R.string.home_full)); return@launchIo }
        dao.insert(HomeItem(kind = ItemKind.APP, container = Container.HOME, page = free.first, x = free.second, y = free.third, pkg = app.packageName, cls = app.activity))
    }

    fun moveItem(id: Long, container: Int, page: Int, x: Int, y: Int) = launchIo {
        val p = prefs.filterNotNull().first()
        val all = dao.all()
        val moving = all.firstOrNull { it.id == id } ?: return@launchIo
        val placed = all.filter { it.container != Container.FOLDER && it.id != id }
        val dropPage = if (container == Container.DOCK) 0 else page
        fun fits(px: Int, py: Int) = HomeLayoutEngine.fits(placed, container, dropPage, px, py, moving.spanX.coerceAtMost(if (container == Container.DOCK) 1 else p.cols), moving.spanY, p.cols, p.rows, p.dockCount, headerRows)
        val target = HomeLayoutEngine.itemAt(placed, container, dropPage, x, y)
        val sx = if (container == Container.DOCK) 1 else moving.spanX
        val sy = if (container == Container.DOCK) 1 else moving.spanY
        when {
            target == null && fits(x, y) ->
                dao.update(listOf(moving.copy(container = container, parent = -1, page = dropPage, x = x, y = y, spanX = sx, spanY = sy)))
            target != null && moving.kind == ItemKind.APP && target.kind == ItemKind.FOLDER -> {
                val n = all.count { it.container == Container.FOLDER && it.parent == target.id }
                dao.update(listOf(moving.copy(container = Container.FOLDER, parent = target.id, page = 0, x = n, y = 0)))
            }
            target != null && moving.kind == ItemKind.APP && target.kind == ItemKind.APP -> {
                val folderId = dao.insert(
                    HomeItem(kind = ItemKind.FOLDER, container = target.container, page = target.page, x = target.x, y = target.y,
                        title = getApplication<Application>().getString(R.string.default_folder)),
                )
                dao.update(listOf(
                    target.copy(container = Container.FOLDER, parent = folderId, page = 0, x = 0, y = 0),
                    moving.copy(container = Container.FOLDER, parent = folderId, page = 0, x = 1, y = 0),
                ))
            }
            else -> {
                val near = HomeLayoutEngine.nearestFree(placed, container, dropPage, x, y, sx, sy, p.cols, p.rows, p.dockCount, headerRows, id)
                if (near != null) dao.update(listOf(moving.copy(container = container, parent = -1, page = dropPage, x = near.first, y = near.second, spanX = sx, spanY = sy)))
                else _events.tryEmit(LauncherEvent.Message(R.string.widget_no_space))
            }
        }
        cleanupFolders()
    }

    fun removeItem(id: Long) = launchIo {
        val all = dao.all()
        val item = all.firstOrNull { it.id == id } ?: return@launchIo
        val ids = mutableListOf(id)
        if (item.kind == ItemKind.FOLDER) ids += all.filter { it.container == Container.FOLDER && it.parent == id }.map { it.id }
        if (item.kind == ItemKind.WIDGET) services.widgets.delete(item.widgetId)
        dao.delete(ids)
        cleanupFolders()
    }

    fun renameFolder(id: Long, name: String) = launchIo {
        val f = dao.all().firstOrNull { it.id == id && it.kind == ItemKind.FOLDER } ?: return@launchIo
        dao.update(listOf(f.copy(title = name.trim())))
    }

    /** Takes an app out of its folder and puts it on the home screen. */
    fun removeFromFolder(itemId: Long) = launchIo {
        val p = prefs.filterNotNull().first()
        val all = dao.all()
        val child = all.firstOrNull { it.id == itemId } ?: return@launchIo
        val free = HomeLayoutEngine.findFree(all, 1, 1, p.cols, p.rows, p.dockCount, headerRows, currentPage)
            ?: run { _events.tryEmit(LauncherEvent.Message(R.string.home_full)); return@launchIo }
        dao.update(listOf(child.copy(container = Container.HOME, parent = -1, page = free.first, x = free.second, y = free.third)))
        cleanupFolders()
    }

    fun ungroup(folderId: Long) = launchIo {
        val p = prefs.filterNotNull().first()
        var all = dao.all()
        val kids = all.filter { it.container == Container.FOLDER && it.parent == folderId }
        dao.delete(listOf(folderId))
        all = all.filter { it.id != folderId }
        for (k in kids) {
            val free = HomeLayoutEngine.findFree(all, 1, 1, p.cols, p.rows, p.dockCount, headerRows, currentPage) ?: break
            val moved = k.copy(container = Container.HOME, parent = -1, page = free.first, x = free.second, y = free.third)
            dao.update(listOf(moved)); all = all.filter { it.id != k.id } + moved
        }
    }

    /** A folder with 0 children disappears; with 1 child it dissolves into that child. */
    private suspend fun cleanupFolders() {
        val all = dao.all()
        for (f in all.filter { it.kind == ItemKind.FOLDER }) {
            val kids = all.filter { it.container == Container.FOLDER && it.parent == f.id }
            when (kids.size) {
                0 -> dao.delete(listOf(f.id))
                1 -> {
                    dao.update(listOf(kids[0].copy(container = f.container, parent = -1, page = f.page, x = f.x, y = f.y)))
                    dao.delete(listOf(f.id))
                }
            }
        }
    }

    // ---------- widgets ----------
    fun requestWidget(info: AppWidgetProviderInfo) {
        pendingWidgetProvider = info
        val id = services.widgets.allocateId()
        if (services.widgets.bindIfAllowed(id, info.provider)) afterBind(id, info)
        else _events.tryEmit(LauncherEvent.BindWidget(id, info.provider))
    }

    fun widgetBound(id: Int, ok: Boolean) {
        val info = pendingWidgetProvider ?: services.widgets.info(id)
        if (!ok || info == null) { services.widgets.delete(id); return }
        afterBind(id, info)
    }

    private fun afterBind(id: Int, info: AppWidgetProviderInfo) {
        if (info.configure != null) _events.tryEmit(LauncherEvent.ConfigureWidget(id)) else finalizeWidget(id)
    }

    fun widgetConfigured(id: Int, ok: Boolean) { if (ok) finalizeWidget(id) else services.widgets.delete(id) }

    private fun finalizeWidget(id: Int) = launchIo {
        val info = services.widgets.info(id) ?: return@launchIo
        val p = prefs.filterNotNull().first()
        val (sx, sy) = services.widgets.spanFor(info, p.cols, p.rows - headerRows)
        val free = HomeLayoutEngine.findFree(dao.all(), sx, sy, p.cols, p.rows, p.dockCount, headerRows, currentPage)
        if (free == null) {
            services.widgets.delete(id)
            _events.tryEmit(LauncherEvent.Message(R.string.widget_no_space)); return@launchIo
        }
        dao.insert(HomeItem(kind = ItemKind.WIDGET, container = Container.HOME, page = free.first, x = free.second, y = free.third,
            spanX = sx, spanY = sy, widgetId = id, pkg = info.provider.packageName, cls = info.provider.className))
        pendingWidgetProvider = null
    }

    private fun launchIo(block: suspend () -> Unit) { viewModelScope.launch(Dispatchers.IO) { block() } }
}
