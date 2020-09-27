#! /usr/bin/env node

// Do this as the first thing so that any code reading it knows the right env.
import fs from "fs-extra"
import webpack from "webpack"
import env from "./env.js"
import paths from "./paths.js"
import createConfig from "./webpack.config.js"

if (env.settings.NODE_ENV !== "production") {
  throw new Error(`build must be called with process.env.NODE_ENV = "production"`)
}
const isCi = process.env.CI && (typeof process.env.CI !== "string" || process.env.CI.toLowerCase() !== "false")
// Remove all content but keep the directory so that
// if you're in it, you don't end up in Trash
fs.emptyDirSync(paths.appBuild)

console.log("Creating an optimized production build...")
// const webConfig = createConfig("web", "prod")
// const webModernConfig = createConfig("web", "prod", true)
const serverConfig = createConfig("node", "prod")
try {
  // https://webpack.js.org/api/node/#multicompiler
  // First compile the client. We need it to properly output webpack-assets.json (asset
  // manifest file with the correct hashes on file names BEFORE we can start
  // the server compiler.
  const compiler = webpack([serverConfig]) // webpack([webModernConfig, webConfig, serverConfig])
  const webpackStats = await new Promise((resolve, reject) => {
    compiler.run((err, stats) => {
      if (err) {
        reject(err)
      } else {
        const info = stats.toJson()
        if (stats.hasErrors()) {
          reject(info.errors)
        } else {
          const hasWarnings = stats.hasWarnings()

          if (hasWarnings && isCi) {
            console.warn(`Is CI and compiled with warnings: marking as failed`)
            reject(info.warnings)
          } else {
            if (hasWarnings) {
              console.warn(info.warnings)
            }
            resolve(stats)
          }
        }
      }
    })
  })
  console.log(`Finished with stats:`)
  console.log(webpackStats)
} catch (error) {
  console.error(`Failed in compile:`)
  console.error(error)
  if (error.stack) {
    console.error(`Stack:`)
    console.error(error.stack)
  }
  if (error.details) {
    console.error(`Details:`)
    console.error(error.details)
  }
  process.exit(1)
}
