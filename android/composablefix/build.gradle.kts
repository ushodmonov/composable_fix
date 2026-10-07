plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    `maven-publish`
}

android {
    namespace = "dev.composablefix"
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
    implementation(libs.compose.foundation)
    implementation(libs.activity.compose)
    implementation(libs.coroutines.android)

    testImplementation(libs.junit)
}

publishing {
    publications {
        register<MavenPublication>("release") {
            artifactId = "composablefix"
            afterEvaluate { from(components["release"]) }
        }
    }
}
