/* eslint-disable @typescript-eslint/no-var-requires */
const path = require("path")
const webpack = require("webpack")
const nodeExternals = require("webpack-node-externals")
const AssetsPlugin = require("assets-webpack-plugin")
const TerserPlugin = require("terser-webpack-plugin")
const WorkboxPlugin = require("workbox-webpack-plugin")
const eslintFormatter = require("react-dev-utils/eslintFormatter")
const ignoredFiles = require("react-dev-utils/ignoredFiles")
const ReactRefreshWebpackPlugin = require("@pmmmwh/react-refresh-webpack-plugin")
const MiniCssExtractPlugin = require("mini-css-extract-plugin")
const BundleAnalyzerPlugin = require("webpack-bundle-analyzer").BundleAnalyzerPlugin
const paths = require("./paths.js")
const getClientEnv = require("./env").getClientEnv
const nodePath = require("./env").nodePath
const packageJson = require("./package.json")
const findCacheDir = require("find-cache-dir")

// NOTE qac: we have x3 options for this:
// - https://github.com/webdeveric/webpack-assets-manifest - best supported
// - https://github.com/ztoben/assets-webpack-plugin - supports inline runtime, currently used
const useSharedAssets = true
const runtimeBundleName = "runtime"
const shouldUseReactRefresh = false
const assetsParts = paths.appWebpackAssets.split("/")
const appWebpackAssetsFilename = assetsParts[assetsParts.length - 1]
const isCi = process.env.CI && (typeof process.env.CI !== "string" || process.env.CI.toLowerCase() !== "false")
let currentPlugin = null
const getAssetsPluginInstance = (IS_DEV) => {
  if (useSharedAssets && currentPlugin) {
    return currentPlugin
  }
  currentPlugin = new AssetsPlugin({
    path: paths.appBuild,
    filename: appWebpackAssetsFilename,
    includeManifest: IS_DEV ? false : runtimeBundleName,
    manifestFirst: true,
    prettyPrint: true,
  })
  return currentPlugin
}

// NOTE qac: we try to keep up to date with CRA:
// prod: https://github.com/facebook/create-react-app/blob/master/packages/react-scripts/config/webpack.config.js
// dev: https://github.com/facebook/create-react-app/blob/master/packages/react-scripts/config/webpackDevServer.config.js

const OneKb = 1000
const webpackVersion = 5

function isNodeModule(chunks) {
  const isNodeModule = /node_modules/.test(chunks.context || "")
  return isNodeModule
}

// const clientPathMatcher = /src\/client\//
// const clientPathAdminMatcher = /src\/client\/Admin/
const slateOnlyModuleMatcher = /slate|immer|tippy|uifabric|marked|prismjs|cropperjs|styled-icons/
const adminOnlyModuleMatcher = /@material-ui|@date-io|chart\.js|chartjs|jss|hi-base32|popper|clsx|moment/
function isSlateOnly(chunks) {
  return slateOnlyModuleMatcher.test(chunks.context)
}
function isAdminOnly(chunks) {
  return adminOnlyModuleMatcher.test(chunks.context)
  // const doDebug = /formik|luxon/.test(chunks.context)
  // let hasNonAdminRoute = false
  // let hasClientRoute = false
  // let currentChunks = chunks
  // while (currentChunks.issuer) {
  //   currentChunks = currentChunks.issuer
  //   const pathContext = currentChunks.context || ''
  //   if (clientPathMatcher.test(pathContext)) {
  //     hasClientRoute = true
  //     if (doDebug) {
  //       console.log(`---- context: ${pathContext} (${chunks.context})`)
  //     }
  //     //
  //     hasNonAdminRoute = hasNonAdminRoute || !clientPathAdminMatcher.test(pathContext)
  //   }
  // }
  // if (doDebug) {
  //   console.log(`--- hasNonAdminRoute: ${hasNonAdminRoute} hasClientRoute: ${hasClientRoute} (${chunks.context})`)
  // }
  // return hasClientRoute && !hasNonAdminRoute
}

