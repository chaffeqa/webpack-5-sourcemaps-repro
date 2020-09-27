const getOverrideFor = (key: string, defaultValue: any): string => {
  // if (key === "PUBLIC_SMTP_ENABLED") {
  //   console.log(`key: ${key} '${process.env.PUBLIC_SMTP_ENABLED}'`);
  // }
  return (key in process.env ? process.env[key] : defaultValue).toString()
}

// For the most part, we only want require APP_ENV and NODE_ENV
// Everything else should be correctly configured based on these
const NODE_ENV = getOverrideFor("NODE_ENV", "development")
// NOTE qac: IS_DOCKER is more of "is running inside of Dockerfile"
const IS_DOCKER = getOverrideFor("IS_DOCKER", false) === "true"
const IS_CI = getOverrideFor("CI", false) === "true"
const APP_ENV = getOverrideFor("APP_ENV", IS_DOCKER ? "dev" : "local")
const FORWARD_ENV = getOverrideFor("FORWARD_ENV", "dev")
// NOTE qac: use this flag with understanding that the setting should be consistent with prod ALWAYS
const IS_PRODISH = ["qa", "prod"].includes(APP_ENV)
const IS_LOCAL = ["local"].includes(APP_ENV)
const IS_PROD = ["prod"].includes(APP_ENV)
const IS_TEST_ENV = ["test"].includes(APP_ENV)
const IS_LOCALISH = ["local", "test"].includes(APP_ENV)
const APP_LOG_LEVEL = getOverrideFor("APP_LOG_LEVEL", (IS_LOCAL && "DEBUG") || (IS_TEST_ENV && "INFO") || "INFO").toUpperCase()
const PORT = parseInt(getOverrideFor("PORT", 4000), 10)

const settings = {
  //  Overall toggle:
  NODE_ENV,
  APP_ENV,
  IS_DOCKER,
  FORWARD_ENV,
  IS_PRODISH,
  IS_LOCALISH,
  IS_LOCAL,
  IS_PROD,
  IS_CI,
  IS_TEST_ENV,

  // NOTE qac: anything we want to appear in the client side HAS to be prefixed with PUBLIC_

  //  Server values:
  HOST: getOverrideFor("HOST", IS_DOCKER ? "0.0.0.0" : "localhost"), //  NOTE qac: its ok to switch this since MOST docker implementations
  APP_LOG_LEVEL,
  // NOTE qac: docker setup uses TASK=worker, ect here
  APP_RUN_CONTEXT: process.env.APP_RUN_CONTEXT || process.env.TASK || "unknown",
  PROTOCOL: getOverrideFor("PROTOCOL", IS_LOCALISH ? "http:" : "https:"),
  APOLLO_ENGINE_LOGGING_LEVEL: getOverrideFor("APOLLO_ENGINE_LOGGING_LEVEL", APP_LOG_LEVEL.toUpperCase()),
  APP_PRINT_SQL: getOverrideFor("APP_PRINT_SQL", APP_LOG_LEVEL.toUpperCase() === "DEBUG") === "true",
  PORT,

  // *************************************************
  // public (available to the frontend + constants!)
  // all have to start with PUBLIC_

  // flags
  CACHE_PUBLIC_PAGINATION_ENABLED: getOverrideFor("CACHE_PUBLIC_PAGINATION_ENABLED", false) === "true",
  PUBLIC_MESSAGE_BOARD_ENABLED: getOverrideFor("PUBLIC_MESSAGE_BOARD_ENABLED", !IS_PRODISH) === "true",
  PUBLIC_SMTP_ENABLED: getOverrideFor("PUBLIC_SMTP_ENABLED", true) === "true",
  PUBLIC_FRONTEND_PROXY_ENV: getOverrideFor("PUBLIC_FRONTEND_PROXY_ENV", ""),
  PUBLIC_USES_SW: getOverrideFor("PUBLIC_USES_SW", false) === "true",
  PUBLIC_FRONTEND_USES_WS: getOverrideFor("PUBLIC_FRONTEND_USES_WS", false) === "true",
}

export default settings
