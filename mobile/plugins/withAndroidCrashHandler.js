const { withMainApplication, withDangerousMod, withAndroidManifest } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// Catches uncaught JVM exceptions, saves them, and launches CrashActivity in a
// separate process so the crash details are shown immediately — no JS needed.
const CRASH_HANDLER_KT = [
  'package com.kachingo.myapp',
  '',
  'import android.app.Application',
  'import android.content.Context',
  'import android.content.Intent',
  'import java.io.File',
  'import java.io.PrintWriter',
  'import java.io.StringWriter',
  '',
  'object CrashHandler : Thread.UncaughtExceptionHandler {',
  '    private var prev: Thread.UncaughtExceptionHandler? = null',
  '    private var ctx: Context? = null',
  '',
  '    fun install(app: Application) {',
  '        ctx = app.applicationContext',
  '        prev = Thread.getDefaultUncaughtExceptionHandler()',
  '        Thread.setDefaultUncaughtExceptionHandler(this)',
  '    }',
  '',
  '    override fun uncaughtException(t: Thread, e: Throwable) {',
  '        val sw = StringWriter()',
  '        e.printStackTrace(PrintWriter(sw))',
  '        val trace = "Thread: ${t.name}\\n\\n$sw"',
  '        try {',
  '            val c = ctx ?: return',
  '            // Persist for JS to read on later successful launches',
  '            File(c.filesDir, "kachingo_native_crash.txt").writeText(trace)',
  '            // SharedPreferences for CrashActivity (separate process, same package)',
  '            c.getSharedPreferences("kachingo_crash", Context.MODE_PRIVATE)',
  '                .edit().putString("last_crash", trace).commit()',
  '            // Launch crash display in its own process so it survives our process dying',
  '            val intent = Intent(c, CrashActivity::class.java)',
  '            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)',
  '            c.startActivity(intent)',
  '        } catch (_: Throwable) {}',
  '        android.os.Process.killProcess(android.os.Process.myPid())',
  '    }',
  '}',
].join('\n');

// Pure Android Activity — no React Native dependency — shows crash and lets user copy it.
const CRASH_ACTIVITY_KT = [
  'package com.kachingo.myapp',
  '',
  'import android.app.Activity',
  'import android.content.ClipData',
  'import android.content.ClipboardManager',
  'import android.content.Context',
  'import android.graphics.Color',
  'import android.graphics.Typeface',
  'import android.os.Bundle',
  'import android.widget.*',
  '',
  'class CrashActivity : Activity() {',
  '    override fun onCreate(savedInstanceState: Bundle?) {',
  '        super.onCreate(savedInstanceState)',
  '        val crash = getSharedPreferences("kachingo_crash", Context.MODE_PRIVATE)',
  '            .getString("last_crash", "No crash data found") ?: "No crash data found"',
  '',
  '        val root = LinearLayout(this).apply {',
  '            orientation = LinearLayout.VERTICAL',
  '            setPadding(32, 96, 32, 32)',
  '            setBackgroundColor(Color.parseColor("#7f1d1d"))',
  '        }',
  '',
  '        root.addView(TextView(this).apply {',
  '            text = "\\uD83D\\uDCA5 App Crash"',
  '            textSize = 22f',
  '            setTextColor(Color.parseColor("#fef2f2"))',
  '            setPadding(0, 0, 0, 4)',
  '        })',
  '',
  '        root.addView(TextView(this).apply {',
  '            text = "Copy and send this to the developer"',
  '            textSize = 12f',
  '            setTextColor(Color.parseColor("#fca5a5"))',
  '            setPadding(0, 0, 0, 16)',
  '        })',
  '',
  '        val scroll = ScrollView(this)',
  '        scroll.addView(TextView(this).apply {',
  '            text = crash',
  '            textSize = 10f',
  '            setTextColor(Color.parseColor("#fca5a5"))',
  '            typeface = Typeface.MONOSPACE',
  '            setPadding(0, 0, 0, 16)',
  '        })',
  '        root.addView(scroll, LinearLayout.LayoutParams(',
  '            LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f',
  '        ))',
  '',
  '        root.addView(Button(this).apply {',
  '            text = "Copy to Clipboard"',
  '            setBackgroundColor(Color.parseColor("#dc2626"))',
  '            setTextColor(Color.WHITE)',
  '            setOnClickListener {',
  '                val cm = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager',
  '                cm.setPrimaryClip(ClipData.newPlainText("crash", crash))',
  '                Toast.makeText(this@CrashActivity, "Copied!", Toast.LENGTH_SHORT).show()',
  '            }',
  '        }, LinearLayout.LayoutParams(',
  '            LinearLayout.LayoutParams.MATCH_PARENT,',
  '            LinearLayout.LayoutParams.WRAP_CONTENT',
  '        ).apply { setMargins(0, 16, 0, 0) })',
  '',
  '        setContentView(root)',
  '    }',
  '}',
].join('\n');

module.exports = function withAndroidCrashHandler(config) {
  // 1. Write the Kotlin source files during prebuild
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const root = config.modRequest.platformProjectRoot;
      const appDir = path.join(root, 'app/src/main/java/com/kachingo/myapp');
      fs.mkdirSync(appDir, { recursive: true });
      fs.writeFileSync(path.join(appDir, 'CrashHandler.kt'), CRASH_HANDLER_KT);
      fs.writeFileSync(path.join(appDir, 'CrashActivity.kt'), CRASH_ACTIVITY_KT);
      return config;
    },
  ]);

  // 2. Install the handler as the very first line of Application.onCreate()
  config = withMainApplication(config, (config) => {
    const { contents } = config.modResults;
    if (contents.includes('CrashHandler.install(this)')) return config;
    config.modResults.contents = contents.replace(
      'override fun onCreate() {',
      'override fun onCreate() {\n    CrashHandler.install(this)'
    );
    return config;
  });

  // 3. Declare CrashActivity in the manifest with android:process=":crash"
  //    so it runs in a separate process and survives the main process dying
  config = withAndroidManifest(config, (config) => {
    const app = config.modResults.manifest.application[0];
    const activities = app.activity || [];
    if (activities.some((a) => a.$['android:name'] === '.CrashActivity')) return config;
    if (!app.activity) app.activity = [];
    app.activity.push({
      $: {
        'android:name': '.CrashActivity',
        'android:process': ':crash',
        'android:exported': 'false',
      },
    });
    return config;
  });

  return config;
};
