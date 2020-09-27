/* eslint-disable @typescript-eslint/no-var-requires */
const path = require("path")
const fs = require("fs")
// const url = require('url');

// Make sure any symlinks in the project folder are resolved:
// https://github.com/facebookincubator/create-react-app/issues/637
const appDirectory = fs.realpathSync(process.cwd())
const resolveApp = (relativePath) => path.resolve(appDirectory, relativePath)

const resolveOwn = (relativePath) => path.resolve(__dirname, "..", relativePath)

const nodePaths = (process.env.NODE_PATH || "")
  .split(process.platform === "win32" ? ";" : ":")
  .filter(Boolean)
  .filter((folder) => !path.isAbsolute(folder))
  .map(resolveApp)

module.exports = {
  appPath: resolveApp("."),
  appBuild: resolveApp("build"),
  appBuildPublic: resolveApp("build/public"),
  appWebpackAssets: resolveApp("build/webpack-assets.json"),
  appPublic: resolveApp("src/server/public"),
  appNodeModules: resolveApp("node_modules"),
  appSrc: resolveApp("src"),
  appPackageJson: resolveApp("package.json"),
  appServerIndexJs: resolveApp("src"),
  appScripts: resolveApp("src/scripts"),
  appServerRepl: resolveApp("src/scripts/repl.ts"),
  appServerSql: resolveApp("src/scripts/sql.ts"),
  appServerWorker: resolveApp("src/scripts/worker.ts"),
  appClientIndexJs: resolveApp("src/client"),
  nodePaths: nodePaths,
  ownPath: resolveOwn("."),
  ownNodeModules: resolveOwn("node_modules"),
}
