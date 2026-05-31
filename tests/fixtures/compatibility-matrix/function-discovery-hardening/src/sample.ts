export namespace N {
  export class C {
    method(flag: boolean): number {
      if (flag) {
        return 1;
      }
      return 0;
    }
  }

  export const obj = {
    outer: {
      inner(flag: boolean): number {
        if (flag) {
          return 1;
        }
        return 0;
      }
    }
  };
}

export class Holder {
  static tools = {
    run(flag: boolean): number {
      if (flag) {
        return 1;
      }
      return 0;
    }
  };

  field = {
    value: (flag: boolean): number => flag ? 1 : 0
  };
}

export const registry: Record<string, (flag: boolean) => number> = {};
registry["static"] = function (flag: boolean): number {
  if (flag) {
    return 1;
  }
  return 0;
};
