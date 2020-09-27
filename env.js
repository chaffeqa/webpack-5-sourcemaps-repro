/* eslint-disable @typescript-eslint/no-var-requires */
// const paths = require('./paths');
const fs = require("fs")
const path = require("path")
const child_process = require("child_process")
const settings = require("./settings")

// Make sure that including paths.js after env.js will read .env variables.
delete require.cache[require.resolve("./paths")]

const NODE_ENV = process.env.NODE_ENV
if (!NODE_ENV) {
  throw new Error("The NODE_ENV environment variable is required but was not specified.")
}

const getGitRevision = () => {
  try {
    return child_process.execSync("git rev-parse HEAD").toString("utf8")
  } catch (err) {
    console.warn("Failed to read GIT_REVISION")
    return "unknown"
  }
}

// We support resolving modules according to `NODE_PATH`.
// This lets you use absolute paths in imports inside large monorepos:
// https://github.com/facebookincubator/create-react-app/issues/253.
// It works similar to `NODE_PATH` in Node itself:
// https://nodejs.org/api/modules.html#modules_loading_from_the_global_folders
// Note that unlike in Node, only *relative* paths from `NODE_PATH` are honored.
// Otherwise, we risk importing Node.js core modules into an app instead of Webpack shims.
// https://github.com/facebookincubator/create-react-app/issues/1023#issuecomment-265344421
// We also resolve them to make sure all tools using them work consistently.
const appDirectory = fs.realpathSync(process.cwd())
const nodePath = (process.env.NODE_PATH || "")
  .split(path.delimiter)
  .filter((folder) => folder && !path.isAbsolute(folder))
  .map((folder) => path.resolve(appDirectory, folder))
  .join(path.delimiter)

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getClientEnvironment(target, _options) {
  const GIT_REVISION = process.env.GIT_REVISION || getGitRevision()
  const isServer = target === "node"
  const raw = {
    // Useful for determining whether we’re running in production mode.
    // Most importantly, it switches React into the correct mode.
    NODE_ENV: settings.NODE_ENV,
    APP_ENV: settings.APP_ENV,
    PORT: settings.PORT,
    DEV_SERVER_PORT: settings.DEV_SERVER_PORT,
    HOST: settings.HOST,
    GIT_REVISION: GIT_REVISION,
    DOCKER_BUILD: settings.DOCKER_BUILD,
    APP_PLATFORM: target,
    // RAZZLE_ASSETS_MANIFEST: paths.appWebpackAssets,
    // BUILD_TARGET: target === 'web' ? 'client' : 'server',
  }
  // lets be nice about adding app specific env vars and add anything with PUBLIC_
  Object.keys(process.env)
    .filter((key) => /^PUBLIC_/.test(key.toString()))
    .forEach((key) => (raw[key] = process.env[key]))
  // Stringify all values so we can feed into Webpack DefinePlugin
  const stringified = {
    "process.env": Object.keys(raw).reduce((env, key) => {
      env[key] = JSON.stringify(raw[key])
      return env
    }, {}),
    // Help eliminate dead code
    "process.env.NODE_ENV": JSON.stringify(settings.NODE_ENV),
    "typeof window": isServer ? "undefined" : "object",
    "process.browser": isServer ? false : true,
  }

  return { stringified, settings }
}

module.exports = {
  getClientEnv: getClientEnvironment,
  settings: settings,
  nodePath: nodePath,
}
