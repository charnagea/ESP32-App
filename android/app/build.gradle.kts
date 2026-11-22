plugins {
    id("com.android.application")
}

// Each GitHub Actions run gets a higher versionCode, so a new APK installs over the old one
// and keeps your progress.
val buildNumber = (System.getenv("GITHUB_RUN_NUMBER") ?: "1").toInt()

android {
    namespace = "com.harnagea.smartpostacademy"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.harnagea.smartpostacademy"
        minSdk = 26
        targetSdk = 35
        versionCode = buildNumber
        versionName = "1.0.$buildNumber"
    }

    // The keystore is decoded from app/signing/keystore.b64 by the CI workflow.
    // It is a dedicated key for this personal, sideloaded app only.
    signingConfigs {
        create("app") {
            storeFile = file("signing/smartpost-academy.keystore")
            storePassword = "smartpost-academy"
            keyAlias = "smartpost"
            keyPassword = "smartpost-academy"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("app")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    lint {
        checkReleaseBuilds = false
        abortOnError = false
    }
}
