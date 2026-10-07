plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.android.library) apply false
    alias(libs.plugins.kotlin.android) apply false
    alias(libs.plugins.kotlin.compose) apply false
}

// An app that includes this build (includeBuild) gets dev.composablefix:composablefix and
// dev.composablefix:composablefix-noop substituted with these projects.
subprojects {
    group = "dev.composablefix"
    version = "0.1.0"
}
