/* eslint-disable @typescript-eslint/no-var-requires */
require("@babel/register")({
  // babelrc: true,
  plugins: ["@babel/plugin-transform-modules-commonjs"],
  // extends: '../.babelrc.js',
  extensions: [".es6", ".es", ".jsx", ".js", ".ts", ".tsx"],
  // Setting this to false will disable the cache.
  cache: true,
})
const settings = require("./src/settings").default

module.exports = settings