// This is the Webpack configuration factory. It's the juice!
module.exports = (target, env, isModern) => {
  // Define some useful shorthands.
  const IS_NODE = target === "node"
  const IS_WEB = target === "web"
  const IS_PROD = env === "prod"
  const IS_DEV = env === "dev"
  const IS_MODERN_BUILD = !!isModern || IS_DEV || IS_NODE
  const IS_ES_MODULES = IS_NODE
  const isModernSuffix = IS_MODERN_BUILD ? "-modern" : ""
  const jsFileExt = IS_MODERN_BUILD ? "mjs" : "js"
  const SW_FILE_NAME = `service-worker${isModernSuffix}`
  process.env.NODE_ENV = IS_PROD ? "production" : "development"
  process.env.SENTRY_ENVIRONMENT = process.env.NODE_ENV
  process.env.APP_PLATFORM = target
  // Source maps are resource heavy and can cause out of memory issue for large source files.
  const shouldUseSourceMap = process.env.GENERATE_SOURCEMAP !== "false"
  const ENABLE_LINTING = !!process.env.ENABLE_LINTING
  const dotenv = getClientEnv(target)
  const devServerPort = dotenv.settings.DEV_SERVER_PORT
  // if (IS_MODERN_BUILD) {
  //   paths.appWebpackAssets = paths.appWebpackAssets.split(".json")[0] + "-modern.json"
  // }

  const targets = IS_WEB ? {} : { node: "current" }
  const presetEnvOverrides = { targets: targets }
  const babelPresetsPlugins = []
  const babelPresetsOverrides = [["@babel/preset-env", presetEnvOverrides]]
  const babelPluginOverrides = [
    [
      "polyfill-corejs3",
      Object.assign(
        {
          method: "entry-global",
        },
        presetEnvOverrides,
      ),
    ],
  ]
  // https://github.com/vercel/next.js/blob/canary/packages/next/build/webpack/loaders/next-babel-loader.js
  if (IS_MODERN_BUILD && IS_PROD) {
    targets.esmodules = true
  }
  if (IS_WEB && IS_MODERN_BUILD) {
    // https://github.com/babel/preset-modules
    presetEnvOverrides.bugfixes = true
    presetEnvOverrides.loose = true
    presetEnvOverrides.exclude = [
      // Block accidental inclusions
      "transform-regenerator",
      "transform-async-to-generator",
    ]
    // babelPluginOverrides.push([
    //   "@babel/plugin-transform-runtime",
    //   {
    //     // corejs: false,
    //     helpers: true,
    //     regenerator: false,
    //     // https://babeljs.io/docs/en/babel-plugin-transform-runtime#useesmodules
    //     // We should turn this on once the lowest version of Node LTS
    //     // supports ES Modules.
    //     useESModules: true,
    //   },
    // ])
  }
  const browserlistEnv = (IS_NODE && "ssr") || (IS_MODERN_BUILD && "modern") || process.env.NODE_ENV
  const browserlistParams = packageJson.browserslist[browserlistEnv]
  if (!browserlistParams) {
    throw new Error(`invalid browserlistEnv: ${browserlistEnv}`)
  }
  if (!targets.node && !targets.esmodules) {
    targets.browsers = browserlistParams.join(", ")
  }
  if (IS_DEV && IS_WEB && shouldUseReactRefresh) {
    babelPresetsPlugins.push(require.resolve("react-refresh/babel"))
  }
  const cachePrefix = `${shouldUseReactRefresh}-${target}-${env}-${IS_MODERN_BUILD}`
  // const filename = path.join(opts.cwd, 'noop.js')
  const mainBabelOptions = {
    // https://stackoverflow.com/a/52564076/406725
    envName: dotenv.settings.APP_ENV,
    babelrc: true,
    // https://webpack.js.org/loaders/babel-loader/#options
    cacheDirectory: findCacheDir({ name: `babel-loader-${cachePrefix}` }),
    cacheCompression: false,
    // https://github.com/vercel/next.js/pull/6982/files
    // https://github.com/vercel/next.js/blob/canary/packages/next/build/webpack/loaders/next-babel-loader.js#L71
    // cacheIdentifier: cacheKey + JSON.stringify(
    //   babel.loadPartialConfig({
    //     filename,
    //     cwd: opts.cwd,
    //     sourceFileName: filename
    //   }).options
    // ),
    presets: [],
    plugins: babelPresetsPlugins,
    overrides: [
      {
        presets: babelPresetsOverrides,
        plugins: babelPluginOverrides,
      },
    ],
  }
  // https://webpack.js.org/migrate/5/#clean-up-configuration
  // const splitChunkDefaultOptions = { chunks: "all", maxInitialRequests: 30, maxAsyncRequests: 30, maxSize: 100000 }
  // NOTE qac: this is required to give us a single chunk (which we require currently in Document.tsx)
  const splitChunkDefaultOptions = { chunks: "all" }
  const splitChunkOptimizations = IS_NODE
    ? {}
    : {
        splitChunks: {
          cacheGroups: {
            slate: {
              test(chunks) {
                return isNodeModule(chunks) && !!isSlateOnly(chunks)
              },
              name: "slate",
              priority: -10,
              ...splitChunkDefaultOptions,
            },
            admin: {
              test(chunks) {
                return isNodeModule(chunks) && !!isAdminOnly(chunks)
              },
              name: "admin",
              priority: -10,
              ...splitChunkDefaultOptions,
            },
            defaultVendors: {
              test(chunks) {
                return isNodeModule(chunks) && !isAdminOnly(chunks) && !isSlateOnly(chunks)
              },
              name: "vendors",
              priority: 10,
              ...splitChunkDefaultOptions,
            },
          },
        },
        // Keep the runtime chunk seperated to enable long term caching
        // https://webpack.js.org/configuration/optimization/#optimizationruntimechunk
        runtimeChunk: {
          // NOTE qac: since we only have x1 entry, we can not use: `${runtimeBundleName}-${entrypoint.name}`
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          name: (entrypoint) => runtimeBundleName,
        },
      }
  // This is our base webpack config.
  let config = {
    // Otherwise will boom CI due to warning output
    // https://stackoverflow.com/questions/49348365/webpack-4-size-exceeds-the-recommended-limit-244-kib
    performance: {
      maxEntrypointSize: IS_WEB ? 2500 * OneKb : 3000 * OneKb,
      maxAssetSize: IS_WEB ? 1800 * OneKb : 3000 * OneKb,
    },
    // Set webpack mode:
    mode: (IS_DEV && "development") || "production",
    // Set webpack context to the current command's directory
    context: process.cwd(),
    // Specify target (either 'node' or 'web')
    target: target, // .replace('node', 'async-node'),
    // Controversially, decide on sourcemaps.
    devtool: (shouldUseSourceMap && IS_DEV && "eval-cheap-module-source-map") || (shouldUseSourceMap && "source-map") || false,
    // We need to tell webpack how to resolve both Razzle's node_modules and
    // the users', so we use resolve and resolveLoader.
    resolve: {
      modules: ["node_modules", paths.appNodeModules].concat(
        // It is guaranteed to exist because we tweak it in `env.js`
        nodePath.split(path.delimiter).filter(Boolean),
      ),
      // descriptionFiles: [],
      extensions: [".js", ".json", ".jsx", ".mjs", ".ts", ".tsx", ".graphql"],
      alias: {
        // This is required so symlinks work during development.
        "webpack/hot/poll": require.resolve("webpack/hot/poll"),
        "webpack/hot/signal": require.resolve("webpack/hot/signal"),
      },
    },
    resolveLoader: {
      modules: [paths.appNodeModules, paths.ownNodeModules],
    },
    module: {
      strictExportPresence: true,
      rules: [
        // Disable require.ensure as it's not a standard language feature.
        // { parser: { requireEnsure: false } },
        ENABLE_LINTING
          ? {
              test: /\.(jsx?|mjs|tsx?)$/,
              enforce: "pre",
              use: [
                {
                  options: {
                    formatter: eslintFormatter,
                    eslintPath: require.resolve("eslint"),
                    ignore: false,
                    useEslintrc: true,
                  },
                  loader: require.resolve("eslint-loader"),
                },
              ],
              include: paths.appSrc,
            }
          : false,
        // Avoid "require is not defined" errors
        {
          test: /\.mjs$/,
          include: /node_modules/,
          type: "javascript/auto",
        },
        // Transform ES6 with Babel
        {
          test: /\.(jsx?|mjs|tsx?)$/,
          include: [paths.appSrc],
          use: [
            require.resolve("thread-loader"),
            {
              loader: require.resolve("babel-loader"),
              options: mainBabelOptions,
            },
          ],
        },
        {
          exclude: [
            /\.html$/,
            /\.(js|jsx|mjs)$/,
            /\.(ts|tsx)$/,
            /\.(vue)$/,
            /\.(less)$/,
            /\.(re)$/,
            /\.(s?css|sass)$/,
            /\.json$/,
            /\.bmp$/,
            /\.gif$/,
            /\.jpe?g$/,
            /\.png$/,
          ],
          loader: require.resolve("file-loader"),
          options: {
            name: "static/media/[name].[contenthash:8].[ext]",
            emitFile: true,
          },
        },
        // "url" loader works like "file" loader except that it embeds assets
        // smaller than specified limit in bytes as data URLs to avoid requests.
        // A missing `test` is equivalent to a match.
        {
          test: [/\.bmp$/, /\.gif$/, /\.jpe?g$/, /\.png$/],
          loader: require.resolve("url-loader"),
          options: {
            limit: 10000,
            name: "static/media/[name].[contenthash:8].[ext]",
            emitFile: true,
          },
        },
        // add graphql-tag
        {
          test: /\.(graphql|gql)$/,
          exclude: /node_modules/,
          loader: "graphql-tag/loader",
        },

        // "postcss" loader applies autoprefixer to our CSS.
        // "css" loader resolves paths in CSS and adds assets as dependencies.
        // "style" loader turns CSS into JS modules that inject <style> tags.
        // In production, we use a plugin to extract that CSS to a file, but
        // in development "style" loader enables hot editing of CSS.
        //
        // Note: this yields the exact same CSS config as create-react-app.
        {
          test: /\.css$/,
          exclude: [paths.appBuild, /\.module\.css$/],
          use: IS_NODE
            ? // Style-loader does not work in Node.js without some crazy
              // magic. Luckily we just need css-loader.
              [
                {
                  loader: require.resolve("css-loader"),
                  options: {
                    importLoaders: 1,
                  },
                },
              ]
            : IS_DEV
            ? [
                require.resolve("style-loader"),
                {
                  loader: require.resolve("css-loader"),
                  options: {
                    importLoaders: 1,
                  },
                },
                {
                  loader: require.resolve("postcss-loader"),
                },
              ]
            : [
                MiniCssExtractPlugin.loader,
                {
                  loader: require.resolve("css-loader"),
                  options: {
                    importLoaders: 1,
                    modules: false,
                    // minimize: true,
                  },
                },
                {
                  loader: require.resolve("postcss-loader"),
                },
              ],
        },
        // Adds support for CSS Modules (https://github.com/css-modules/css-modules)
        // using the extension .module.css
        {
          test: /\.module\.css$/,
          exclude: [paths.appBuild],
          use: IS_NODE
            ? [
                {
                  // on the server we do not need to embed the css and just want the identifier mappings
                  // https://github.com/webpack-contrib/css-loader#scope
                  loader: require.resolve("css-loader"),
                  options: {
                    modules: true,
                    importLoaders: 1,
                    exportOnlyLocals: true,
                    localIdentName: "[path]__[name]___[local]",
                  },
                },
              ]
            : IS_DEV
            ? [
                require.resolve("style-loader"),
                {
                  loader: require.resolve("css-loader"),
                  options: {
                    modules: true,
                    importLoaders: 1,
                    localIdentName: "[path]__[name]___[local]",
                  },
                },
                {
                  loader: require.resolve("postcss-loader"),
                },
              ]
            : [
                MiniCssExtractPlugin.loader,
                {
                  loader: require.resolve("css-loader"),
                  options: {
                    modules: true,
                    importLoaders: 1,
                    // minimize: true,
                    localIdentName: "[path]__[name]___[local]",
                  },
                },
                {
                  loader: require.resolve("postcss-loader"),
                },
              ],
        },
      ].filter(Boolean),
    },
  }

  if (IS_NODE) {
    if (webpackVersion < 5) {
      // We want to uphold node's __filename, and __dirname.
      // config.node = {
      //   __console: false,
      //   __dirname: false,
      //   __filename: false,
      //   // fs: 'empty',
      //   // child_process: 'empty',
      // }
    }

    // We need to tell webpack what to bundle into our Node bundle.
    config.externals = [
      nodeExternals({
        allowlist: [
          IS_DEV ? "webpack/hot/signal" : null,
          IS_DEV ? "webpack/hot/poll?300" : null,
          /\.(eot|woff|woff2|ttf|otf)$/,
          /\.(svg|png|jpg|jpeg|gif|ico)$/,
          /\.(mp4|mp3|ogg|swf|webp)$/,
          /\.(css|scss|sass|sss|less)$/,
        ].filter((x) => !!x),
      }),
    ]

    // Specify webpack Node.js output path and filename
    config.output = {
      path: paths.appBuild,
      publicPath: IS_DEV ? `http://${dotenv.settings.HOST}:${devServerPort}/` : "/",
      filename: `[name].js`,
      // https://webpack.js.org/configuration/output/#module-definition-systems
      libraryTarget: "commonjs2",
    }
    // Add some plugins...
    config.plugins = [
      // Prevent creating multiple chunks for the server
      new webpack.optimize.LimitChunkCountPlugin({
        maxChunks: 1,
      }),
      // Add specific defines:
      new webpack.DefinePlugin(
        Object.assign(
          {
            ASSETS_PATH: JSON.stringify(paths.appWebpackAssets),
          },
          dotenv.stringified,
        ),
      ),
    ]

    config.entry = {
      server: [paths.appServerIndexJs],
    }
    if (IS_PROD) {
      // ;["repl", "sql", "worker", "db-migrate", "db-rollback", "db-seed", "db-reset", "process-job"].forEach((script) => {
      //   config.entry[script] = `${paths.appScripts}/${script}.ts`
      // })
      config.optimization = {
        minimize: true,
        minimizer: [
          // instruct terser to accept es module syntax:
          new TerserPlugin({
            terserOptions: {
              ecma: 2020,
              parse: {
                bare_returns: true,
              },
              toplevel: true,
              module: true,
            },
            parallel: true,
            // Enable file caching
            cache: false,
            sourceMap: shouldUseSourceMap,
          }),
        ].filter(Boolean),
      }
    }

    if (IS_DEV) {
      // Use watch mode
      config.watch = true
      config.entry.server.unshift("webpack/hot/poll?300")
      config.entry.server.unshift("webpack/hot/signal")

      // Pretty format server errors
      // config.entry.server.unshift(require.resolve("../../razzle-dev-utils/prettyNodeErrors"))

      const nodeArgs = shouldUseSourceMap ? ["-r", "source-map-support/register"] : []

      // Passthrough --inspect and --inspect-brk flags (with optional [host:port] value) to node
      if (process.env.INSPECT_BRK) {
        nodeArgs.push(process.env.INSPECT_BRK)
      } else if (process.env.INSPECT) {
        nodeArgs.push(process.env.INSPECT)
      }

      // config.plugins = [
      //   ...config.plugins,
      //   // Add hot module replacement
      //   new webpack.HotModuleReplacementPlugin(),
      //   // Supress errors to console (we use our own logger)
      //   new StartServerPlugin({
      //     entryName: "server",
      //     nodeArgs,
      //     // signal: true,
      //   }),
      //   // Ignore webpack-assets.json to avoid infinite recompile bug
      //   new webpack.WatchIgnorePlugin({ paths: [paths.appWebpackAssets] }),
      // ]
    }
  }

  if (IS_WEB) {
    config.plugins = [
      // We define environment variables that can be accessed globally in our
      new webpack.DefinePlugin(dotenv.stringified),
      // Output our JS and CSS files in a manifest file called webpack-assets.json
      // in the build directory.
      getAssetsPluginInstance(IS_DEV),
      new BundleAnalyzerPlugin({
        analyzerMode: IS_PROD ? "static" : "disabled",
        generateStatsFile: IS_PROD,
        reportFilename: `bundle-analyzer${isModernSuffix}.html`,
        openAnalyzer: false,
      }),
    ]

    if (IS_PROD) {
      config.recordsPath = path.join(paths.appBuild, `records${isModernSuffix}.json`)
    }
    // specify our client entry point /client/index.js
    config.entry = {
      client: [
        require.resolve(`./polyfills/polyfills${isModernSuffix}`),
        shouldUseReactRefresh || IS_PROD ? null : null,
        paths.appClientIndexJs,
      ].filter(Boolean),
    }

    if (IS_DEV) {
      // Configure our client bundles output. Not the public path is to 3001.
      config.output = {
        path: paths.appBuildPublic,
        publicPath: `http://${dotenv.settings.HOST}:${devServerPort}/`,
        pathinfo: true,
        // this is auto set by experiments.outputModule
        // libraryTarget: "var",
        filename: `static/js/bundle.[name].${jsFileExt}`,
        chunkFilename: `static/js/[name].chunk.${jsFileExt}`,
        devtoolModuleFilenameTemplate: (info) => path.resolve(info.resourcePath).replace(/\\/g, "/"),
      }
      // Configure webpack-dev-server to serve our client-side bundle from
      // http://${dotenv.settings.HOST}:3001
      config.devServer = {
        disableHostCheck: true,
        // clientLogLevel: "silent",
        // clientLogLevel: "debug",
        // Enable gzip compression of generated files.
        compress: true,
        // watchContentBase: true,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
        historyApiFallback: {
          // Paths with dots should still use the history fallback.
          // See https://github.com/facebookincubator/create-react-app/issues/387.
          disableDotRule: true,
        },
        host: dotenv.settings.HOST,
        // Enable hot reloading server. It will provide /sockjs-node/ endpoint
        // for the WebpackDevServer client so it can learn when the files were
        // updated. The WebpackDevServer client is included as an entry point
        // in the Webpack development configuration. Note that only changes
        // to CSS are currently hot reloaded. JS changes will refresh the browser.
        hot: true,
        // Use 'ws' instead of 'sockjs-node' on server since we're using native
        // websockets in `webpackHotDevClient`.
        transportMode: "ws",
        contentBase: false,
        // Prevent a WS client from getting injected as we're already including
        // `webpackHotDevClient` with shouldUseReactRefresh.
        // injectClient: !shouldUseReactRefresh,
        // noInfo: true,
        port: devServerPort,
        // WebpackDevServer is noisy by default so we emit custom message instead
        // by listening to the compiler events with `compiler.hooks[...].tap` calls above.
        // quiet: true,
        // Reportedly, this avoids CPU overload on some systems.
        // https://github.com/facebook/create-react-app/issues/293
        // src/node_modules is not ignored to support absolute imports
        // https://github.com/facebook/create-react-app/issues/1065
        watchOptions: {
          ignored: ignoredFiles(paths.appSrc),
        },
      }
      // Add client-only development plugins
      config.plugins = [
        ...config.plugins,
        new webpack.HotModuleReplacementPlugin({
          multiStep: true,
        }),
        shouldUseReactRefresh
          ? new ReactRefreshWebpackPlugin({
              // overlay: {
              //   entry: webpackDevClientEntry,
              // },
            })
          : null,
      ].filter(Boolean)

      // config.optimization = splitChunkOptimizations
    } else {
      // Specify the client output directory and paths. Notice that we have
      // changed the publiPath to just '/' from http://localhost:3001. This is because
      // we will only be using one port in production.
      config.output = {
        path: paths.appBuildPublic,
        publicPath: "/",
        filename: `static/js/bundle.[name].[chunkhash:8].${jsFileExt}`,
        chunkFilename: `static/js/[name].[chunkhash:8].chunk.${jsFileExt}`,
      }

      config.plugins = [
        ...config.plugins,
        // Extract our CSS into a files.
        new MiniCssExtractPlugin({
          filename: "static/css/bundle.[name].[contenthash:8].css",
          // allChunks: true because we want all css to be included in the main
          // css bundle when doing code splitting to avoid FOUC:
          // https://github.com/facebook/create-react-app/issues/2415
          allChunks: true,
        }),
      ]

      if (dotenv.settings.PUBLIC_USES_SW) {
        const workboxOptions = {
          // Exclude assets that belong to these chunks:
          excludeChunks: ["admin"],
          // only include mjs in modern, js in non
          include: [IS_MODERN_BUILD ? /.(mjs|css)$/ : /.(js|css)$/, /app-shell/],
          // importsDirectory: 'static',
        }
        // config.plugins.push(new WorkboxPlugin.InjectManifest(Object.assign({
        //   swSrc: './src/service-worker.js',
        // },workboxOptions)))
        config.plugins.push(
          new WorkboxPlugin.GenerateSW(
            Object.assign(
              {
                swDest: SW_FILE_NAME,
                // these options encourage the ServiceWorkers to get in there fast
                // and not allow any straggling "old" SWs to hang around
                clientsClaim: true,
                skipWaiting: true,
              },
              workboxOptions,
            ),
          ),
        )
      }

      // https://github.com/babel/preset-modules#important-minification
      const terserOptions = (IS_MODERN_BUILD && {
        ecma: 8,
        safari10: true,
        module: IS_ES_MODULES,
        toplevel: IS_ES_MODULES,
      }) || {
        parse: {
          // we want terser to parse ecma 8 code. However, we don't want it
          // to apply any minfication steps that turns valid ecma 5 code
          // into invalid ecma 5 code. This is why the 'compress' and 'output'
          // sections only apply transformations that are ecma 5 safe
          // https://github.com/facebook/create-react-app/pull/4234
          ecma: 8,
        },
        compress: {
          ecma: 5,
          warnings: false,
          // Disabled because of an issue with Uglify breaking seemingly valid code:
          // https://github.com/facebook/create-react-app/issues/2376
          // Pending further investigation:
          // https://github.com/mishoo/UglifyJS2/issues/2011
          comparisons: false,
          // Disabled because of an issue with Terser breaking valid code:
          // https://github.com/facebook/create-react-app/issues/5250
          // Pending futher investigation:
          // https://github.com/terser-js/terser/issues/120
          inline: 2,
        },
        mangle: {
          safari10: true,
        },
        output: {
          ecma: 5,
          comments: false,
          // Turned on because emoji and regex is not minified properly using default
          // https://github.com/facebook/create-react-app/issues/2488
          ascii_only: true,
        },
      }

      config.optimization = {
        minimize: true,
        // https://webpack.js.org/configuration/optimization/#optimizationmoduleids
        moduleIds: "deterministic",
        minimizer: [
          // This is only used in production mode
          new TerserPlugin({
            terserOptions: terserOptions,
            // Use multi-process parallel running to improve the build speed
            // Default number of concurrent runs: os.cpus().length - 1
            // Disabled on WSL (Windows Subsystem for Linux) due to an issue with Terser
            // https://github.com/webpack-contrib/terser-webpack-plugin/issues/21
            parallel: true,
            // Enable file caching
            cache: false,
            sourceMap: shouldUseSourceMap,
          }),
        ].filter(Boolean),
        ...splitChunkOptimizations,
      }
    }
  }

  if (!isCi) {
    config.plugins = [...config.plugins, new webpack.ProgressPlugin({ percentBy: "entries", profile: !IS_DEV })]
  }

  // remove momentjs from build
  // https://github.com/chartjs/Chart.js/blob/f2b099b835bf5d6dfe3a7d3097997ec11983c3ed/docs/getting-started/integration.md#bundlers-webpack-rollup-etc
  if (IS_WEB && IS_PROD) {
    config.externals = config.externals || {}
    // config.externals.moment = "moment"
  }

  // NOTE qac: webpack 5 only!
  if (webpackVersion > 4 && config.output) {
    // these are set automatically by `outputModule`:
    // https://webpack.js.org/configuration/experiments/#experiments
    if (IS_ES_MODULES) {
      config.output.module = true
      config.output.libraryTarget = "module"
    }

    config.experiments = {
      // mjs: IS_MODERN_BUILD,
      outputModule: IS_ES_MODULES,
      // syncWebAssembly: true,
      // topLevelAwait: true,
      // asset: true,
      // asyncWebAssembly: true,
      // importAsync: true,
      // importAwait: true,
    }

    // experimental: https://webpack.js.org/configuration/other-options/#cache
    if (IS_DEV) {
      config.cache = {
        type: "filesystem",
        cacheLocation: findCacheDir({ name: `webpack-${cachePrefix}` }),
      }
    }
  }

  return config
}
