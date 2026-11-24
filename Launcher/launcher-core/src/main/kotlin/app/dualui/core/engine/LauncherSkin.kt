package app.dualui.core.engine

import androidx.annotation.StringRes
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier

/** What a skin needs from the application shell. */
class SkinHost(
    val vm: LauncherViewModel,
    /** Opens the launcher settings, optionally at a section ("wallpaper", "grid", ...). */
    val openSettings: (section: String?) -> Unit,
)

/**
 * One complete interface (Samsung One UI, Google Pixel, later HyperOS / ColorOS ...).
 * A new OEM skin = a new module implementing this interface + one line in the app's SkinRegistry.
 * Skins share the engine ([LauncherViewModel]) but own every layout, component and animation.
 */
interface LauncherSkin {
    val id: String
    @get:StringRes val nameRes: Int
    @get:StringRes val taglineRes: Int

    /** Number of top grid rows on page 0 reserved for the skin's built-in header widget (clock / At a glance). */
    val headerRows: Int

    @Composable fun Theme(dark: Boolean, content: @Composable () -> Unit)
    @Composable fun Home(host: SkinHost)
    @Composable fun Preview(modifier: Modifier)
}
