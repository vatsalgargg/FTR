// Prints findings as GitHub annotations in Actions and as plain lines locally.

const inActions = process.env.GITHUB_ACTIONS === "true";
const escapeData = value => String(value).replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
const escapeProperty = value => escapeData(value).replace(/:/g, "%3A").replace(/,/g, "%2C");

export function createReporter(name) {
  let errors = 0;
  let warnings = 0;

  function emit(level, file, line, message) {
    if (level === "error") errors++;
    else warnings++;
    if (inActions) {
      const location = file ? ` file=${escapeProperty(file)}${line ? `,line=${line}` : ""}` : "";
      console.log(`::${level}${location}::${escapeData(message)}`);
    } else {
      const where = file ? `${file}${line ? `:${line}` : ""}  ` : "";
      console.log(`${level === "error" ? "ERROR" : "WARN "}  ${where}${message}`);
    }
  }

  return {
    error: (file, line, message) => emit("error", file, line, message),
    warn: (file, line, message) => emit("warning", file, line, message),
    get errors() { return errors; },
    finish() {
      console.log(`\n${name}: ${errors} error(s), ${warnings} warning(s)`);
      if (errors) process.exitCode = 1;
    },
  };
}
