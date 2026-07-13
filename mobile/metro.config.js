const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

// ─── Monorepo (pnpm workspace) ───────────────────────────────────────────────
// Metro must watch the workspace root and resolve modules from BOTH the app's
// node_modules and the hoisted root node_modules (see /.npmrc node-linker=hoisted).
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
// Keep hierarchical lookup ON (Expo's recommended monorepo default) — pnpm with
// node-linker=hoisted resolves fine, and disabling it trips expo-doctor.

// ─── SVG Transformer ─────────────────────────────────────────────────────────
config.transformer.babelTransformerPath = require.resolve('react-native-svg-transformer');
config.resolver.assetExts = config.resolver.assetExts.filter(ext => ext !== 'svg');
config.resolver.sourceExts = [...config.resolver.sourceExts, 'svg'];

// ─── Asset path alias ─────────────────────────────────────────────────────────
config.resolver.alias = {
  '@assets': path.join(__dirname, 'assets'),
};

// ─── Production minifier: preserve class names for NativeWind ────────────────
config.transformer.minifierConfig = {
  keep_classnames: true,
  keep_fnames: true,
  mangle: {
    keep_classnames: true,
    keep_fnames: true,
  },
  output: {
    ascii_only: true,
    quote_style: 3,
    wrap_iife: true,
  },
  sourceMap: { includeSources: false },
  toplevel: false,
  compress: {
    reduce_funcs: false,
  },
};

// ─── NativeWind (wrap last) ───────────────────────────────────────────────────
module.exports = withNativeWind(config, {
  input: path.join(__dirname, 'global.css'),
  configPath: path.join(__dirname, 'tailwind.config.js'),
});
