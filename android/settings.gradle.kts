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

rootProject.name = "composablefix-android"

// The library, its release stand-in, and Tally for Android, the demo.
include(":composablefix", ":composablefix-noop", ":tally")
