const appVersion = "0.1.0";
const commitId = process.env.EXPO_PUBLIC_COMMIT_ID?.trim() || "dev";

export const appBuildLabel = `Paynest v${appVersion}-${commitId}`;
