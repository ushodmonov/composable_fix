plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    `maven-publish`
}

// The release stand-in for :composablefix: the same API, doing nothing, so release builds carry none of ComposableFix.
android {
    namespace = "dev.composablefix.noop"
    compileSdk = 36

    defaultConfig {
        minSdk = 23
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    publishing {
        singleVariant("release") { withSourcesJar() }
    }
}

kotlin {
    compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17) }
}

dependencies {
    implementation(platform(libs.compose.bom))
    api(libs.compose.ui)
}

publishing {
    publications {
        register<MavenPublication>("release") {
            artifactId = "composablefix-noop"
            afterEvaluate { from(components["release"]) }
        }
    }
}
