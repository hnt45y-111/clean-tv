package app.dualui.samsung

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.ui.graphics.Color
import app.dualui.core.data.IconRole
import app.dualui.shared.IconPack
import app.dualui.shared.RoleStyle

private fun g(a: Long, b: Long) = listOf(Color(a), Color(b))

/** One UI-flavoured icon set for built-in apps: vivid squircles with white glyphs (original artwork). */
val SamsungIconPack = IconPack(
    mapOf(
        IconRole.PHONE to RoleStyle(Icons.Rounded.Call, g(0xFF5BE17B, 0xFF1FAE4B)),
        IconRole.MESSAGES to RoleStyle(Icons.Rounded.Sms, g(0xFF5AA9FF, 0xFF2C6CE8)),
        IconRole.CAMERA to RoleStyle(Icons.Rounded.PhotoCamera, g(0xFF3A3A40, 0xFF161618)),
        IconRole.GALLERY to RoleStyle(Icons.Rounded.PhotoLibrary, g(0xFFFF86B6, 0xFFFF8A3D)),
        IconRole.CALCULATOR to RoleStyle(Icons.Rounded.Calculate, g(0xFF5B5B63, 0xFF2D2D33)),
        IconRole.CLOCK to RoleStyle(Icons.Rounded.Schedule, g(0xFF2B2B30, 0xFF0F0F12)),
        IconRole.CALENDAR to RoleStyle(Icons.Rounded.CalendarMonth, g(0xFFFFFFFF, 0xFFE9EEF8), Color(0xFF2F7BFF)),
        IconRole.SETTINGS to RoleStyle(Icons.Rounded.Settings, g(0xFF9A9AA3, 0xFF5E5E66)),
        IconRole.BROWSER to RoleStyle(Icons.Rounded.Public, g(0xFF9A7BFF, 0xFF5A3FE0)),
        IconRole.MAPS to RoleStyle(Icons.Rounded.Map, g(0xFF58D68D, 0xFF1E9E5A)),
        IconRole.EMAIL to RoleStyle(Icons.Rounded.Email, g(0xFF5CC8FF, 0xFF2A8BE6)),
        IconRole.MUSIC to RoleStyle(Icons.Rounded.MusicNote, g(0xFFFF6B8B, 0xFFE0245E)),
    ),
)
