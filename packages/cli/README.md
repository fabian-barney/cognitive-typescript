# @barney-media/cognitive-typescript

CLI for Cognitive Complexity analysis in TypeScript projects.

## Install

```bash
npm install --save-dev @barney-media/cognitive-typescript
```

## Usage

```bash
npx cognitive-typescript
npx cognitive-typescript --changed
npx cognitive-typescript src/sample.ts
npx cognitive-typescript packages/api packages/web
```

## Options

```text
--help                       Print usage to stdout
(no args)                    Analyze all TypeScript files under any nested src/ tree
--changed                    Analyze changed TypeScript files under src/
<file ...>                   Analyze explicit TypeScript files
<directory ...>              Analyze TypeScript files under each directory's nested src/ tree
```

## Exit Codes

- `0` success, threshold respected
- `1` invalid CLI usage or execution failure
- `2` Cognitive Complexity threshold exceeded (`> 25`)

See the [main repository](https://github.com/fabian-barney/cognitive-typescript) for full details.

## License

[Apache-2.0](https://github.com/fabian-barney/cognitive-typescript/blob/main/LICENSE)
