package app.dualui.core.engine

import android.app.ActivityOptions
import android.content.Context
import android.content.Intent
import android.graphics.Rect
import android.net.Uri
import android.view.View
import android.widget.Toast
import app.dualui.core.R
import app.dualui.core.data.AppRepository
import app.dualui.core.model.AppInfo

/** Launching, app-info and uninstall through official APIs, with a scale-up animation from the tapped icon. */
object AppLauncher {
    fun launch(context: Context, view: View?, app: AppInfo, bounds: Rect?) {
        val repo = AppRepository.get(context)
        try {
            val opts = if (view != null && bounds != null)
                ActivityOptions.makeScaleUpAnimation(view, bounds.left, bounds.top, bounds.width(), bounds.height()).toBundle()
            else null
            repo.launcherApps().startMainActivity(repo.component(app), app.user, bounds, opts)
        } catch (_: Exception) {
            Toast.makeText(context, R.string.app_unavailable, Toast.LENGTH_SHORT).show()
        }
    }

    fun appInfo(context: Context, app: AppInfo, bounds: Rect? = null) {
        val repo = AppRepository.get(context)
        try { repo.launcherApps().startAppDetailsActivity(repo.component(app), app.user, bounds, null) }
        catch (_: Exception) { Toast.makeText(context, R.string.app_unavailable, Toast.LENGTH_SHORT).show() }
    }

    fun uninstall(context: Context, app: AppInfo) {
        val i = Intent(Intent.ACTION_DELETE, Uri.parse("package:${app.packageName}")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        try { context.startActivity(i) } catch (_: Exception) {}
    }

    fun webSearch(context: Context, query: String) {
        val i = Intent(Intent.ACTION_VIEW, Uri.parse("https://www.google.com/search?q=" + Uri.encode(query)))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        try { context.startActivity(i) } catch (_: Exception) {}
    }
}
