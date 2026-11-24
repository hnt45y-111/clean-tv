package app.dualui.launcher

import app.dualui.core.engine.LauncherSkin
import app.dualui.pixel.PixelSkin
import app.dualui.samsung.SamsungSkin

/**
 * Every available interface. To add HyperOS / ColorOS / OxygenOS later: create a module that implements
 * [LauncherSkin], depend on it from :app, and append it here. Nothing else in the app needs to change.
 */
object SkinRegistry {
    val all: List<LauncherSkin> = listOf(SamsungSkin, PixelSkin)
    fun byId(id: String?): LauncherSkin? = all.firstOrNull { it.id == id }
}
