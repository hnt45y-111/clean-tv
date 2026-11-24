package app.dualui.pixel

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.ui.graphics.Color
import app.dualui.core.data.IconRole
import app.dualui.shared.IconPack
import app.dualui.shared.RoleStyle

private fun s(c: Long) = listOf(Color(c), Color(c))

/** Pixel-flavoured icon set: flat Material colours on circles (original artwork). */
val PixelIconPack = IconPack(
    mapOf(
        IconRole.PHONE to RoleStyle(Icons.Rounded.Call, s(0xFF1A73E8)),
        IconRole.MESSAGES to RoleStyle(Icons.Rounded.ChatBubble, s(0xFF4285F4)),
        IconRole.CAMERA to RoleStyle(Icons.Rounded.PhotoCamera, s(0xFF5F6368)),
        IconRole.GALLERY to RoleStyle(Icons.Rounded.PhotoLibrary, s(0xFFF9AB00)),
        IconRole.CALCULATOR to RoleStyle(Icons.Rounded.Calculate, s(0xFF00897B)),
        IconRole.CLOCK to RoleStyle(Icons.Rounded.AccessTime, s(0xFF5C6BC0)),
        IconRole.CALENDAR to RoleStyle(Icons.Rounded.CalendarMonth, listOf(Color.White, Color.White), Color(0xFF1A73E8)),
        IconRole.SETTINGS to RoleStyle(Icons.Rounded.Settings, s(0xFF5F6368)),
        IconRole.BROWSER to RoleStyle(Icons.Rounded.Public, s(0xFF4285F4)),
        IconRole.MAPS to RoleStyle(Icons.Rounded.Map, s(0xFF34A853)),
        IconRole.EMAIL to RoleStyle(Icons.Rounded.Email, s(0xFFEA4335)),
        IconRole.MUSIC to RoleStyle(Icons.Rounded.MusicNote, s(0xFFFF6D00)),
    ),
)
