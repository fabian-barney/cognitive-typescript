export const namespaceWrapper = function () {
  let counter = 0;
  registry.handler = function () {
    if (counter > 0) {
      return 1;
    }
    return 0;
  };
};

export const nonDeclarativeWrapper = function (flag: boolean) {
  if (flag) {
    return 1;
  }
  registry.secondary = function () {
    if (flag) {
      return 1;
    }
    return 0;
  };
  return 0;
};
