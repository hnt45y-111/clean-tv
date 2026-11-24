pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = "DualLauncher"

include(":app")
include(":launcher-core")
include(":shared-components")
include(":samsung-ui")
include(":pixel-ui")
include(":notifications")
include(":quick-settings")
include(":settings")
