/**
 * WindStack SDK
 * Created by Gilang Ramadan
 * Copyright (c) 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
 * SPDX-License-Identifier: MIT
 */
import { verifyCurrentCandidate } from "./release-artifacts.mjs";

const candidate = await verifyCurrentCandidate();
console.log(
  `Release candidate verified: ${candidate.manifest.version} @ ${candidate.manifest.gitSha}`,
);
for (const entry of candidate.packages) {
  console.log(`- ${entry.filename}  ${entry.sha256}`);
}
