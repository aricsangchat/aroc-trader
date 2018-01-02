const path = require('path');
const resolve = require('./resolve');
const htmlWebpackPlugin = require('html-webpack-plugin');
const styleLintPlugin = require('stylelint-webpack-plugin');
const extractTextPlugin = require('extract-text-webpack-plugin');
const CleanWebpackPlugin = require('clean-webpack-plugin');
const webpack = require('webpack');

const plugins = [
  new CleanWebpackPlugin(['dist']),
  new htmlWebpackPlugin({
    template: __dirname + '/app/index.html',
    filename: 'index.html',
    inject: 'body'
  }),
  new styleLintPlugin(),
  new extractTextPlugin({
      filename: 'style.css'
  }),
  new webpack.HotModuleReplacementPlugin(),
  new webpack.NamedModulesPlugin()
];

module.exports = {
  entry: [
    'webpack/hot/dev-server',
    'webpack-dev-server/client?http://localhost:5000',
    'react-hot-loader/patch',
    './app/js/index.js'
  ],
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
    publicPath: '/'
  },
  devtool: 'source-map',
  resolve,
  module: {
    loaders: [
      { test: /\.js$/, loader: 'babel-loader', exclude: /node_modules/ },
      { test: /\.(scss|css)$/, loader: extractTextPlugin.extract({fallback: 'style-loader', use:'css-loader?modules&importLoaders=1&localIdentName=[name]_[local]_[hash:base64:5]!sass-loader'}) },
      { test: /\.svg$/, loader: "url-loader?limit=10000&mimetype=image/svg+xml" },
      { test: /\.html$/, loader: 'html-loader?attrs[]=video:src' },
      { test: /\.mp4$/, loader: 'url-loader?limit=10000&mimetype=video/mp4' },
      { test: /\.mp3$/, loader: 'url-loader?limit=10000&mimetype=audio/mp3' },
      { test: /\.jpg$/, loader: 'url-loader?limit=10000&mimetype=image/jpg' },
      { test: /\.png$/, loader: 'url-loader?limit=10000&mimetype=image/png' },
      { test: /\.gif$/, loader: 'url-loader?limit=10000&mimetype=image/gif' },
      { test: /\.woff2$/, loader: 'url-loader?limit=10240&mimetype=application/font-woff2' },
      { test: /\.woff$/, loader: 'url-loader?limit=10240&mimetype=application/font-woff' },
      { test: /\.ttf$/, loader: 'url-loader?limit=10240&mimetype=application/x-font-ttf' }
    ]
  },
  plugins
}
