module.exports = class CustomReporter {
  onRunComplete() {
    console.log("CUSTOM_REPORTER_FINISHED");
  }
};
