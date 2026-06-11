/**
 * Expo config plugin for Kachingo home screen widgets.
 *
 * iOS:  Adds a WidgetKit extension target (Swift), App Group entitlement,
 *       and the ObjC/Swift bridge for writing data from JS.
 *
 * Android: Copies widget Kotlin source, XML resources and drawables; registers
 *          all four AppWidgetProviders in AndroidManifest.xml; registers the
 *          React Native bridge package in MainApplication.
 */

const { withAppDelegate,
        withXcodeProject,
        withEntitlementsPlist,
        withInfoPlist,
        withDangerousMod,
        withAndroidManifest,
        withMainApplication } = require('@expo/config-plugins');
const fs   = require('fs');
const path = require('path');

const BUNDLE_ID    = 'com.kachingo.app';
const APP_GROUP    = 'group.com.kachingo.app';
const WIDGET_SRC   = path.join(__dirname, '..', 'widget');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// iOS — widget extension target
// ─────────────────────────────────────────────────────────────────────────────

function withIosWidgetExtension(config) {
  // 1. Add App Group entitlement to main app
  config = withEntitlementsPlist(config, mod => {
    const groups = mod.modResults['com.apple.security.application-groups'] || [];
    if (!groups.includes(APP_GROUP)) {
      mod.modResults['com.apple.security.application-groups'] = [...groups, APP_GROUP];
    }
    return mod;
  });

  // 2. Copy Swift source files into the iOS project directory
  config = withDangerousMod(config, ['ios', mod => {
    const iosDir = path.join(mod.modRequest.platformProjectRoot);
    const widgetDir = path.join(iosDir, 'KachingoWidget');
    fs.mkdirSync(widgetDir, { recursive: true });

    const iosSrc = path.join(WIDGET_SRC, 'ios');
    for (const f of fs.readdirSync(iosSrc)) {
      fs.copyFileSync(path.join(iosSrc, f), path.join(widgetDir, f));
    }

    // Entitlements for widget extension
    const widgetEnt = path.join(widgetDir, 'KachingoWidget.entitlements');
    const entContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.application-groups</key>
  <array>
    <string>${APP_GROUP}</string>
  </array>
</dict>
</plist>`;
    fs.writeFileSync(widgetEnt, entContent);

    return mod;
  }]);

  // 3. Add widget extension target + bridge files to Xcode project
  config = withXcodeProject(config, mod => {
    const xcodeProject = mod.modResults;
    const appName = mod.modRequest.projectName ?? 'kachingo';
    const widgetName = 'KachingoWidget';
    const widgetBundleId = `${BUNDLE_ID}.widget`;

    // Only add once
    if (xcodeProject.pbxTargetByName(widgetName)) return mod;

    const widgetDir = path.join(mod.modRequest.platformProjectRoot, widgetName);

    const swiftFiles = [
      'KachingoWidget.swift',
      'KachingoWidgetBundle.swift',
      'KachingoWidgetBridge.swift',
    ];
    const objcFiles = [
      'KachingoWidgetBridge.m',
    ];
    const resourceFiles = [
      'KachingoWidgetExtension-Info.plist',
    ];

    // Add the widget extension target
    const target = xcodeProject.addTarget(
      widgetName,
      'app_extension',
      widgetName,
      widgetBundleId,
    );

    // Add a new PBXGroup for the widget
    const widgetGroup = xcodeProject.addPbxGroup(
      [...swiftFiles, ...objcFiles, ...resourceFiles],
      widgetName,
      widgetName,
    );
    const mainGroupId = xcodeProject.getFirstProject().firstProject.mainGroup;
    xcodeProject.addToPbxGroup(widgetGroup.uuid, mainGroupId);

    // Add files to target
    [...swiftFiles, ...objcFiles].forEach(f => {
      xcodeProject.addSourceFile(
        `${widgetName}/${f}`, { target: target.uuid }, widgetGroup.uuid
      );
    });
    resourceFiles.forEach(f => {
      xcodeProject.addResourceFile(
        `${widgetName}/${f}`, { target: target.uuid }, widgetGroup.uuid
      );
    });

    // Build settings
    const configurations = xcodeProject.pbxXCBuildConfigurationSection();
    Object.values(configurations).forEach(cfg => {
      if (typeof cfg !== 'object' || !cfg.buildSettings) return;
      if (cfg.buildSettings.PRODUCT_NAME !== `"${widgetName}"` &&
          cfg.buildSettings.PRODUCT_NAME !== widgetName) return;
      cfg.buildSettings.SWIFT_VERSION = '5.0';
      cfg.buildSettings.TARGETED_DEVICE_FAMILY = '"1,2"';
      cfg.buildSettings.INFOPLIST_FILE = `"${widgetName}/KachingoWidgetExtension-Info.plist"`;
      cfg.buildSettings.CODE_SIGN_ENTITLEMENTS = `"${widgetName}/KachingoWidget.entitlements"`;
      cfg.buildSettings.MARKETING_VERSION = mod.modResults.getFirstTarget()
        ?.buildConfigurationList?.buildConfigurations?.[0]?.buildSettings?.MARKETING_VERSION ?? '1.0';
    });

    // Add WidgetKit framework to widget target
    xcodeProject.addFramework('WidgetKit.framework', { target: target.uuid });
    xcodeProject.addFramework('SwiftUI.framework',   { target: target.uuid });

    // Also add bridge swift files to the main app target
    const mainTarget = xcodeProject.getFirstTarget().uuid;
    xcodeProject.addSourceFile(
      `${widgetName}/KachingoWidgetBridge.swift`,
      { target: mainTarget }, widgetGroup.uuid,
    );
    xcodeProject.addSourceFile(
      `${widgetName}/KachingoWidgetBridge.m`,
      { target: mainTarget }, widgetGroup.uuid,
    );

    return mod;
  });

  return config;
}

// ─────────────────────────────────────────────────────────────────────────────
// Android — widget providers + bridge
// ─────────────────────────────────────────────────────────────────────────────

const ANDROID_WIDGETS = [
  { cls: 'DonutWidget',       infoXml: 'widget_donut_info',        label: 'Monthly Overview' },
  { cls: 'CaptureWidget',     infoXml: 'widget_capture_info',      label: 'Scan Receipt' },
  { cls: 'QuickActionsWidget',infoXml: 'widget_quick_actions_info', label: 'Quick Actions' },
  { cls: 'GoalWidget',        infoXml: 'widget_goal_info',         label: 'Goals' },
];

function withAndroidWidgets(config) {
  // 1. Copy Kotlin sources + XML resources into the Android project
  config = withDangerousMod(config, ['android', mod => {
    const androidDir = mod.modRequest.platformProjectRoot;
    const pkg = BUNDLE_ID.replace(/\./g, '/');

    // Kotlin sources → app/src/main/java/com/kachingo/app/widget/
    const javaDir = path.join(androidDir, 'app', 'src', 'main', 'java', pkg, 'widget');
    fs.mkdirSync(javaDir, { recursive: true });
    const srcDir = path.join(WIDGET_SRC, 'android', 'src');
    for (const f of fs.readdirSync(srcDir)) {
      fs.copyFileSync(path.join(srcDir, f), path.join(javaDir, f));
    }

    // XML resources
    const resDir = path.join(androidDir, 'app', 'src', 'main', 'res');
    copyDir(path.join(WIDGET_SRC, 'android', 'res'), resDir);

    return mod;
  }]);

  // 2. Register widget providers in AndroidManifest.xml
  config = withAndroidManifest(config, mod => {
    const app = mod.modResults.manifest.application[0];
    if (!app.receiver) app.receiver = [];

    ANDROID_WIDGETS.forEach(({ cls, infoXml, label }) => {
      const fullCls = `.widget.${cls}`;
      if (app.receiver.some(r => r.$['android:name'] === fullCls)) return;

      const intentFilters = [{
        action: [{ $: { 'android:name': 'android.appwidget.action.APPWIDGET_UPDATE' } }],
      }];
      // DonutWidget also handles its own swap broadcast
      if (cls === 'DonutWidget') {
        intentFilters.push({
          action: [{ $: { 'android:name': 'com.kachingo.app.widget.SWAP_DONUT' } }],
        });
      }

      app.receiver.push({
        $: {
          'android:name':     fullCls,
          'android:exported': 'true',
          'android:label':    label,
        },
        'intent-filter': intentFilters,
        'meta-data': [{
          $: {
            'android:name':     'android.appwidget.provider',
            'android:resource': `@xml/${infoXml}`,
          },
        }],
      });
    });

    return mod;
  });

  // 3. Register the React Native bridge package in MainApplication
  config = withMainApplication(config, mod => {
    let src = mod.modResults.contents;
    const importLine  = 'import com.kachingo.app.widget.KachingoWidgetBridgePackage';
    const packageLine = 'packages.add(new KachingoWidgetBridgePackage())';

    if (!src.includes(importLine)) {
      src = src.replace(
        /^(package com\.kachingo\.app)/m,
        `$1\n${importLine}`,
      );
    }
    if (!src.includes(packageLine)) {
      src = src.replace(
        /(override fun getPackages\(\).*?\{[\s\S]*?val packages)/,
        `$1`,
      );
      // Kotlin MainApplication
      src = src.replace(
        /PackageList\(this\)\.packages/,
        `PackageList(this).packages.also { it.add(KachingoWidgetBridgePackage()) }`,
      );
    }
    mod.modResults.contents = src;
    return mod;
  });

  return config;
}

// ─────────────────────────────────────────────────────────────────────────────
// Deep link handling for kachingo://add  →  opens ManualEntryModal
// ─────────────────────────────────────────────────────────────────────────────

// The /add and /capture deep links are already handled by expo-linking in the
// app via OAuthCallbackHandler + Expo Router. No extra native config needed.

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

module.exports = function withKachingoWidget(config) {
  config = withIosWidgetExtension(config);
  config = withAndroidWidgets(config);
  return config;
};
