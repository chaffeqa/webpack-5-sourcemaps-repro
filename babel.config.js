// module.exports = (api) => {
// api.cache(false)
// console.log(`babel.config.js:`)
// console.dir(api)
// api.caller((caller) => console.dir(caller))
// api.env((env) => console.dir(env))
// https://github.com/facebook/create-react-app/blob/next/packages/babel-preset-react-app/index.js
// alternative:
// https://gist.github.com/nodkz/41e189ff22325a27fe6a5ca81df2cb91

// This is similar to how `env` works in Babel:
// https://babeljs.io/docs/entry/babelrc/#env-option
// We are not using `env` because it’s ignored in versions > babel-core@6.10.4:
// https://github.com/babel/babel/issues/4539
// https://github.com/facebook/create-react-app/issues/720
// It’s also nice that we can enforce `NODE_ENV` being specified.
const env = process.env.BABEL_ENV || process.env.NODE_ENV
// api.env((_env) => (env = _env))
if (env !== "development" && env !== "test" && env !== "production") {
  throw new Error(
    "Specify `NODE_ENV` or " +
      '`BABEL_ENV` environment variables. Valid values are "development", ' +
      '"test", and "production". Instead, received: ' +
      JSON.stringify(env) +
      ".",
  )
}

const isEnvDevelopment = env === "development"
const isEnvProduction = env === "production"
const isEnvTest = env === "test"

// NOTE qac: since we compile sometimes at the same time, we cannot use the env var approach
// var platform = process.env.APP_PLATFORM || 'web'
// console.warn(`----- platform: ${env} (${process.env.NODE_ENV}, ${process.env.BABEL_ENV})`)
// var targets = platform === 'web' ? {} : { node: 'current' }

const presetEnvConfig = {
  // `entry` transforms `@babel/polyfill` into individual requires for
  // the targeted browsers. This is safer than `entry` which performs
  // static code analysis to determine what's required.
  // This is probably a fine default to help trim down bundles when
  // end-users inevitably import '@babel/polyfill'.
  useBuiltIns: "usage",
  // Transform modules to CJS?
  // In the test environment `modules` is often needed to be set to true, babel figures that out by itself using the `'auto'` option
  // In production/development this option is set to `false` so that webpack can handle import/export with tree-shaking
  modules: "auto",
  // Debug
  // debug: true,
  // NOTE qac: see above
  // targets: targets,
  // Exclude transforms that make all code slower
  exclude: ["transform-typeof-symbol"],
  corejs: 3,
}
// NOTE qac: we override this in webpack (for node vs non-node version)
if (isEnvTest) {
  presetEnvConfig.targets = {
    node: "current",
  }
}

const config = {
  // https://github.com/babel/babel/issues/7074
  // passPerPreset: true,
  presets: [
    [
      // Latest stable ECMAScript features
      "@babel/preset-env",
      presetEnvConfig,
    ],
    [
      "@babel/preset-react",
      {
        // Adds component stack to warning messages
        // Adds __self attribute to JSX which React will use for some warnings
        development: isEnvDevelopment || isEnvTest,
        // Will use the native built-in instead of trying to polyfill
        // behavior for any plugins that require one.
        useBuiltIns: true,
      },
    ],
    ["@babel/preset-typescript"],
  ].filter(Boolean),
  plugins: [
    [
      "const-enum",
      {
        transform: "constObject",
      },
    ],
    isEnvProduction && "babel-plugin-annotate-pure-calls",
    // https://github.com/lodash/babel-plugin-lodash
    isEnvProduction && "lodash",
    // https://github.com/4Catalyzer/babel-plugin-dev-expression
    "babel-plugin-dev-expression",
    // Experimental macros support. Will be documented after it's had some time
    // in the wild.
    "babel-plugin-macros",
    // https://www.styled-components.com/docs/tooling#babel-plugin
    [
      "babel-plugin-styled-components",
      {
        ssr: true,
        preprocess: isEnvProduction,
        displayName: true,
        transpileTemplateLiterals: isEnvProduction,
        pure: isEnvProduction,
      },
    ],
    // class { handleClick = () => { } }
    // Enable loose mode to use assignment instead of defineProperty
    // See discussion in https://github.com/facebook/create-react-app/issues/4263
    [
      "@babel/plugin-proposal-class-properties",
      {
        loose: true,
      },
    ],
    // The following two plugins use Object.assign directly, instead of Babel's
    // extends helper. Note that this assumes `Object.assign` is available.
    // { ...todo, completed: true }
    [
      "@babel/plugin-proposal-object-rest-spread",
      {
        useBuiltIns: true,
      },
    ],
    // Polyfills the runtime needed for async/await, generators, and friends
    // https://babeljs.io/docs/en/babel-plugin-transform-runtime
    // [
    //   "@babel/plugin-transform-runtime",
    //   {
    //     corejs: 3,
    //     // https://babeljs.io/docs/en/babel-plugin-transform-runtime#useesmodules
    //     // NOTE qac: for some reason, removing this causes server build to fail???
    //     helpers: true,
    //     regenerator: true,
    //     // We should turn this on once the lowest version of Node LTS supports ES Modules.
    //     // NOTE qac: previously was only `true` for `isEnvTest`... now we should just enable it?
    //     useESModules: false, // isEnvTestq,
    //     // Undocumented option that lets us encapsulate our runtime, ensuring
    //     // the correct version is used
    //     // https://github.com/babel/babel/blob/090c364a90fe73d36a30707fc612ce037bdbbb24/packages/babel-plugin-transform-runtime/src/index.js#L35-L42
    //     // absoluteRuntime: absoluteRuntimePath,
    //   },
    // ],
    [
      "polyfill-corejs3",
      {
        method: "entry-global",
        // "targets": { "firefox": 42 }
      },
    ],
    isEnvProduction && [
      // Remove PropTypes from production build
      "babel-plugin-transform-react-remove-prop-types",
      {
        removeImport: true,
      },
    ],
    // function* () { yield 42; yield 43; }
    // !isEnvTest && [
    //   '@babel/plugin-transform-regenerator',
    //   {
    //     // Async functions are converted to generators by @babel/preset-env
    //     async: false,
    //   },
    // ],
    isEnvTest &&
      // compile down to commonjs
      "@babel/plugin-transform-modules-commonjs",
    // Adds syntax support for import()
    "@babel/plugin-syntax-dynamic-import",
    // // F U IE
    // '@babel/plugin-transform-arrow-functions',
    // [
    //   '@babel/plugin-transform-parameters',
    //   {
    //     loose: true,
    //   },
    // ],
    isEnvTest &&
      // Transform dynamic import to require
      "babel-plugin-transform-dynamic-import",
    // 'dynamic-import-node',
  ].filter(Boolean),
}

// Co-locate .graphql files
// TODO qac: we are using import for production, and graphql-tag for dev based on dx
// https://www.apollographql.com/docs/react/recipes/babel.html
// config.plugins.push(isEnvProduction ? 'import-graphql' : 'graphql-tag')
config.plugins.push("graphql-tag")
// return config
// }

module.exports = config
