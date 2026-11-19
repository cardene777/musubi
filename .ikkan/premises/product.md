# 目的と利用者

musubiは、あるエージェントのスキルが出す中身 (書式、書き方の決まり、検査) を、その中身に従う別のスキルと名前と版で結ぶ提案である (`README.md`)。
利用者は、スキルを書く人と、スキルを読むエージェント (Claude Code、Codex、GitHub Copilot CLI、Gemini CLIなど `SKILL.md` を読む物) である (`README.md`)。
スキルを入れて版を固定する道具 (APM、skillpm、skillcaskなど) は対象の外で、musubiはそれらが入れたスキルの中身の結び方を決める (`README.md`)。

命令はnpmで配る形 (`package.json`の`bin`) を持つが、repoとnpmへの公開は本人のスキルでmusubiが動いた後に行う (課題#3)。
定義の版は日付で表し、今は`2026-11-19`だけが在る (`schema/`)。
