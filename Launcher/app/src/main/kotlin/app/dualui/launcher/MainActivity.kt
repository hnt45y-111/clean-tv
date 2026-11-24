package app.dualui.launcher

import android.app.Activity
import android.appwidget.AppWidgetManager
import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.lifecycle.lifecycleScope
import app.dualui.core.engine.LauncherEvent
import app.dualui.core.engine.LauncherViewModel
import kotlinx.coroutines.launch

/** The HOME activity: a single window; all screens are Compose destinations inside it. */
class MainActivity : ComponentActivity() {
    private val vm: LauncherViewModel by viewModels()
    private var pendingBindId = -1
    private var resumedOnce = false

    private val bindLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { r ->
        vm.widgetBound(pendingBindId, r.resultCode == Activity.RESULT_OK)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.auto(android.graphics.Color.TRANSPARENT, android.graphics.Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.auto(android.graphics.Color.TRANSPARENT, android.graphics.Color.TRANSPARENT),
        )
        super.onCreate(savedInstanceState)
        window.setBackgroundDrawableResource(android.R.color.transparent)

        lifecycleScope.launch {
            vm.events.collect { e ->
                when (e) {
                    is LauncherEvent.BindWidget -> {
                        pendingBindId = e.id
                        bindLauncher.launch(
                            Intent(AppWidgetManager.ACTION_APPWIDGET_BIND)
                                .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, e.id)
                                .putExtra(AppWidgetManager.EXTRA_APPWIDGET_PROVIDER, e.provider),
                        )
                    }
                    is LauncherEvent.ConfigureWidget -> vm.services.widgets.configure(this@MainActivity, e.id, REQ_CONFIGURE)
                    is LauncherEvent.Message -> Toast.makeText(this@MainActivity, e.resId, Toast.LENGTH_SHORT).show()
                }
            }
        }
        setContent { LauncherRoot(vm, packageManager.getPackageInfo(packageName, 0).versionName ?: "1.0") }
    }

    @Deprecated("Widget configure activities report back through the host API")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == REQ_CONFIGURE) {
            val id = data?.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, -1) ?: -1
            if (id != -1) vm.widgetConfigured(id, resultCode == RESULT_OK)
        }
    }

    override fun onStart() {
        super.onStart()
        vm.services.widgets.start()
        vm.services.quickSettings.start()
        vm.services.wallpaper.start()
    }

    override fun onStop() {
        vm.services.widgets.stop()
        vm.services.quickSettings.stop()
        vm.services.wallpaper.stop()
        super.onStop()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        // Home pressed while already on top: close overlays and return to the first page.
        if (intent.hasCategory(Intent.CATEGORY_HOME)) vm.onHomePressed()
    }

    companion object { private const val REQ_CONFIGURE = 7001 }
}
