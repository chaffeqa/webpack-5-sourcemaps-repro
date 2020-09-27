
// lets use similar to https://www.robertcooper.me/using-eslint-and-prettier-in-a-typescript-project
module.exports = {
  // semicolons are noisy...
  semi: false,
  // use false here, so that its easier to add properties
  trailingComma: "all",
  // i dont know about this one...
  singleQuote: false,
  // let lines be longer, sometimes thats actually easier to read imo
  printWidth: 150,
  // much cleaner than 4
  tabWidth: 2
};
