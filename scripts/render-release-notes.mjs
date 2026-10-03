import { readFile } from "node:fs/promises";
import { releaseNotes } from "./release-lib.mjs";

const tagRef = process.argv[2] ?? process.env.GITHUB_REF_NAME;
if (!tagRef) throw new Error("A tag name is required.");
const version = tagRef.startsWith("v") ? tagRef.slice(1) : tagRef;
const changelog = await readFile("CHANGELOG.md", "utf8");
process.stdout.write(releaseNotes(changelog, version) + "\n");
