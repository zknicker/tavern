'use strict';

const releaseBaseUrl = process.env.TAVERN_RELEASE_BASE_URL?.replace(/\/+$/u, '');

module.exports = {
    appId: 'build.tavern.desktop',
    productName: 'Tavern',
    directories: {
        output: 'electron-dist',
    },
    files: [
        'dist/**',
        'electron/edit-context-menu.cjs',
        'electron/external-link-handlers.cjs',
        'electron/main.cjs',
        'electron/preload.cjs',
        'package.json',
    ],
    extraResources: [
        {
            from: 'electron/resources/bin/tavern-server',
            to: 'bin/tavern-server',
        },
        {
            from: 'electron/generated-icons/Assets.car',
            to: 'Assets.car',
        },
    ],
    mac: {
        // biome-ignore lint/suspicious/noTemplateCurlyInString: electron-builder artifact macros are literal strings.
        artifactName: '${productName}_${version}_${arch}.${ext}',
        binaries: ['Contents/Resources/bin/tavern-server'],
        category: 'public.app-category.productivity',
        darkModeSupport: true,
        entitlements: 'electron/Entitlements.plist',
        entitlementsInherit: 'electron/Entitlements.plist',
        extendInfo: {
            CFBundleIconName: 'AppIcon',
            LSMultipleInstancesProhibited: true,
        },
        gatekeeperAssess: false,
        hardenedRuntime: true,
        icon: 'electron/icons/AppIcon.icns',
        notarize: process.env.TAVERN_ELECTRON_NOTARIZE !== '0',
        target: ['dmg', 'zip'],
    },
    publish: releaseBaseUrl
        ? [
              {
                  provider: 'generic',
                  url: releaseBaseUrl,
              },
          ]
        : null,
};
