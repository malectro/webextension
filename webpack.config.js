const {resolve} = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

const PROJECT_DIR = __dirname;
const DEVELOPMENT = true;

// The pattern for classnames generated by CSS modules:
const CSS_MODULES_CLASS_PATTERN = '[name]__[local]___[hash:base64:5]';

// Params for css-loader to set up CSS Modules with a specific class pattern
// and add postcss-loader:
const CSS_MODULES_OPTIONS = {
  modules: true,
  localIdentName: CSS_MODULES_CLASS_PATTERN,
  importLoaders: 1,
  // maps sourcemaps from inspector to css module files
  sourceMap: true,
  minimize: false,
};

const POSTCSS_LOADER = {
  loader: 'postcss-loader',
  options: {
    config: {
      ctx: {},
      path: resolve(PROJECT_DIR, 'postcss.config.js'),
    },
  },
};

module.exports = {
  mode: DEVELOPMENT ? 'development' : 'production',
  devtool: 'source-map',
  target: 'web',
  entry: {
    background: resolve(PROJECT_DIR, "src/background.ts"),
  },
  output: {
    path: resolve(PROJECT_DIR, 'build'),
    filename: '[name].js',
    chunkFilename: '[id].chunk.js',
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        loader: 'swc-loader',
      },

      {
        test: /\.svg$/,
        issuer: /\.tsx?$/,
        use: [{
          loader: 'svgo-loader',
          options: {

          plugins: [{removeTitle: true}, {removeViewBox: false}],
          }, },
        'svg-react-loader'],
      },

      // CSS Modules.
      {
        test: /\.css$/,
        exclude: [/node_modules/, /\.global\.css$/],
        use: [
          MiniCssExtractPlugin.loader,
          {
            loader: 'css-loader',
            options: CSS_MODULES_OPTIONS,
          },
          POSTCSS_LOADER,
        ],
      },

      // CSS in node_modules.
      {
        test: /\.css$/,
        include: /node_modules/,
        use: [MiniCssExtractPlugin.loader, 'css-loader', POSTCSS_LOADER],
      },

      // Global CSS aka .global.css files.
      {
        test: /\.global\.css$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader', POSTCSS_LOADER],
      },

      {
        test: /\.(png|jpg|gif|svg)$/,
        issuer: /.css$/,
        loader: 'file-loader',
        options: {
          outputPath: 'images/',
          // Chrome extension resources use the chrome-extension protocol and
          // are accessed at the top level by a special string identifying the
          // current app.
          publicPath: 'chrome-extension://__MSG_@@extension_id__/images/',
        },
      },
    ],
  },

  optimization: {
    splitChunks: false,
    minimize: false,
  },

  plugins: [
    new MiniCssExtractPlugin({
      filename: '[name].css',
    }),
  ],
};
